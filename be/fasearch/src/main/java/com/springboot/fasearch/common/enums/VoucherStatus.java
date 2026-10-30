package com.springboot.fasearch.common.enums;

/**
 * Trạng thái của chiến dịch khuyến mãi hoặc mã voucher (bảng khuyen_mai, ma_giam_gia).
 */
public enum VoucherStatus {
    UPCOMING,        // Sắp diễn ra / Chưa tới thời gian bắt đầu
    ACTIVE,          // Đang có hiệu lực áp dụng
    EXPIRED,         // Đã hết hạn sử dụng
    DISABLED         // Bị tạm ngừng hoặc vô hiệu hóa thủ công bởi Admin
}
