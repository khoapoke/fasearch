package com.springboot.fasearch.common.enums;

/**
 * Trạng thái thanh toán của hóa đơn / giao dịch thanh toán (bảng hoa_don, thanh_toan).
 */
public enum PaymentStatus {
    PENDING,         // Chờ thanh toán
    PAID,            // Đã thanh toán thành công
    FAILED,          // Giao dịch thanh toán thất bại
    REFUNDED         // Đã hoàn tiền lại cho khách hàng
} 
