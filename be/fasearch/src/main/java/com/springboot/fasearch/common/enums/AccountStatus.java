package com.springboot.fasearch.common.enums;

/**
 * Trạng thái của tài khoản người dùng trong hệ thống (bảng tai_khoan).
 */
public enum AccountStatus {
    ACTIVE,      // Tài khoản đang hoạt động bình thường
    INACTIVE,    // Tài khoản chưa được kích hoạt
    LOCKED,      // Tài khoản bị tạm khóa (do vi phạm hoặc nhập sai mật khẩu nhiều lần)
    DELETED      // Tài khoản đã bị xóa mềm
}
