package com.springboot.fasearch.modules.auth.service.impl;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.springboot.fasearch.client.BrevoMailClient;
import com.springboot.fasearch.client.EmailTemplates;
import com.springboot.fasearch.client.EmailTemplates.MailMessage;
import com.springboot.fasearch.common.enums.AccountStatus;
import com.springboot.fasearch.common.enums.EmailTokenPurpose;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.entity.EmailToken;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.auth.repository.EmailTokenRepository;
import com.springboot.fasearch.modules.auth.service.interfaces.EmailTokenService;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Token email dung mot lan: luu SHA-256 hash, so sanh hang so khi doi chieu.
 * Cac endpoint cong khai tra phan hoi giong nhau du email co ton tai hay khong.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailTokenServiceImpl implements EmailTokenService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final AccountRepository accountRepository;
    private final EmailTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final BrevoMailClient mailClient;
    private final InMemoryRateLimiter rateLimiter;

    @Value("${app.frontend-base-url:http://127.0.0.1:3202}")
    private String frontendBaseUrl;

    @Value("${email.verify-token-hours:24}")
    private long verifyTokenHours;

    @Value("${email.reset-token-minutes:30}")
    private long resetTokenMinutes;

    @Override
    @Transactional
    public void requestPasswordReset(String email) {
        String normalized = email == null ? "" : email.trim().toLowerCase();
        rateLimiter.check("pwd-forgot:email:" + normalized, 5);
        rateLimiter.check("pwd-forgot:ip:" + currentIp(), 20);
        // Lam phang thoi gian xu ly du email co ton tai hay khong.
        dummyHash();
        accountRepository.findByEmail(normalized)
                .filter(a -> !Boolean.TRUE.equals(a.getIsDeleted()))
                .filter(a -> a.getStatus() == AccountStatus.ACTIVE)
                .ifPresent(account -> {
                    tokenRepository.invalidateActive(account.getId(), EmailTokenPurpose.RESET_PASSWORD);
                    String raw = createEmailToken(account.getId(), EmailTokenPurpose.RESET_PASSWORD);
                    sendResetMail(account, resetLink(raw));
                });
    }

    @Override
    @Transactional
    public void confirmPasswordReset(String token, String newPassword) {
        rateLimiter.check("pwd-reset:ip:" + currentIp(), 20);
        EmailToken emailToken = loadValidToken(token, EmailTokenPurpose.RESET_PASSWORD);
        Account account = emailToken.getAccount();
        if (Boolean.TRUE.equals(account.getIsDeleted()) || account.getStatus() != AccountStatus.ACTIVE) {
            throw new AppException(ErrorCode.EMAIL_TOKEN_INVALID);
        }
        account.setPassword(passwordEncoder.encode(newPassword));
        account.setTokenVersion(account.getTokenVersion() == null ? 1L : account.getTokenVersion() + 1);
        accountRepository.save(account);
        emailToken.setUsedAt(LocalDateTime.now());
        tokenRepository.save(emailToken);
        tokenRepository.invalidateActive(account.getId(), EmailTokenPurpose.RESET_PASSWORD);
        log.info("Dat lai mat khau qua email thanh cong: username={}", account.getUsername());
        try {
            sendPasswordChangedNotice(account.getId());
        } catch (Exception e) {
            log.warn("Khong gui duoc thong bao doi mat khau cho username={}: {}", account.getUsername(), e.getMessage());
        }
    }

    @Override
    @Transactional
    public void requestVerificationEmail(Long accountId) {
        rateLimiter.check("verify-req:account:" + accountId, 5);
        rateLimiter.check("verify-req:ip:" + currentIp(), 20);
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        if (account.getEmail() == null || account.getEmail().isBlank()) {
            throw new AppException(ErrorCode.EMAIL_ADDRESS_MISSING);
        }
        if (account.getEmailVerifiedAt() != null) {
            return;
        }
        tokenRepository.invalidateActive(account.getId(), EmailTokenPurpose.VERIFY_EMAIL);
        String raw = createEmailToken(account.getId(), EmailTokenPurpose.VERIFY_EMAIL);
        sendVerifyMail(account, verifyLink(raw));
    }

    @Override
    @Transactional
    public void confirmVerification(String token) {
        rateLimiter.check("verify:ip:" + currentIp(), 20);
        EmailToken emailToken = loadValidToken(token, EmailTokenPurpose.VERIFY_EMAIL);
        Account account = emailToken.getAccount();
        if (account.getEmailVerifiedAt() == null) {
            account.setEmailVerifiedAt(LocalDateTime.now());
            accountRepository.save(account);
        }
        emailToken.setUsedAt(LocalDateTime.now());
        tokenRepository.save(emailToken);
        tokenRepository.invalidateActive(account.getId(), EmailTokenPurpose.VERIFY_EMAIL);
        log.info("Xac thuc email thanh cong: username={}", account.getUsername());
    }

    @Override
    @Transactional
    public void sendPasswordChangedNotice(Long accountId) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        if (account.getEmail() == null || account.getEmail().isBlank()) {
            return;
        }
        MailMessage mail = EmailTemplates.passwordChanged(account.getUsername());
        mailClient.send(account.getEmail(), account.getUsername(), mail.subject(), mail.htmlContent(), mail.textContent());
    }

    @Override
    @Transactional
    public String createEmailToken(Long accountId, EmailTokenPurpose purpose) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        long minutes = purpose == EmailTokenPurpose.RESET_PASSWORD ? resetTokenMinutes : verifyTokenHours * 60;
        String raw = randomToken();
        EmailToken emailToken = EmailToken.builder()
                .tokenHash(sha256Hex(raw))
                .purpose(purpose)
                .account(account)
                .email(account.getEmail())
                .expiresAt(LocalDateTime.now().plusMinutes(minutes))
                .requestIp(currentIp())
                .build();
        tokenRepository.save(emailToken);
        return raw;
    }

    private EmailToken loadValidToken(String token, EmailTokenPurpose purpose) {
        String hash = token == null ? "" : sha256Hex(token.trim());
        EmailToken emailToken = tokenRepository.findByTokenHashAndPurpose(hash, purpose)
                .filter(t -> constantTimeEquals(t.getTokenHash(), hash))
                .orElseThrow(() -> new AppException(ErrorCode.EMAIL_TOKEN_INVALID));
        if (emailToken.getUsedAt() != null || emailToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new AppException(ErrorCode.EMAIL_TOKEN_INVALID);
        }
        return emailToken;
    }

    private void sendResetMail(Account account, String link) {
        try {
            MailMessage mail = EmailTemplates.resetPassword(account.getUsername(), link);
            mailClient.send(account.getEmail(), account.getUsername(),
                    mail.subject(), mail.htmlContent(), mail.textContent());
        } catch (Exception e) {
            // Nguoi dung van nhan phan hoi thanh cong chung; log de van hanh gui lai.
            log.error("Gui email dat lai mat khau that bai (username={}): {}", account.getUsername(), e.getMessage());
        }
    }

    private void sendVerifyMail(Account account, String link) {
        try {
            MailMessage mail = EmailTemplates.verifyEmail(account.getUsername(), link);
            mailClient.send(account.getEmail(), account.getUsername(),
                    mail.subject(), mail.htmlContent(), mail.textContent());
        } catch (Exception e) {
            log.error("Gui email xac thuc that bai (username={}): {}", account.getUsername(), e.getMessage());
        }
    }

    private String resetLink(String rawToken) {
        return base() + "/dat-lai-mat-khau?token=" + rawToken;
    }

    private String verifyLink(String rawToken) {
        return base() + "/xac-thuc-email?token=" + rawToken;
    }

    private String base() {
        return frontendBaseUrl.endsWith("/") ? frontendBaseUrl.substring(0, frontendBaseUrl.length() - 1) : frontendBaseUrl;
    }

    private static String randomToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String sha256Hex(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private static void dummyHash() {
        sha256Hex(randomToken());
    }

    private static boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(
                a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }

    static String currentIp() {
        try {
            ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                HttpServletRequest request = attrs.getRequest();
                String forwarded = request.getHeader("X-Forwarded-For");
                if (forwarded != null && !forwarded.isBlank()) {
                    return forwarded.split(",")[0].trim();
                }
                String remote = request.getRemoteAddr();
                if (remote != null && !remote.isBlank()) {
                    return remote;
                }
            }
        } catch (Exception e) {
            log.debug("Khong lay duoc IP request: {}", e.getMessage());
        }
        return "unknown";
    }
}
