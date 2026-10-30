package com.springboot.fasearch.common.enums;

/**
 * Loại phương thức thanh toán (bảng phuong_thuc_thanh_toan).
 */
public enum PaymentMethodType {
    CASH,            // Tiền mặt (tại quầy POS hoặc thanh toán khi nhận hàng COD)
    BANK_TRANSFER,   // Chuyển khoản ngân hàng trực tiếp
    E_WALLET,        // Ví điện tử chung
    VNPAY_QR,        // Quét mã VNPay QR
    MOMO             // Cổng / Ví điện tử MoMo
}
