package com.springboot.fasearch.modules.user;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import com.springboot.fasearch.common.enums.AccountStatus;
import com.springboot.fasearch.common.softdelete.SoftDeleteRecorder;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.loyalty.service.interfaces.LoyaltyService;
import com.springboot.fasearch.modules.trash.service.impl.DeleteGuards;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.mapper.UserMapper;
import com.springboot.fasearch.modules.user.repository.MembershipTierRepository;
import com.springboot.fasearch.modules.user.repository.UserRepository;
import com.springboot.fasearch.modules.user.service.impl.UserServiceImpl;

/**
 * Xóa hồ sơ khách hàng không được để lại một tài khoản đăng nhập còn sống gắn với hồ sơ đã xóa:
 * khóa tài khoản liên kết là việc quản trị tài khoản nên STAFF (Quản lý) bị từ chối, ADMIN thực hiện
 * trong cùng transaction và token cũ bị vô hiệu.
 */
@ExtendWith(MockitoExtension.class)
class CustomerAccountGuardTest {

    @Mock private UserRepository userRepository;
    @Mock private AccountRepository accountRepository;
    @Mock private MembershipTierRepository membershipTierRepository;
    @Mock private UserMapper userMapper;
    @Mock private LoyaltyService loyaltyService;
    @Mock private DeleteGuards deleteGuards;
    @Mock private SoftDeleteRecorder softDeleteRecorder;

    private UserServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new UserServiceImpl(userRepository, accountRepository, membershipTierRepository, userMapper,
                loyaltyService, deleteGuards, softDeleteRecorder);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void loginAs(String role) {
        SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                "tester", null, List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }

    @Test
    void staffCannotDeleteCustomerThatWouldLockALoginAccount() {
        loginAs("STAFF");
        Account account = Account.builder().id(5L).status(AccountStatus.ACTIVE).tokenVersion(0L).build();
        Customer customer = Customer.builder().id(1L).account(account).build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(customer));

        AppException error = assertThrows(AppException.class, () -> service.deleteCustomer(1L, null));

        assertEquals(ErrorCode.ACCESS_DENIED, error.getErrorCode());
        assertTrue(error.getMessage().contains("Quản trị viên hệ thống"));
        assertEquals(AccountStatus.ACTIVE, account.getStatus());
        verify(accountRepository, never()).save(any());
        verify(userRepository, never()).save(any());
        verify(softDeleteRecorder, never()).mark(any(), any());
    }

    @Test
    void adminDeletingLinkedCustomerLocksTheLoginAndRevokesIssuedTokens() {
        loginAs("ADMIN");
        Account account = Account.builder().id(5L).status(AccountStatus.ACTIVE).tokenVersion(3L).build();
        Customer customer = Customer.builder().id(1L).account(account).build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(customer));

        service.deleteCustomer(1L, "Khách yêu cầu");

        assertEquals(AccountStatus.LOCKED, account.getStatus());
        assertEquals(4L, account.getTokenVersion());
        verify(accountRepository).save(account);
        verify(softDeleteRecorder).mark(customer, "Khách yêu cầu");
        verify(userRepository).save(customer);
    }

    @Test
    void staffCanDeleteCustomerWithoutLogin() {
        loginAs("STAFF");
        Customer customer = Customer.builder().id(2L).build();
        when(userRepository.findById(2L)).thenReturn(Optional.of(customer));

        service.deleteCustomer(2L, null);

        verify(softDeleteRecorder).mark(customer, null);
        verify(userRepository).save(customer);
        verify(accountRepository, never()).save(any());
    }

    @Test
    void historyGuardRunsBeforeAnyAccountChange() {
        loginAs("ADMIN");
        Account account = Account.builder().id(5L).status(AccountStatus.ACTIVE).build();
        Customer customer = Customer.builder().id(3L).account(account).build();
        when(userRepository.findById(3L)).thenReturn(Optional.of(customer));
        doThrow(new AppException(ErrorCode.DELETE_BLOCKED_BY_HISTORY))
                .when(deleteGuards).assertCustomerDeletable(3L);

        AppException error = assertThrows(AppException.class, () -> service.deleteCustomer(3L, null));

        assertEquals(ErrorCode.DELETE_BLOCKED_BY_HISTORY, error.getErrorCode());
        assertEquals(AccountStatus.ACTIVE, account.getStatus());
        verify(accountRepository, never()).save(any());
        verify(userRepository, never()).save(any());
    }
}
