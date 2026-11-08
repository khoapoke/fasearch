package com.springboot.fasearch.modules.trash.service.impl;

import org.springframework.stereotype.Component;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.trash.repository.TrashRepository;

import lombok.RequiredArgsConstructor;

/**
 * Điều kiện xóa nghiệp vụ, chạy bên trong transaction xóa.
 *
 * <p>Dữ liệu đã phát sinh giao dịch (đơn, hóa đơn, điểm, phiếu kho, kiểm kê, khuyến mãi)
 * thì không xóa: chỉ chuyển trạng thái (ví dụ "Ngừng kinh doanh") để giữ lịch sử.
 * Mọi thông báo viết cho nhân viên, nêu rõ số dòng đang chặn và việc cần làm.
 */
@Component
@RequiredArgsConstructor
public class DeleteGuards {

    private static final String USE_DISCONTINUED =
            "Hãy dùng \"Ngừng kinh doanh\" để ngừng bán mà vẫn giữ lịch sử.";
    /** Mid-sentence form ("..., hoặc dùng ..."): no capital letter after the comma. */
    private static final String OR_USE_DISCONTINUED =
            "dùng \"Ngừng kinh doanh\" để ngừng bán mà vẫn giữ lịch sử.";

    private final TrashRepository trashRepository;

    public void assertProductDeletable(Long productId) {
        long orderLines = trashRepository.countOrderLinesForProduct(productId);
        if (orderLines > 0) {
            throw blocked(ErrorCode.DELETE_BLOCKED_BY_HISTORY,
                    "Không thể xóa sản phẩm vì đã có " + orderLines + " dòng trong đơn hàng. " + USE_DISCONTINUED);
        }

        long stockLines = trashRepository.countStockForProduct(productId);
        if (stockLines > 0) {
            throw blocked(ErrorCode.DELETE_BLOCKED_BY_STOCK,
                    "Không thể xóa sản phẩm vì còn " + stockLines
                            + " SKU đang có tồn kho vật lý hoặc giữ chỗ. Hãy xuất kho hết trước, hoặc " + OR_USE_DISCONTINUED);
        }

        long receiptLines = trashRepository.countImportLinesForProduct(productId)
                + trashRepository.countExportLinesForProduct(productId)
                + trashRepository.countStocktakeLinesForProduct(productId);
        if (receiptLines > 0) {
            throw blocked(ErrorCode.DELETE_BLOCKED_BY_REFERENCES,
                    "Không thể xóa sản phẩm vì đã có " + receiptLines
                            + " dòng trên phiếu nhập, phiếu xuất hoặc phiếu kiểm kê. " + USE_DISCONTINUED);
        }

        long promotions = trashRepository.countPromotionEntriesForProduct(productId);
        if (promotions > 0) {
            throw blocked(ErrorCode.DELETE_BLOCKED_BY_REFERENCES,
                    "Không thể xóa sản phẩm vì đang nằm trong " + promotions
                            + " chiến dịch khuyến mãi. Hãy gỡ khỏi chiến dịch trước, hoặc " + OR_USE_DISCONTINUED);
        }
    }

    public void assertVariantDeletable(Long skuId) {
        long orderLines = trashRepository.countOrderLinesForVariant(skuId);
        if (orderLines > 0) {
            throw blocked(ErrorCode.DELETE_BLOCKED_BY_HISTORY,
                    "Không thể xóa SKU vì đã có " + orderLines + " dòng trong đơn hàng. " + USE_DISCONTINUED);
        }

        long stockLines = trashRepository.countStockForVariant(skuId);
        if (stockLines > 0) {
            throw blocked(ErrorCode.DELETE_BLOCKED_BY_STOCK,
                    "Không thể xóa SKU vì còn tồn kho vật lý hoặc giữ chỗ. Hãy xuất kho hết trước.");
        }

        long receiptLines = trashRepository.countImportLinesForVariant(skuId)
                + trashRepository.countExportLinesForVariant(skuId)
                + trashRepository.countStocktakeLinesForVariant(skuId);
        if (receiptLines > 0) {
            throw blocked(ErrorCode.DELETE_BLOCKED_BY_REFERENCES,
                    "Không thể xóa SKU vì đã có " + receiptLines
                            + " dòng trên phiếu nhập, phiếu xuất hoặc phiếu kiểm kê.");
        }

        long promotions = trashRepository.countPromotionEntriesForVariant(skuId);
        if (promotions > 0) {
            throw blocked(ErrorCode.DELETE_BLOCKED_BY_REFERENCES,
                    "Không thể xóa SKU vì sản phẩm của SKU đang nằm trong " + promotions
                            + " chiến dịch khuyến mãi. Hãy gỡ khỏi chiến dịch trước.");
        }
    }

    public void assertCategoryDeletable(Long categoryId) {
        long products = trashRepository.countProductsInCategory(categoryId);
        if (products > 0) {
            throw blocked(ErrorCode.DELETE_BLOCKED_BY_REFERENCES,
                    "Không thể xóa danh mục vì còn " + products
                            + " sản phẩm (kể cả sản phẩm đã xóa) đang tham chiếu. Hãy chuyển sản phẩm sang danh mục khác trước.");
        }
    }

    public void assertCustomerDeletable(Long customerId) {
        long orders = trashRepository.countOrdersForCustomer(customerId);
        long invoices = trashRepository.countInvoicesForCustomer(customerId);
        long ledgerEntries = trashRepository.countLedgerEntriesForCustomer(customerId);
        long returns = trashRepository.countReturnsForCustomer(customerId);
        if (orders + invoices + ledgerEntries + returns == 0) {
            return;
        }
        StringBuilder detail = new StringBuilder();
        appendCount(detail, orders, "đơn hàng");
        appendCount(detail, invoices, "hóa đơn");
        appendCount(detail, ledgerEntries, "bút toán điểm");
        appendCount(detail, returns, "phiếu đổi trả");
        throw blocked(ErrorCode.DELETE_BLOCKED_BY_HISTORY,
                "Không thể xóa khách hàng vì đã có " + detail
                        + ". Hồ sơ này cần được giữ để bảo toàn lịch sử mua hàng.");
    }

    public void assertAccountDeletable(Long accountId, Long currentAccountId) {
        if (currentAccountId != null && currentAccountId.equals(accountId)) {
            throw blocked(ErrorCode.DELETE_NOT_ALLOWED,
                    "Không thể xóa tài khoản đang đăng nhập. Hãy dùng một tài khoản Quản trị viên khác.");
        }

        long profiles = trashRepository.countEmployeeProfilesForAccount(accountId)
                + trashRepository.countCustomerProfilesForAccount(accountId);
        if (profiles > 0) {
            throw blocked(ErrorCode.DELETE_BLOCKED_BY_REFERENCES,
                    "Không thể xóa tài khoản vì còn " + profiles
                            + " hồ sơ nhân sự hoặc khách hàng liên kết. Hãy xử lý hồ sơ trước.");
        }

        if (trashRepository.countActiveAdminAccount(accountId) > 0
                && trashRepository.countActiveAdmins() <= 1) {
            throw blocked(ErrorCode.DELETE_NOT_ALLOWED,
                    "Không thể xóa Quản trị viên đang hoạt động cuối cùng của hệ thống.");
        }
    }

    private static void appendCount(StringBuilder detail, long count, String unit) {
        if (count <= 0) {
            return;
        }
        if (detail.length() > 0) {
            detail.append(", ");
        }
        detail.append(count).append(' ').append(unit);
    }

    private static AppException blocked(ErrorCode code, String message) {
        return new AppException(code, message);
    }
}
