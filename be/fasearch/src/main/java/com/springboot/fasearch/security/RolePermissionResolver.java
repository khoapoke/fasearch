package com.springboot.fasearch.security;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import com.springboot.fasearch.common.enums.RoleType;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.repository.RolePermissionRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Tính quyền hiệu lực của một tài khoản từ vai trò HIỆN TẠI trong DB:
 * ADMIN = mọi quyền, STAFF = quyền đang bật trong quyen_vai_tro (mã lạ bỏ qua), CUSTOMER/khác = không có.
 * Lỗi đọc bảng quyền -> Quản lý không có quyền nào (đóng khi lỗi), không bao giờ mở thêm.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RolePermissionResolver {

    private final RolePermissionRepository rolePermissionRepository;

    public Set<Permission> permissionsOf(Account account) {
        if (account == null || account.getRole() == null || account.getRole().getName() == null) {
            return EnumSet.noneOf(Permission.class);
        }
        RoleType role = account.getRole().getName();
        if (role == RoleType.ADMIN) {
            return EnumSet.allOf(Permission.class);
        }
        if (role != RoleType.STAFF || account.getRole().getId() == null) {
            return EnumSet.noneOf(Permission.class);
        }
        return enabledFor(account.getRole().getId());
    }

    /** Quyền đang bật của một vai trò trong bảng (chỉ mã thuộc danh mục). */
    public Set<Permission> enabledFor(Long roleId) {
        Set<Permission> out = EnumSet.noneOf(Permission.class);
        try {
            for (String code : rolePermissionRepository.findCodesByRoleId(roleId)) {
                Permission.fromCode(code).ifPresent(out::add);
            }
        } catch (RuntimeException e) {
            log.error("Không đọc được quyen_vai_tro cho vai trò {}: Quản lý tạm thời không có quyền nghiệp vụ", roleId, e);
            return EnumSet.noneOf(Permission.class);
        }
        return out;
    }

    /** ROLE_<vai trò> + PERM_<mã> cho mỗi quyền hiệu lực. */
    public List<GrantedAuthority> authoritiesOf(Account account) {
        List<GrantedAuthority> authorities = new ArrayList<>();
        if (account == null || account.getRole() == null || account.getRole().getName() == null) {
            return authorities;
        }
        String role = account.getRole().getName().name();
        authorities.add(new SimpleGrantedAuthority(role.startsWith("ROLE_") ? role : "ROLE_" + role));
        for (Permission p : permissionsOf(account)) {
            authorities.add(new SimpleGrantedAuthority(p.authority()));
        }
        return authorities;
    }

    /** Mã quyền theo thứ tự danh mục (ổn định cho API và nhật ký). */
    public static List<String> codes(Set<Permission> permissions) {
        return Arrays.stream(Permission.values()).filter(permissions::contains).map(Enum::name).toList();
    }
}
