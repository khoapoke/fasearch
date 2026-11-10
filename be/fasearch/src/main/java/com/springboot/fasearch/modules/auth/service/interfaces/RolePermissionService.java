package com.springboot.fasearch.modules.auth.service.interfaces;

import java.util.List;

import com.springboot.fasearch.common.enums.RoleType;
import com.springboot.fasearch.modules.auth.dto.response.RolePermissionAuditRes;
import com.springboot.fasearch.modules.auth.dto.response.RolePermissionsRes;

public interface RolePermissionService {

    RolePermissionsRes getPermissions(RoleType role);

    RolePermissionsRes replacePermissions(RoleType role, List<String> codes, String actorUsername);

    List<RolePermissionAuditRes> recentAudit(RoleType role);
}
