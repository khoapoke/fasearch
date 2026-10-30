package com.springboot.fasearch.common.enums;

/**
 * Trạng thái xử lý của phiếu yêu cầu đổi/trả hàng (bảng phieu_doi_tra).
 */
public enum ReturnOrderStatus {
    PENDING,         // Yêu cầu mới tạo, chờ nhân viên thẩm định
    APPROVED,        // Đã chấp thuận yêu cầu đổi/trả
    REJECTED,        // Bị từ chối (do quá hạn, lỗi khách hàng, mất tem mác...)
    PROCESSED,       // Đang xử lý đổi hàng / hoàn tiền / nhập kho thu hồi
    COMPLETED        // Đã hoàn tất toàn bộ quy trình đổi trả
}
