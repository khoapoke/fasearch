package com.springboot.fasearch.modules.auth.service.impl;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.common.enums.AccountStatus;
import com.springboot.fasearch.common.enums.RoleType;
import com.springboot.fasearch.config.JwtConfig;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.auth.dto.request.LoginReq;
import com.springboot.fasearch.modules.auth.dto.request.RegisterReq;
import com.springboot.fasearch.modules.auth.dto.response.AccountInfoRes;
import com.springboot.fasearch.modules.auth.dto.response.AuthRes;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.entity.Role;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.auth.repository.RoleRepository;
import com.springboot.fasearch.modules.auth.service.interfaces.AuthService;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.repository.UserRepository;
import com.springboot.fasearch.security.JwtProvider;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final AccountRepository accountRepository;
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;
    private final JwtConfig jwtConfig;

    @Override
    public AuthRes login(LoginReq req) {
        Account account = accountRepository.findByUsername(req.getUsername())
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_CREDENTIALS));

        if (!passwordEncoder.matches(req.getPassword(), account.getPassword())) {
            throw new AppException(ErrorCode.INVALID_CREDENTIALS);
        }

        if (account.getStatus() == AccountStatus.LOCKED) {
            throw new AppException(ErrorCode.ACCOUNT_LOCKED);
        }

        if (account.getStatus() == AccountStatus.INACTIVE || account.getStatus() == AccountStatus.DELETED) {
            throw new AppException(ErrorCode.ACCOUNT_INACTIVE);
        }

        String roleName = account.getRole() != null ? account.getRole().getName().name() : RoleType.CUSTOMER.name();
        String token = jwtProvider.generateToken(account.getUsername(), roleName, account.getId());

        return AuthRes.builder()
                .accessToken(token)
                .tokenType("Bearer")
                .expiresIn(jwtConfig.getExpirationMs() / 1000)
                .username(account.getUsername())
                .role(roleName)
                .build();
    }

    @Override
    @Transactional
    public AuthRes register(RegisterReq req) {
        if (accountRepository.existsByUsername(req.getUsername())) {
            throw new AppException(ErrorCode.USERNAME_ALREADY_EXISTS);
        }

        if (accountRepository.existsByEmail(req.getEmail())) {
            throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }

        if (userRepository.findByPhoneNumber(req.getPhoneNumber()).isPresent()) {
            throw new AppException(ErrorCode.PHONE_NUMBER_ALREADY_EXISTS);
        }

        Role customerRole = roleRepository.findByName(RoleType.CUSTOMER)
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));

        Account account = Account.builder()
                .username(req.getUsername())
                .password(passwordEncoder.encode(req.getPassword()))
                .email(req.getEmail())
                .role(customerRole)
                .status(AccountStatus.ACTIVE)
                .isDeleted(false)
                .build();

        account = accountRepository.save(account);

        Customer customer = Customer.builder()
                .firstName(req.getFirstName())
                .lastName(req.getLastName())
                .phoneNumber(req.getPhoneNumber())
                .gender(req.getGender())
                .accumulatePoint(0)
                .isDeleted(false)
                .build();

        userRepository.save(customer);

        String roleName = customerRole.getName().name();
        String token = jwtProvider.generateToken(account.getUsername(), roleName, account.getId());

        log.info("Khách hàng mới đã đăng ký thành công: username={}", account.getUsername());

        return AuthRes.builder()
                .accessToken(token)
                .tokenType("Bearer")
                .expiresIn(jwtConfig.getExpirationMs() / 1000)
                .username(account.getUsername())
                .role(roleName)
                .build();
    }

    @Override
    public AccountInfoRes getMyInfo(String username) {
        Account account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        return AccountInfoRes.builder()
                .id(account.getId())
                .username(account.getUsername())
                .email(account.getEmail())
                .role(account.getRole() != null ? account.getRole().getName() : null)
                .status(account.getStatus())
                .createdAt(account.getCreatedAt())
                .build();
    }
}
