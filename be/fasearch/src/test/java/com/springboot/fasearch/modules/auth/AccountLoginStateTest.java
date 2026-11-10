package com.springboot.fasearch.modules.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.springboot.fasearch.common.enums.AccountStatus;
import com.springboot.fasearch.common.enums.RoleType;
import com.springboot.fasearch.common.softdelete.SoftDeleteRecorder;
import com.springboot.fasearch.config.JwtConfig;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.auth.dto.request.LoginReq;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.entity.Role;
import com.springboot.fasearch.modules.auth.mapper.AccountMapper;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.auth.repository.RoleRepository;
import com.springboot.fasearch.modules.auth.service.impl.AuthServiceImpl;
import com.springboot.fasearch.modules.auth.service.interfaces.EmailTokenService;
import com.springboot.fasearch.modules.trash.service.impl.DeleteGuards;
import com.springboot.fasearch.modules.user.repository.UserRepository;
import com.springboot.fasearch.security.JwtProvider;

/**
 * Tài khoản đã xóa mềm hoặc vừa khôi phục (INACTIVE) không đăng nhập được, và xóa tài khoản
 * phải tăng token_version để token đã cấp trước đó không thể sống lại khi tài khoản được bật.
 */
@ExtendWith(MockitoExtension.class)
class AccountLoginStateTest {

    @Mock private AccountRepository accountRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtProvider jwtProvider;
    @Mock private JwtConfig jwtConfig;
    @Mock private AccountMapper accountMapper;
    @Mock private EmailTokenService emailTokenService;
    @Mock private DeleteGuards deleteGuards;
    @Mock private SoftDeleteRecorder softDeleteRecorder;

    @InjectMocks private AuthServiceImpl authService;

    private Account account(AccountStatus status, boolean deleted) {
        Role role = Role.builder().name(RoleType.STAFF).build();
        return Account.builder().id(92L).username("qa_staff").password("hash").email("qa@example.com")
                .role(role).status(status).isDeleted(deleted).tokenVersion(5L).build();
    }

    private void stubCredentials(Account account) {
        when(accountRepository.findByUsername("qa_staff")).thenReturn(Optional.of(account));
        when(passwordEncoder.matches("secret123", "hash")).thenReturn(true);
    }

    @Test
    void deletedAccountCannotLogIn() {
        stubCredentials(account(AccountStatus.DELETED, true));

        AppException error = assertThrows(AppException.class,
                () -> authService.login(LoginReq.builder().username("qa_staff").password("secret123").build()));

        assertEquals(ErrorCode.ACCOUNT_INACTIVE, error.getErrorCode());
    }

    @Test
    void restoredButNotActivatedAccountCannotLogIn() {
        stubCredentials(account(AccountStatus.INACTIVE, false));

        AppException error = assertThrows(AppException.class,
                () -> authService.login(LoginReq.builder().username("qa_staff").password("secret123").build()));

        assertEquals(ErrorCode.ACCOUNT_INACTIVE, error.getErrorCode());
    }

    @Test
    void deletedAccountIsMarkedDeletedAndItsTokenVersionIsRevoked() {
        Account target = account(AccountStatus.ACTIVE, false);
        when(accountRepository.findById(92L)).thenReturn(Optional.of(target));

        authService.deleteAccount(92L, "Dọn dữ liệu kiểm thử");

        assertEquals(AccountStatus.DELETED, target.getStatus());
        assertEquals(6L, target.getTokenVersion());
        verify(softDeleteRecorder).mark(target, "Dọn dữ liệu kiểm thử");
        verify(accountRepository).save(target);
    }
}
