package com.springboot.fasearch.modules.trash;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.trash.repository.TrashRepository;
import com.springboot.fasearch.modules.trash.service.impl.DeleteGuards;

/**
 * Điều kiện xóa: dữ liệu đã phát sinh giao dịch/tồn kho/phiếu kho thì chặn bằng 4xx rõ ràng,
 * dữ liệu sạch thì cho xóa mềm. Mỗi nhánh chặn đều được kiểm tra cả trường hợp được phép.
 */
@ExtendWith(MockitoExtension.class)
class DeleteGuardsTest {

    @Mock private TrashRepository trashRepository;
    @InjectMocks private DeleteGuards guards;

    private static AppException blocked(Runnable action) {
        return assertThrows(AppException.class, action::run);
    }

    /* --------------------------------- Sản phẩm -------------------------------- */

    @Test
    void productWithOrderLinesIsBlocked() {
        when(trashRepository.countOrderLinesForProduct(7L)).thenReturn(3L);
        AppException error = blocked(() -> guards.assertProductDeletable(7L));
        assertEquals(ErrorCode.DELETE_BLOCKED_BY_HISTORY, error.getErrorCode());
        assertTrue(error.getMessage().contains("3 dòng trong đơn hàng"));
        assertTrue(error.getMessage().contains("Ngừng kinh doanh"));
        assertEquals(409, error.getErrorCode().getHttpStatus().value());
    }

    @Test
    void productWithStockIsBlocked() {
        when(trashRepository.countStockForProduct(7L)).thenReturn(2L);
        AppException error = blocked(() -> guards.assertProductDeletable(7L));
        assertEquals(ErrorCode.DELETE_BLOCKED_BY_STOCK, error.getErrorCode());
        assertTrue(error.getMessage().contains("2 SKU"));
    }

    @Test
    void productOnReceiptsOrStocktakesIsBlocked() {
        when(trashRepository.countImportLinesForProduct(7L)).thenReturn(1L);
        when(trashRepository.countExportLinesForProduct(7L)).thenReturn(2L);
        when(trashRepository.countStocktakeLinesForProduct(7L)).thenReturn(4L);
        AppException error = blocked(() -> guards.assertProductDeletable(7L));
        assertEquals(ErrorCode.DELETE_BLOCKED_BY_REFERENCES, error.getErrorCode());
        assertTrue(error.getMessage().contains("7 dòng"));
    }

    @Test
    void productInPromotionScopeIsBlocked() {
        when(trashRepository.countPromotionEntriesForProduct(7L)).thenReturn(1L);
        AppException error = blocked(() -> guards.assertProductDeletable(7L));
        assertEquals(ErrorCode.DELETE_BLOCKED_BY_REFERENCES, error.getErrorCode());
        assertTrue(error.getMessage().contains("chiến dịch khuyến mãi"));
    }

    @Test
    void cleanProductIsAllowed() {
        assertDoesNotThrow(() -> guards.assertProductDeletable(7L));
    }

    /* --------------------------------- Biến thể -------------------------------- */

    @Test
    void variantWithOrderLinesIsBlocked() {
        when(trashRepository.countOrderLinesForVariant(11L)).thenReturn(1L);
        AppException error = blocked(() -> guards.assertVariantDeletable(11L));
        assertEquals(ErrorCode.DELETE_BLOCKED_BY_HISTORY, error.getErrorCode());
        assertTrue(error.getMessage().contains("SKU"));
    }

    @Test
    void variantWithStockIsBlocked() {
        when(trashRepository.countStockForVariant(11L)).thenReturn(1L);
        AppException error = blocked(() -> guards.assertVariantDeletable(11L));
        assertEquals(ErrorCode.DELETE_BLOCKED_BY_STOCK, error.getErrorCode());
    }

    @Test
    void variantOnReceiptsIsBlocked() {
        when(trashRepository.countExportLinesForVariant(11L)).thenReturn(2L);
        AppException error = blocked(() -> guards.assertVariantDeletable(11L));
        assertEquals(ErrorCode.DELETE_BLOCKED_BY_REFERENCES, error.getErrorCode());
    }

    @Test
    void variantOfPromotedProductIsBlocked() {
        when(trashRepository.countPromotionEntriesForVariant(11L)).thenReturn(1L);
        AppException error = blocked(() -> guards.assertVariantDeletable(11L));
        assertEquals(ErrorCode.DELETE_BLOCKED_BY_REFERENCES, error.getErrorCode());
        assertTrue(error.getMessage().contains("sản phẩm của SKU"));
    }

