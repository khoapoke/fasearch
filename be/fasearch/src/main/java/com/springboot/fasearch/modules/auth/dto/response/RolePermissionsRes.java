package com.springboot.fasearch.modules.auth.dto.response;

import java.util.List;

import com.springboot.fasearch.common.enums.RoleType;

/**
 * Danh mục quyền theo nhóm cùng trạng thái bật/tắt cho một vai trò.
 * {@code editable=false} với ADMIN (luôn toàn quyền).
 */
public record RolePermissionsRes(RoleType role, boolean editable, List<String> enabled, List<Group> groups) {

    public record Group(String code, String label, List<Item> permissions) {
    }

    public record Item(String code, String label, boolean enabled) {
    }
}
