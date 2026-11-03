package com.springboot.fasearch.modules.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.springboot.fasearch.modules.auth.dto.response.AccountInfoRes;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.mapper.AccountMapper;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.auth.service.impl.AuthServiceImpl;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.repository.UserRepository;

/**
 * PROFILE-BE-01: my-info phải trả mã hồ sơ khách hàng (ma_kh) để client tự tra cứu
 * chính mình, vì id tài khoản và id hồ sơ là hai số khác nhau.
 */
@ExtendWith(MockitoExtension.class)
class MyInfoCustomerIdTest {

    @Mock private AccountRepository accountRepository;
    @Mock private UserRepository userRepository;
    @Mock private AccountMapper accountMapper;
    @InjectMocks private AuthServiceImpl authService;

    @Test
    void myInfoTraCustomerIdCuaHoSo() {
        Account account = Account.builder().id(29L).username("preflight1").build();
        AccountInfoRes mapped = AccountInfoRes.builder().id(29L).username("preflight1").build();
        when(accountRepository.findByUsername("preflight1")).thenReturn(Optional.of(account));
        when(accountMapper.toAccountInfoResponse(account)).thenReturn(mapped);
        when(userRepository.findByAccount_Username("preflight1"))
                .thenReturn(Optional.of(Customer.builder().id(32L).build()));

        AccountInfoRes res = authService.getMyInfo("preflight1");

        assertEquals(32L, res.getCustomerId(), "customerId phải là ma_kh chứ không phải id tài khoản");
        assertEquals(29L, res.getId());
    }

    @Test
    void myInfoTraNullKhiTaiKhoanKhongCoHoSo() {
        Account account = Account.builder().id(1L).username("admin").build();
        AccountInfoRes mapped = AccountInfoRes.builder().id(1L).username("admin").build();
        when(accountRepository.findByUsername("admin")).thenReturn(Optional.of(account));
        when(accountMapper.toAccountInfoResponse(account)).thenReturn(mapped);
        when(userRepository.findByAccount_Username("admin")).thenReturn(Optional.empty());

        assertNull(authService.getMyInfo("admin").getCustomerId());
    }
}
