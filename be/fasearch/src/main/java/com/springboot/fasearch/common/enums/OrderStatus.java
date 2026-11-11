package com.springboot.fasearch.common.enums;

/**
 * Trạng thái vòng đời của đơn hàng (bảng don_hang).
 */
public enum OrderStatus {
    DRAFT,           // Đơn tạm lưu tại quầy POS
    PENDING,         // Đơn hàng mới tạo, chờ xác nhận
    CONFIRMED,       // Đã xác nhận đơn hàng
    PACKING,         // Đang chuẩn bị / đóng gói hàng tại kho
    SHIPPING,        // Đang giao vận chuyển
    COMPLETED,       // Giao thành công và hoàn tất đơn hàng
    CANCELLED,       // Đơn hàng đã bị hủy
    RETURNED         // Đơn hàng đã hoàn trả toàn bộ
}
