package com.springboot.fasearch.common.enums;

/**
 * Loại xuất kho (bảng phieu_xuat_kho).
 */
public enum ExportType {
    DAMAGED,        // Xuất hủy hàng lỗi, hỏng, rách trong quá trình lưu trữ / vận chuyển
    TRANSFER,       // Xuất điều chuyển kho / chi nhánh
    OTHER           // Xuất kho khác (hàng mẫu, quà tặng, tài trợ...)
}
