package com.springboot.fasearch.common.softdelete;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.security.SecurityUtils;

import lombok.RequiredArgsConstructor;

/**
 * Đóng dấu xóa mềm: người xóa lấy từ security context (không bao giờ lấy từ client),
 * thời điểm là lúc xóa, lý do do người dùng nhập và được cắt khoảng trắng, tối đa 255.
 */
@Component
@RequiredArgsConstructor
public class SoftDeleteRecorder {

    public static final int MAX_REASON_LENGTH = 255;

    private final AccountRepository accountRepository;

    public void mark(SoftDeletable target, String rawReason) {
        // Validate the reason before touching the row so a rejected request leaves no partial state.
        String reason = normalizeReason(rawReason);
        target.setIsDeleted(true);
        target.setDeletedAt(LocalDateTime.now());
        target.setDeleteReason(reason);
        target.setDeletedBy(currentAccount().orElse(null));
    }

    /** Đánh dấu một dòng con cùng lô xóa với dòng cha: cùng thời điểm, người và lý do. */
    public void markWithParent(SoftDeletable target, SoftDeletable parent) {
        target.setIsDeleted(true);
        target.setDeletedAt(parent.getDeletedAt());
        target.setDeleteReason(parent.getDeleteReason());
        target.setDeletedBy(parent.getDeletedBy());
    }

    public static String normalizeReason(String rawReason) {
        if (!StringUtils.hasText(rawReason)) {
            return null;
        }
        String trimmed = rawReason.trim();
        if (trimmed.length() > MAX_REASON_LENGTH) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Lý do xóa tối đa " + MAX_REASON_LENGTH + " ký tự.");
        }
        return trimmed;
    }

    private Optional<Account> currentAccount() {
        return SecurityUtils.getCurrentUsername().flatMap(accountRepository::findByUsername);
    }
}