    @Test
    void cleanVariantIsAllowed() {
        assertDoesNotThrow(() -> guards.assertVariantDeletable(11L));
    }

    /* --------------------------------- Danh mục -------------------------------- */

    @Test
    void categoryWithProductsIncludingDeletedOnesIsBlocked() {
        when(trashRepository.countProductsInCategory(3L)).thenReturn(5L);
        AppException error = blocked(() -> guards.assertCategoryDeletable(3L));
        assertEquals(ErrorCode.DELETE_BLOCKED_BY_REFERENCES, error.getErrorCode());
        assertTrue(error.getMessage().contains("5 sản phẩm"));
        assertTrue(error.getMessage().contains("kể cả sản phẩm đã xóa"));
    }

    @Test
    void emptyCategoryIsAllowed() {
        assertDoesNotThrow(() -> guards.assertCategoryDeletable(3L));
    }

    /* -------------------------------- Khách hàng ------------------------------- */

    @Test
    void customerWithLedgerEntryIsBlockedEvenWithoutOrders() {
        when(trashRepository.countLedgerEntriesForCustomer(5L)).thenReturn(2L);
        AppException error = blocked(() -> guards.assertCustomerDeletable(5L));
        assertEquals(ErrorCode.DELETE_BLOCKED_BY_HISTORY, error.getErrorCode());
        assertTrue(error.getMessage().contains("2 bút toán điểm"));
    }

    @Test
    void customerWithOrdersInvoicesAndReturnsListsEveryCount() {
        when(trashRepository.countOrdersForCustomer(5L)).thenReturn(1L);
        when(trashRepository.countInvoicesForCustomer(5L)).thenReturn(1L);
        when(trashRepository.countReturnsForCustomer(5L)).thenReturn(1L);
        AppException error = blocked(() -> guards.assertCustomerDeletable(5L));
        assertEquals(ErrorCode.DELETE_BLOCKED_BY_HISTORY, error.getErrorCode());
        assertTrue(error.getMessage().contains("1 đơn hàng"));
        assertTrue(error.getMessage().contains("1 hóa đơn"));
        assertTrue(error.getMessage().contains("1 phiếu đổi trả"));
        assertTrue(error.getMessage().contains("bảo toàn lịch sử"));
    }

    @Test
    void untouchedCustomerIsAllowed() {
        assertDoesNotThrow(() -> guards.assertCustomerDeletable(5L));
    }

    /* -------------------------------- Tài khoản -------------------------------- */

    @Test
    void selfDeleteIsBlocked() {
        AppException error = blocked(() -> guards.assertAccountDeletable(9L, 9L));
        assertEquals(ErrorCode.DELETE_NOT_ALLOWED, error.getErrorCode());
        assertTrue(error.getMessage().contains("đang đăng nhập"));
    }

    @Test
    void accountWithLinkedProfileIsBlocked() {
        when(trashRepository.countEmployeeProfilesForAccount(9L)).thenReturn(1L);
        AppException error = blocked(() -> guards.assertAccountDeletable(9L, 1L));
        assertEquals(ErrorCode.DELETE_BLOCKED_BY_REFERENCES, error.getErrorCode());
        assertTrue(error.getMessage().contains("hồ sơ"));
    }

    @Test
    void lastActiveAdminIsBlocked() {
        when(trashRepository.countActiveAdminAccount(9L)).thenReturn(1L);
        when(trashRepository.countActiveAdmins()).thenReturn(1L);
        AppException error = blocked(() -> guards.assertAccountDeletable(9L, 1L));
        assertEquals(ErrorCode.DELETE_NOT_ALLOWED, error.getErrorCode());
        assertTrue(error.getMessage().contains("Quản trị viên"));
    }

    @Test
    void adminIsDeletableWhenAnotherActiveAdminExists() {
        when(trashRepository.countActiveAdminAccount(9L)).thenReturn(1L);
        when(trashRepository.countActiveAdmins()).thenReturn(2L);
        assertDoesNotThrow(() -> guards.assertAccountDeletable(9L, 1L));
    }

    @Test
    void nonAdminAccountSkipsLastAdminRule() {
        assertDoesNotThrow(() -> guards.assertAccountDeletable(9L, 1L));
    }
}
