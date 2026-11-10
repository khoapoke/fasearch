package com.springboot.fasearch.modules.auth.service.impl;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.springboot.fasearch.common.enums.RoleType;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.auth.dto.response.RolePermissionAuditRes;
import com.springboot.fasearch.modules.auth.dto.response.RolePermissionsRes;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.entity.Role;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.auth.repository.RolePermissionRepository;
import com.springboot.fasearch.modules.auth.repository.RoleRepository;
import com.springboot.fasearch.modules.auth.service.interfaces.RolePermissionService;
import com.springboot.fasearch.security.Permission;
import com.springboot.fasearch.security.RolePermissionResolver;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class RolePermissionServiceImpl implements RolePermissionService {

    static final int AUDIT_LIMIT = 50;

    private final RoleRepository roleRepository;
    private final AccountRepository accountRepository;
    private final RolePermissionRepository rolePermissionRepository;

    @Override
    @Transactional(readOnly = true)
    public RolePermissionsRes getPermissions(RoleType role) {
        if (role == RoleType.ADMIN) {
            return build(RoleType.ADMIN, false, EnumSet.allOf(Permission.class));
        }
        Role staff = requireStaff(role);
        // Đọc thẳng (không nuốt lỗi như bộ lọc): màn hình sửa không được hiện "tắt hết" khi DB lỗi.
        return build(RoleType.STAFF, true, known(rolePermissionRepository.findCodesByRoleId(staff.getId())));
    }

    @Override
    @Transactional
    public RolePermissionsRes replacePermissions(RoleType role, List<String> codes, String actorUsername) {
        Role staff = requireStaff(role);
        if (codes == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Thiếu danh sách quyền.");
        }
        Set<Permission> next = EnumSet.noneOf(Permission.class);
        List<String> unknown = new ArrayList<>();
        for (String code : codes) {
            Permission.fromCode(code).ifPresentOrElse(next::add, () -> unknown.add(String.valueOf(code)));
        }
        if (!unknown.isEmpty()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Mã quyền không hợp lệ: " + String.join(", ", unknown));
        }

        rolePermissionRepository.lockRole(staff.getId());
        // Bộ quyền thô (gồm cả mã lạ, bị xóa khi lưu) và bộ quyền hiệu lực trước khi lưu, cho nhật ký.
        List<String> rawBefore = rolePermissionRepository.findCodesByRoleId(staff.getId());
        Set<Permission> before = known(rawBefore);
        List<String> nextCodes = RolePermissionResolver.codes(next);
        boolean sameRaw = rawBefore.size() == nextCodes.size() && rawBefore.containsAll(nextCodes);
        if (before.equals(next) && sameRaw) {
            return build(RoleType.STAFF, true, next);
        }

        Long actorId = StringUtils.hasText(actorUsername)
                ? accountRepository.findByUsername(actorUsername).map(Account::getId).orElse(null)
                : null;
        rolePermissionRepository.replaceCodes(staff.getId(), nextCodes);
        rolePermissionRepository.insertAudit(actorId, staff.getId(),
                String.join(",", RolePermissionResolver.codes(before)), String.join(",", nextCodes));
        log.info("Phân quyền Quản lý được cập nhật bởi tài khoản [{}]: {} quyền -> {} quyền", actorId, before.size(), next.size());
        return build(RoleType.STAFF, true, next);
    }

    @Override
    @Transactional(readOnly = true)
    public List<RolePermissionAuditRes> recentAudit(RoleType role) {
        Role staff = requireStaff(role);
        return rolePermissionRepository.findRecentAudit(staff.getId(), AUDIT_LIMIT).stream()
                .map(row -> {
                    Set<Permission> before = parse(row.before());
                    Set<Permission> after = parse(row.after());
                    Set<Permission> added = EnumSet.copyOf(after);
                    added.removeAll(before);
                    Set<Permission> removed = EnumSet.copyOf(before);
                    removed.removeAll(after);
                    return new RolePermissionAuditRes(row.id(), row.actorAccountId(), row.actorUsername(), row.at(),
                            RolePermissionResolver.codes(added), RolePermissionResolver.codes(removed));
                })
                .toList();
    }

    private Role requireStaff(RoleType role) {
        if (role != RoleType.STAFF) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    role == RoleType.ADMIN
                            ? "Quản trị viên luôn có toàn quyền, không chỉnh được."
                            : "Chỉ chỉnh được phân quyền của vai trò Quản lý.");
        }
        return roleRepository.findByName(RoleType.STAFF)
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
    }

    private static Set<Permission> known(List<String> codes) {
        Set<Permission> out = EnumSet.noneOf(Permission.class);
        for (String code : codes) {
            Permission.fromCode(code).ifPresent(out::add);
        }
        return out;
    }

    private static Set<Permission> parse(String csv) {
        Set<Permission> out = EnumSet.noneOf(Permission.class);
        if (csv == null || csv.isBlank()) {
            return out;
        }
        for (String code : csv.split(",")) {
            Permission.fromCode(code.trim()).ifPresent(out::add);
        }
        return out;
    }

    private static RolePermissionsRes build(RoleType role, boolean editable, Set<Permission> enabled) {
        Map<Permission.Group, List<RolePermissionsRes.Item>> grouped = new LinkedHashMap<>();
        for (Permission.Group g : Permission.Group.values()) {
            grouped.put(g, new ArrayList<>());
        }
        for (Permission p : Permission.values()) {
            grouped.get(p.group()).add(new RolePermissionsRes.Item(p.name(), p.label(), enabled.contains(p)));
        }
        List<RolePermissionsRes.Group> groups = Arrays.stream(Permission.Group.values())
                .filter(g -> !grouped.get(g).isEmpty())
                .map(g -> new RolePermissionsRes.Group(g.name(), g.label(), grouped.get(g)))
                .toList();
        return new RolePermissionsRes(role, editable, RolePermissionResolver.codes(enabled), groups);
    }
}
