package com.springboot.fasearch.modules.auth.dto.response;

import java.time.LocalDateTime;
import java.util.List;

/** Một lần lưu phân quyền: ai, lúc nào, bật thêm và tắt bớt quyền nào. */
public record RolePermissionAuditRes(Long id, Long actorAccountId, String actorUsername, LocalDateTime changedAt,
        List<String> added, List<String> removed) {
}
