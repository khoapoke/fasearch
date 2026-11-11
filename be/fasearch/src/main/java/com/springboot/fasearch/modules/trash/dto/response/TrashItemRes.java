package com.springboot.fasearch.modules.trash.dto.response;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Một dòng trong thùng rác: đủ thông tin để nhân viên nhận ra và quyết định khôi phục. */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrashItemRes {

    private Long id;
    private String name;
    private String status;
    private String publicationStatus;

    /** Chỉ có ở tab biến thể. */
    private Long productId;
    private String productName;
    private String color;
    private String size;
    private String barcode;
    private boolean parentDeleted;

    /** Chỉ có ở tab khách hàng và nhân sự: số điện thoại như danh sách hiện có. */
    private String phone;
    /** Chỉ có ở tab tài khoản: email như danh sách tài khoản hiện có. */
    private String email;
    /** Chỉ có ở tab tài khoản: vai trò hiện tại của tài khoản. */
    private String role;
    /** Tab khách hàng/nhân sự: tài khoản đăng nhập liên kết và trạng thái của nó (nếu có). */
    private String linkedUsername;
    private String linkedAccountStatus;

    private LocalDateTime deletedAt;
    /** Tên người xóa; null khi dòng cũ chưa có thông tin (hiển thị "Không rõ"). */
    private String deletedBy;
    private String deleteReason;
}
