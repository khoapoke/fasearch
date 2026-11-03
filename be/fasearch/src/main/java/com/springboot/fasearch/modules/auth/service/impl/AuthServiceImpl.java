package com.springboot.fasearch.modules.auth.service.impl;

import java.util.ArrayList;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.springboot.fasearch.common.enums.AccountStatus;
import com.springboot.fasearch.common.enums.RoleType;
import com.springboot.fasearch.config.JwtConfig;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.auth.dto.request.AccountCreateReq;
import com.springboot.fasearch.modules.auth.dto.request.AccountUpdateReq;
import com.springboot.fasearch.modules.auth.dto.request.LoginReq;
import com.springboot.fasearch.modules.auth.dto.request.RegisterReq;
import com.springboot.fasearch.modules.auth.dto.response.AccountInfoRes;
import com.springboot.fasearch.modules.auth.dto.response.AuthRes;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.entity.Role;
import com.springboot.fasearch.modules.auth.mapper.AccountMapper;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.auth.repository.RoleRepository;
import com.springboot.fasearch.modules.auth.service.interfaces.AuthService;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.repository.UserRepository;
import com.springboot.fasearch.security.JwtProvider;
import com.springboot.fasearch.shared.PageResponse;

import jakarta.persistence.criteria.Predicate;
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
    private final AccountMapper accountMapper;

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
        String token = jwtProvider.generateToken(account.getUsername(), roleName, account.getId(), account.getTokenVersion());

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
                .salesHistoryComplete(true)
                .account(account)
                .isDeleted(false)
                .build();

        userRepository.save(customer);

        String roleName = customerRole.getName().name();
        String token = jwtProvider.generateToken(account.getUsername(), roleName, account.getId(), account.getTokenVersion());

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
    @Transactional
    public void changePassword(String username, String oldPassword, String newPassword) {
        Account account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (!passwordEncoder.matches(oldPassword, account.getPassword())) {
            throw new AppException(ErrorCode.INVALID_CREDENTIALS, "Mật khẩu cũ không đúng");
        }

        if (oldPassword.equals(newPassword)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Mật khẩu mới phải khác mật khẩu cũ");
        }

        account.setPassword(passwordEncoder.encode(newPassword));
        account.setTokenVersion(account.getTokenVersion() == null ? 1L : account.getTokenVersion() + 1);
        accountRepository.save(account);
        log.info("Password changed successfully for account [{}]", username);
    }

    @Override
    public AccountInfoRes getMyInfo(String username) {
        Account account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        AccountInfoRes res = accountMapper.toAccountInfoResponse(account);
        // Bổ sung id hồ sơ khách hàng để client tự tra cứu chính mình mà không phải
        // đoán/hay dùng id tài khoản (hai id khác nhau).
        res.setCustomerId(userRepository.findByAccount_Username(username)
                .map(com.springboot.fasearch.modules.user.entity.Customer::getId).orElse(null));
        return res;
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AccountInfoRes> getAccounts(Pageable pageable, String keyword, RoleType role, AccountStatus status) {
        Specification<Account> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (StringUtils.hasText(keyword)) {
                String search = "%" + keyword.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("username")), search),
                        cb.like(cb.lower(root.get("email")), search)
                ));
            }

            if (role != null) {
                predicates.add(cb.equal(root.get("role").get("name"), role));
            }

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<Account> page = accountRepository.findAll(spec, pageable);
        Page<AccountInfoRes> resPage = page.map(accountMapper::toAccountInfoResponse);

        return PageResponse.from(resPage);
    }

    @Override
    @Transactional
    public AccountInfoRes createInternalAccount(AccountCreateReq req) {
        if (accountRepository.existsByUsername(req.getUsername())) {
            throw new AppException(ErrorCode.USERNAME_ALREADY_EXISTS);
        }

        if (accountRepository.existsByEmail(req.getEmail())) {
            throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }

        RoleType targetRoleType = req.getRole() != null ? req.getRole() : RoleType.STAFF;
        Role role = roleRepository.findByName(targetRoleType)
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));

        Account account = Account.builder()
                .username(req.getUsername())
                .password(passwordEncoder.encode(req.getPassword()))
                .email(req.getEmail())
                .role(role)
                .status(AccountStatus.ACTIVE)
                .isDeleted(false)
                .build();

        Account saved = accountRepository.save(account);
        log.info("Internal account created successfully with ID [{}] and role [{}]", saved.getId(), targetRoleType);

        return accountMapper.toAccountInfoResponse(saved);
    }

    @Override
    @Transactional
    public AccountInfoRes updateAccount(Long id, AccountUpdateReq req) {
        Account account = accountRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (StringUtils.hasText(req.getEmail()) && !req.getEmail().equals(account.getEmail())) {
            if (accountRepository.existsByEmail(req.getEmail())) {
                throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS);
            }
            account.setEmail(req.getEmail());
        }

        if (req.getStatus() != null) {
            account.setStatus(req.getStatus());
        }

        if (req.getRole() != null) {
            Role role = roleRepository.findByName(req.getRole())
                    .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
            account.setRole(role);
        }

        if (StringUtils.hasText(req.getNewPassword())) {
            account.setPassword(passwordEncoder.encode(req.getNewPassword()));
        }

        Account updated = accountRepository.save(account);
        log.info("Updated account ID [{}] successfully", id);

        return accountMapper.toAccountInfoResponse(updated);
    }

    @Override
    @Transactional
    public void deleteAccount(Long id) {
        Account account = accountRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        account.setIsDeleted(true);
        account.setStatus(AccountStatus.DELETED);
        accountRepository.save(account);

        log.info("Soft deleted account ID [{}]", id);
    }
}
