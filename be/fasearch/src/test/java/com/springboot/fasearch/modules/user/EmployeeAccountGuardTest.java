package com.springboot.fasearch.modules.user;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import com.springboot.fasearch.common.enums.AccountStatus;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.auth.dto.request.AccountCreateReq;
import com.springboot.fasearch.modules.auth.dto.request.AccountUpdateReq;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.user.dto.request.CustomerCreateReq;
import com.springboot.fasearch.modules.user.dto.request.CustomerUpdateReq;
import com.springboot.fasearch.modules.user.dto.request.EmployeeCreateReq;
import com.springboot.fasearch.modules.user.dto.request.EmployeeUpdateReq;
import com.springboot.fasearch.modules.user.entity.Employee;
import com.springboot.fasearch.modules.user.mapper.EmployeeMapper;
import com.springboot.fasearch.modules.user.repository.EmployeeRepository;
import com.springboot.fasearch.modules.user.service.impl.EmployeeServiceImpl;

/**
 * Quản lý (STAFF) may manage employee/manager PROFILE records, but linking a login account to a profile
 * (and the account lock performed when a linked profile is deleted) is account administration: ADMIN only.
 */
@ExtendWith(MockitoExtension.class)
class EmployeeAccountGuardTest {

    @Mock private EmployeeRepository employeeRepository;
    @Mock private AccountRepository accountRepository;
    @Mock private EmployeeMapper employeeMapper;
    @InjectMocks private EmployeeServiceImpl service;

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void loginAs(String role) {
        SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                "tester", null, List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }

    private static EmployeeCreateReq createReq(Long accountId) {
        return EmployeeCreateReq.builder().lastName("Lan").phoneNumber("0900000001").cccd("012345678901")
                .accountId(accountId).build();
    }

    @Test
    void staffCannotLinkLoginAccountOnCreate() {
        loginAs("STAFF");
        when(employeeRepository.findByPhoneNumber("0900000001")).thenReturn(Optional.empty());
        when(employeeRepository.findByCccd("012345678901")).thenReturn(Optional.empty());
        AppException error = assertThrows(AppException.class, () -> service.createEmployee(createReq(7L)));
        assertEquals(ErrorCode.ACCESS_DENIED, error.getErrorCode());
        verify(accountRepository, never()).findById(any());
        verify(employeeRepository, never()).save(any());
    }

    @Test
    void staffCanCreateProfileWithoutAccount() {
        loginAs("STAFF");
        Employee entity = Employee.builder().build();
        when(employeeRepository.findByPhoneNumber("0900000001")).thenReturn(Optional.empty());
        when(employeeRepository.findByCccd("012345678901")).thenReturn(Optional.empty());
        when(employeeMapper.toEmployee(any())).thenReturn(entity);
        when(employeeRepository.save(entity)).thenReturn(entity);
        service.createEmployee(createReq(null));
        verify(employeeRepository).save(entity);
    }

    @Test
    void adminCanLinkAccountOnCreate() {
        loginAs("ADMIN");
        Account account = Account.builder().id(7L).build();
        Employee entity = Employee.builder().build();
        when(employeeRepository.findByPhoneNumber("0900000001")).thenReturn(Optional.empty());
        when(employeeRepository.findByCccd("012345678901")).thenReturn(Optional.empty());
        when(accountRepository.findById(7L)).thenReturn(Optional.of(account));
        when(employeeRepository.findByAccountId(7L)).thenReturn(Optional.empty());
        when(employeeMapper.toEmployee(any())).thenReturn(entity);
        when(employeeRepository.save(entity)).thenReturn(entity);
        service.createEmployee(createReq(7L));
        assertEquals(account, entity.getAccount());
    }

    @Test
    void staffCannotRelinkAccountOnUpdateButNoOpSameLinkIsFine() {
        loginAs("STAFF");
        Account current = Account.builder().id(5L).build();
        Employee employee = Employee.builder().id(1L).account(current).build();
        when(employeeRepository.findById(1L)).thenReturn(Optional.of(employee));
        when(employeeRepository.save(employee)).thenReturn(employee);

        EmployeeUpdateReq other = EmployeeUpdateReq.builder().accountId(9L).build();
        AppException error = assertThrows(AppException.class, () -> service.updateEmployee(1L, other));
        assertEquals(ErrorCode.ACCESS_DENIED, error.getErrorCode());
        assertEquals(current, employee.getAccount());
        verify(accountRepository, never()).findById(any());

        service.updateEmployee(1L, EmployeeUpdateReq.builder().accountId(5L).address("Quận 1").build());
        assertEquals(current, employee.getAccount());
    }

    @Test
    void staffCannotDeleteProfileThatWouldLockALoginAccount() {
        loginAs("STAFF");
        Account account = Account.builder().id(5L).status(AccountStatus.ACTIVE).build();
        Employee employee = Employee.builder().id(1L).account(account).build();
        when(employeeRepository.findById(1L)).thenReturn(Optional.of(employee));
        AppException error = assertThrows(AppException.class, () -> service.deleteEmployee(1L));
        assertEquals(ErrorCode.ACCESS_DENIED, error.getErrorCode());
        assertEquals(AccountStatus.ACTIVE, account.getStatus());
        verify(accountRepository, never()).save(any());
        verify(employeeRepository, never()).save(any());
    }

    @Test
    void staffCanDeleteUnlinkedProfileAndAdminStillLocksLinkedAccount() {
        loginAs("STAFF");
        Employee unlinked = Employee.builder().id(2L).build();
        when(employeeRepository.findById(2L)).thenReturn(Optional.of(unlinked));
        service.deleteEmployee(2L);
        assertTrue(unlinked.getIsDeleted());
        verify(accountRepository, never()).save(any());

        loginAs("ADMIN");
        Account account = Account.builder().id(5L).status(AccountStatus.ACTIVE).build();
        Employee linked = Employee.builder().id(1L).account(account).build();
        when(employeeRepository.findById(1L)).thenReturn(Optional.of(linked));
        service.deleteEmployee(1L);
        assertEquals(AccountStatus.LOCKED, account.getStatus());
    }

    /** Role/account fields are not part of any profile request, so a profile edit cannot change a role. */
    @Test
    void profileRequestsCarryNoRoleField() {
        for (Class<?> type : List.of(CustomerCreateReq.class, CustomerUpdateReq.class, EmployeeCreateReq.class,
                EmployeeUpdateReq.class)) {
            for (Field field : type.getDeclaredFields()) {
                assertFalse(field.getName().toLowerCase().contains("role"), type.getSimpleName() + "." + field.getName());
            }
        }
        // Role is settable only through the ADMIN-only account endpoints.
        assertTrue(java.util.Arrays.stream(AccountCreateReq.class.getDeclaredFields()).anyMatch(f -> f.getName().equals("role")));
        assertTrue(java.util.Arrays.stream(AccountUpdateReq.class.getDeclaredFields()).anyMatch(f -> f.getName().equals("role")));
    }
}
