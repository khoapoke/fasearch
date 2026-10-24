package com.springboot.fasearch.common.enums;

/**
 * Loại phiếu yêu cầu đổi/trả hàng (bảng phieu_doi_tra).
 */
public enum ReturnOrderType {
    EXCHANGE,        // Đổi sản phẩm sang kích cỡ, màu sắc hoặc mã SKU khác
    RETURN           // Trả hàng và hoàn tiền
}
