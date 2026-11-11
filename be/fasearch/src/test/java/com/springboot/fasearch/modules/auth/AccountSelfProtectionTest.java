package com.springboot.fasearch.modules.auth;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import com.springboot.fasearch.common.enums.AccountStatus;
import com.springboot.fasearch.common.enums.RoleType;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.auth.dto.request.AccountUpdateReq;
import com.springboot.fasearch.modules.auth.dto.response.AccountInfoRes;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.entity.Role;
import com.springboot.fasearch.modules.auth.mapper.AccountMapper;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.auth.repository.RoleRepository;
import com.springboot.fasearch.modules.auth.service.impl.AuthServiceImpl;
import com.springboot.fasearch.security.TestAuthorities;

/** BE tự bảo vệ (không chỉ BFF): Quản trị viên không tự đổi vai trò hay trạng thái của chính mình. */
@ExtendWith(MockitoExtension.class)
class AccountSelfProtectionTest {

    @Mock private AccountRepository accountRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private AccountMapper accountMapper;
    @InjectMocks private AuthServiceImpl authService;

    private Account me;
    private Account other;

    private static Account account(long id, String username, RoleType roleType) {
        Role role = new Role();
        role.setName(roleType);
        return Account.builder().id(id).username(username).status(AccountStatus.ACTIVE).role(role).build();
    }

    @BeforeEach
    void setUp() {
        me = account(1L, "boss", RoleType.ADMIN);
        other = account(2L, "other.admin", RoleType.ADMIN);
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated("boss", null, TestAuthorities.admin()));
        lenient().when(accountRepository.findById(1L)).thenReturn(Optional.of(me));
        lenient().when(accountRepository.findById(2L)).thenReturn(Optional.of(other));
        lenient().when(accountRepository.save(any(Account.class))).thenAnswer(i -> i.getArgument(0));
        lenient().when(accountMapper.toAccountInfoResponse(any(Account.class))).thenReturn(new AccountInfoRes());
        Role staff = new Role();
        staff.setName(RoleType.STAFF);
        lenient().when(roleRepository.findByName(RoleType.STAFF)).thenReturn(Optional.of(staff));
        Role admin = new Role();
        admin.setName(RoleType.ADMIN);
        lenient().when(roleRepository.findByName(RoleType.ADMIN)).thenReturn(Optional.of(admin));
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void cannotDemoteSelf() {
        AppException e = assertThrows(AppException.class,
                () -> authService.updateAccount(1L, AccountUpdateReq.builder().role(RoleType.STAFF).build()));
        assertEquals(ErrorCode.ACCESS_DENIED, e.getErrorCode());
        verify(accountRepository, never()).save(any());
    }

    @Test
    void cannotLockOrDeactivateSelf() {
        for (AccountStatus status : new AccountStatus[] { AccountStatus.LOCKED, AccountStatus.INACTIVE }) {
            AppException e = assertThrows(AppException.class,
                    () -> authService.updateAccount(1L, AccountUpdateReq.builder().status(status).build()));
            assertEquals(ErrorCode.ACCESS_DENIED, e.getErrorCode());
        }
        verify(accountRepository, never()).save(any());
    }

    @Test
    void sameRoleAndStatusOrEmailOnSelfStillAllowed() {
        assertDoesNotThrow(() -> authService.updateAccount(1L, AccountUpdateReq.builder()
                .role(RoleType.ADMIN).status(AccountStatus.ACTIVE).build()));
    }

    @Test
    void canDemoteAnotherAdmin() {
        authService.updateAccount(2L, AccountUpdateReq.builder().role(RoleType.STAFF).build());
        assertEquals(RoleType.STAFF, other.getRole().getName());
    }

    @Test
    void roleCustomerIsRefusedForInternalAccounts() {
        assertThrows(AppException.class,
                () -> authService.updateAccount(2L, AccountUpdateReq.builder().role(RoleType.CUSTOMER).build()));
        assertEquals(RoleType.ADMIN, other.getRole().getName());
    }
}
