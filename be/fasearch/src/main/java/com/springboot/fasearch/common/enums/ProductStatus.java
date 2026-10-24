package com.springboot.fasearch.common.enums;

/**
 * Trạng thái kinh doanh của sản phẩm (bảng san_pham).
 */
public enum ProductStatus {
    DRAFT,           // Bản nháp, chưa công khai
    ACTIVE,          // Đang kinh doanh và hiển thị bán
    OUT_OF_STOCK,    // Tạm hết hàng tồn kho
    DISCONTINUED     // Ngừng kinh doanh hoàn toàn
}
