package com.springboot.fasearch.modules.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
import com.springboot.fasearch.modules.auth.service.impl.RolePermissionServiceImpl;
import com.springboot.fasearch.security.Permission;

@ExtendWith(MockitoExtension.class)
class RolePermissionServiceTest {

    @Mock private RoleRepository roleRepository;
    @Mock private AccountRepository accountRepository;
    @Mock private RolePermissionRepository repo;
    @InjectMocks private RolePermissionServiceImpl service;

    @BeforeEach
    void setUp() {
        Role staff = new Role();
        staff.setId(2L);
        staff.setName(RoleType.STAFF);
        lenient().when(roleRepository.findByName(RoleType.STAFF)).thenReturn(Optional.of(staff));
        lenient().when(accountRepository.findByUsername("boss")).thenReturn(Optional.of(Account.builder().id(1L).build()));
    }

    @Test
    void adminIsNotEditableAndAlwaysHasEverything() {
        RolePermissionsRes res = service.getPermissions(RoleType.ADMIN);
        assertFalse(res.editable());
        assertEquals(Permission.values().length, res.enabled().size());
        AppException e = assertThrows(AppException.class,
                () -> service.replacePermissions(RoleType.ADMIN, List.of(), "boss"));
        assertEquals(ErrorCode.INVALID_REQUEST, e.getErrorCode());
        assertThrows(AppException.class, () -> service.replacePermissions(RoleType.CUSTOMER, List.of("ORDER_VIEW"), "boss"));
        verify(repo, never()).replaceCodes(anyLong(), any());
    }

    @Test
    void getGroupsEveryPermissionAndIgnoresUnknownCodes() {
        when(repo.findCodesByRoleId(2L)).thenReturn(List.of("ORDER_VIEW", "LEGACY_THING"));
        RolePermissionsRes res = service.getPermissions(RoleType.STAFF);
        assertTrue(res.editable());
        assertEquals(List.of("ORDER_VIEW"), res.enabled());
        long items = res.groups().stream().mapToLong(g -> g.permissions().size()).sum();
        assertEquals(Permission.values().length, items);
        assertEquals("Đơn hàng", res.groups().get(0).label());
    }

    @Test
    void unknownCodeIsRejectedWithoutWriting() {
        AppException e = assertThrows(AppException.class,
                () -> service.replacePermissions(RoleType.STAFF, List.of("ORDER_VIEW", "SUPER_POWER"), "boss"));
        assertEquals(ErrorCode.INVALID_REQUEST, e.getErrorCode());
        assertTrue(e.getMessage().contains("SUPER_POWER"));
        verify(repo, never()).replaceCodes(anyLong(), any());
        verify(repo, never()).insertAudit(any(), anyLong(), anyString(), anyString());
    }

    @Test
    void changeReplacesTheSetAndWritesOneAuditRow() {
        when(repo.findCodesByRoleId(2L)).thenReturn(List.of("ORDER_VIEW", "ORDER_CANCEL"));
        RolePermissionsRes res = service.replacePermissions(RoleType.STAFF,
                List.of("TRASH_VIEW", "ORDER_VIEW", "ORDER_VIEW"), "boss");
        assertEquals(List.of("ORDER_VIEW", "TRASH_VIEW"), res.enabled());
        verify(repo).lockRole(2L);
        verify(repo).replaceCodes(2L, List.of("ORDER_VIEW", "TRASH_VIEW"));
        verify(repo).insertAudit(eq(1L), eq(2L), eq("ORDER_VIEW,ORDER_CANCEL"), eq("ORDER_VIEW,TRASH_VIEW"));
    }

    @Test
    void noChangeWritesNothing() {
        when(repo.findCodesByRoleId(2L)).thenReturn(List.of("ORDER_VIEW"));
        service.replacePermissions(RoleType.STAFF, List.of("ORDER_VIEW"), "boss");
        verify(repo, never()).replaceCodes(anyLong(), any());
        verify(repo, never()).insertAudit(any(), anyLong(), anyString(), anyString());
    }

    @Test
    void auditShowsAddedAndRemoved() {
        when(repo.findRecentAudit(2L, 50)).thenReturn(List.of(new RolePermissionRepository.AuditRow(5L, 1L, "boss",
                "ORDER_VIEW,ORDER_CANCEL", "ORDER_VIEW,TRASH_VIEW", LocalDateTime.of(2026, 11, 8, 10, 0))));
        RolePermissionAuditRes row = service.recentAudit(RoleType.STAFF).get(0);
        assertEquals(List.of("TRASH_VIEW"), row.added());
        assertEquals(List.of("ORDER_CANCEL"), row.removed());
        assertEquals("boss", row.actorUsername());
    }
}
