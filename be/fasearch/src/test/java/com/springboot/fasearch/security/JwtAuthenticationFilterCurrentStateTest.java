package com.springboot.fasearch.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import com.springboot.fasearch.common.enums.AccountStatus;
import com.springboot.fasearch.common.enums.RoleType;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.entity.Role;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.auth.repository.RolePermissionRepository;

/**
 * Token hợp lệ về chữ ký không được giữ quyền khi trạng thái/vai trò hiện tại trong DB
 * đã thay đổi: khóa/ngừng hoạt động phải mất quyền, hạ vai trò phải mất quyền ADMIN.
 */
@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterCurrentStateTest {

    @Mock private JwtProvider jwtProvider;
    @Mock private AccountRepository accountRepository;
    @Mock private RolePermissionRepository rolePermissionRepository;
    private JwtAuthenticationFilter filter;

    @BeforeEach
    void buildFilter() {
        filter = new JwtAuthenticationFilter(jwtProvider, accountRepository,
                new RolePermissionResolver(rolePermissionRepository));
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private void runFilter() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/orders");
        request.addHeader("Authorization", "Bearer any.token.value");
        when(jwtProvider.validateToken("any.token.value")).thenReturn(true);
        when(jwtProvider.extractUsername("any.token.value")).thenReturn("synthetic.staff");
        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());
    }

    private Account account(AccountStatus status, RoleType roleType, boolean deleted) {
        Role role = new Role();
        role.setId(roleType == RoleType.ADMIN ? 1L : roleType == RoleType.STAFF ? 2L : 3L);
        role.setName(roleType);
        return Account.builder().id(56L).username("synthetic.staff").status(status)
                .role(role).isDeleted(deleted).build();
    }

    @Test
    void activeAccountGetsAuthoritiesFromPersistedRole() throws Exception {
        when(accountRepository.findByUsername("synthetic.staff"))
                .thenReturn(Optional.of(account(AccountStatus.ACTIVE, RoleType.STAFF, false)));

        runFilter();

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth, "tài khoản ACTIVE phải được xác thực");
        assertEquals("ROLE_STAFF", auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority).findFirst().orElse(null));
    }

    @Test
    void lockedAccountIsNotAuthenticated() throws Exception {
        when(accountRepository.findByUsername("synthetic.staff"))
                .thenReturn(Optional.of(account(AccountStatus.LOCKED, RoleType.STAFF, false)));

        runFilter();

        assertNull(SecurityContextHolder.getContext().getAuthentication(), "tài khoản LOCKED không được xác thực");
    }

    @Test
    void inactiveAccountIsNotAuthenticated() throws Exception {
        when(accountRepository.findByUsername("synthetic.staff"))
                .thenReturn(Optional.of(account(AccountStatus.INACTIVE, RoleType.STAFF, false)));

        runFilter();

        assertNull(SecurityContextHolder.getContext().getAuthentication(), "tài khoản INACTIVE không được xác thực");
    }

    @Test
    void demotedAdminLosesAdminAuthority() throws Exception {
        when(accountRepository.findByUsername("synthetic.staff"))
                .thenReturn(Optional.of(account(AccountStatus.ACTIVE, RoleType.STAFF, false)));

        runFilter();

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
        assertEquals(1, auth.getAuthorities().size());
        assertEquals("ROLE_STAFF", auth.getAuthorities().iterator().next().getAuthority());
    }

    @Test
    void missingOrDeletedAccountIsNotAuthenticated() throws Exception {
        when(accountRepository.findByUsername("synthetic.staff")).thenReturn(Optional.empty());

        runFilter();

        assertNull(SecurityContextHolder.getContext().getAuthentication(), "tài khoản đã xóa không được xác thực");
    }

    /** Dòng còn trong bảng nhưng đã xóa mềm: token đã cấp trước khi xóa cũng mất quyền. */
    @Test
    void softDeletedRowIsNotAuthenticatedEvenWithActiveStatus() throws Exception {
        when(accountRepository.findByUsername("synthetic.staff"))
                .thenReturn(Optional.of(account(AccountStatus.ACTIVE, RoleType.STAFF, true)));

        runFilter();

        assertNull(SecurityContextHolder.getContext().getAuthentication(), "da_xoa = true phải bị từ chối");
    }

    /** Token cấp trước khi xóa tài khoản mang token_version cũ nên không sống lại sau khi bật lại. */
    @Test
    void staleTokenVersionIsNotAuthenticated() throws Exception {
        Account current = account(AccountStatus.ACTIVE, RoleType.STAFF, false);
        current.setTokenVersion(2L);
        when(accountRepository.findByUsername("synthetic.staff")).thenReturn(Optional.of(current));
        when(jwtProvider.extractTokenVersion("any.token.value")).thenReturn(1L);

        runFilter();

        assertNull(SecurityContextHolder.getContext().getAuthentication(), "token_version cũ không được xác thực");
    }

    private Set<String> authorities() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
        return auth.getAuthorities().stream().map(GrantedAuthority::getAuthority).collect(Collectors.toSet());
    }

    @Test
    void staffGetsOnlyEnabledKnownPermissions() throws Exception {
        when(accountRepository.findByUsername("synthetic.staff"))
                .thenReturn(Optional.of(account(AccountStatus.ACTIVE, RoleType.STAFF, false)));
        when(rolePermissionRepository.findCodesByRoleId(2L)).thenReturn(List.of("ORDER_VIEW", "NOT_A_PERMISSION", "TRASH_VIEW"));

        runFilter();

        assertEquals(Set.of("ROLE_STAFF", "PERM_ORDER_VIEW", "PERM_TRASH_VIEW"), authorities(),
                "mã lạ trong bảng bị bỏ qua, chỉ quyền đang bật được cấp");
    }

    @Test
    void adminGetsEveryPermissionWithoutReadingTheTable() throws Exception {
        when(accountRepository.findByUsername("synthetic.staff"))
                .thenReturn(Optional.of(account(AccountStatus.ACTIVE, RoleType.ADMIN, false)));

        runFilter();

        Set<String> got = authorities();
        assertTrue(got.contains("ROLE_ADMIN"));
        for (Permission p : Permission.values()) {
            assertTrue(got.contains(p.authority()), "ADMIN phải có " + p);
        }
        verify(rolePermissionRepository, never()).findCodesByRoleId(any());
    }

    @Test
    void customerNeverGetsPermissionsEvenIfRowsExist() throws Exception {
        when(accountRepository.findByUsername("synthetic.staff"))
                .thenReturn(Optional.of(account(AccountStatus.ACTIVE, RoleType.CUSTOMER, false)));

        runFilter();

        assertEquals(Set.of("ROLE_CUSTOMER"), authorities());
        verify(rolePermissionRepository, never()).findCodesByRoleId(any());
    }

    /** Đổi phân quyền có hiệu lực ngay request kế tiếp: bộ lọc đọc bảng mỗi request, không cache, không cần đăng nhập lại. */
    @Test
    void permissionChangeAppliesOnTheNextRequest() throws Exception {
        when(accountRepository.findByUsername("synthetic.staff"))
                .thenReturn(Optional.of(account(AccountStatus.ACTIVE, RoleType.STAFF, false)));
        when(rolePermissionRepository.findCodesByRoleId(2L))
                .thenReturn(List.of("ORDER_VIEW", "ORDER_CANCEL"))
                .thenReturn(List.of("ORDER_VIEW"));

        runFilter();
        assertTrue(authorities().contains("PERM_ORDER_CANCEL"));

        SecurityContextHolder.clearContext();
        runFilter();
        assertFalse(authorities().contains("PERM_ORDER_CANCEL"), "quyền vừa tắt không còn ở request kế tiếp");
        assertTrue(authorities().contains("PERM_ORDER_VIEW"));
    }

    /** Lỗi đọc bảng quyền: đóng (chỉ còn ROLE_STAFF), không bao giờ mở thêm quyền. */
    @Test
    void permissionTableErrorFailsClosed() throws Exception {
        when(accountRepository.findByUsername("synthetic.staff"))
                .thenReturn(Optional.of(account(AccountStatus.ACTIVE, RoleType.STAFF, false)));
        when(rolePermissionRepository.findCodesByRoleId(2L)).thenThrow(new IllegalStateException("db down"));

        runFilter();

        assertEquals(Set.of("ROLE_STAFF"), authorities());
    }
}
