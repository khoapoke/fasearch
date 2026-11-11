package com.springboot.fasearch.modules.trash;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

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

import com.springboot.fasearch.common.softdelete.SoftDeleteRecorder;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.product.entity.Category;

/**
 * Người xóa luôn lấy từ security context (không bao giờ từ client), thời điểm là lúc xóa,
 * lý do được cắt khoảng trắng và giới hạn 255 ký tự.
 */
@ExtendWith(MockitoExtension.class)
class SoftDeleteRecorderTest {

    @Mock private AccountRepository accountRepository;
    @InjectMocks private SoftDeleteRecorder recorder;

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private void signIn(String username) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                username, "n/a", com.springboot.fasearch.security.TestAuthorities.forRole("STAFF")));
    }

    @Test
    void recordsActorFromSecurityContextNotFromTheRequest() {
        Account actor = Account.builder().id(42L).username("chapter5_admin").build();
        when(accountRepository.findByUsername("chapter5_admin")).thenReturn(Optional.of(actor));
        signIn("chapter5_admin");
        Category category = Category.builder().id(3L).categoryName("Áo").isDeleted(false).build();

        recorder.mark(category, "  Trùng danh mục  ");

        assertEquals(true, category.getIsDeleted());
        assertNotNull(category.getDeletedAt());
        assertEquals(actor, category.getDeletedBy());
        assertEquals("Trùng danh mục", category.getDeleteReason());
    }

    @Test
    void noAuthenticatedActorLeavesDeletedByNull() {
        Category category = Category.builder().id(3L).categoryName("Áo").isDeleted(false).build();

        recorder.mark(category, null);

        assertNull(category.getDeletedBy());
        assertNull(category.getDeleteReason());
        assertNotNull(category.getDeletedAt());
    }

    @Test
    void reasonIsTrimmedAndBlankBecomesNull() {
        Category category = Category.builder().id(3L).categoryName("Áo").isDeleted(false).build();

        recorder.mark(category, "   ");

        assertNull(category.getDeleteReason());
    }

    @Test
    void reasonLongerThan255IsRejectedInVietnamese() {
        Category category = Category.builder().id(3L).categoryName("Áo").isDeleted(false).build();

        AppException error = assertThrows(AppException.class, () -> recorder.mark(category, "x".repeat(256)));
        assertEquals(ErrorCode.INVALID_REQUEST, error.getErrorCode());
        assertTrue(error.getMessage().contains("255"));
        assertEquals(false, category.getIsDeleted());
    }

    @Test
    void reasonAt255IsAccepted() {
        Category category = Category.builder().id(3L).categoryName("Áo").isDeleted(false).build();

        recorder.mark(category, "y".repeat(255));

        assertEquals(255, category.getDeleteReason().length());
    }
}
