package com.springboot.fasearch.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
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

/**
 * Token hợp lệ về chữ ký không được giữ quyền khi trạng thái/vai trò hiện tại trong DB
 * đã thay đổi: khóa/ngừng hoạt động phải mất quyền, hạ vai trò phải mất quyền ADMIN.
 */
@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterCurrentStateTest {

    @Mock private JwtProvider jwtProvider;
    @Mock private AccountRepository accountRepository;
    @InjectMocks private JwtAuthenticationFilter filter;

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
}
