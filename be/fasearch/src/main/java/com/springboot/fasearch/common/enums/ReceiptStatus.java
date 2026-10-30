package com.springboot.fasearch.common.enums;

/**
 * Trạng thái của phiếu nhập / xuất kho (bảng phieu_nhap_kho).
 */
public enum ReceiptStatus {
    PENDING,        // Đang chờ xử lý / chờ nhập
    COMPLETED,      // Đã hoàn tất và cộng/trừ tồn kho thành công
    CANCELLED       // Đã bị hủy bỏ
}
