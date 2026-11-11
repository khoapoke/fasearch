package com.springboot.fasearch.modules.auth.dto.response;

import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

import com.springboot.fasearch.common.enums.AccountStatus;
import com.springboot.fasearch.common.enums.RoleType;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AccountInfoRes {
    private Long id;

    /** Id hồ sơ khách hàng (khach_hang.ma_kh); null nếu tài khoản không có hồ sơ. */
    private Long customerId;
    private String username;
    private String email;
    private RoleType role;
    private AccountStatus status;
    private Boolean emailVerified;
    private LocalDateTime createdAt;

    /**
     * Chỉ có ở my-info: mã quyền hiệu lực của chính tài khoản (ADMIN: mọi mã; Quản lý: mã đang bật;
     * khách hàng: rỗng). Chỉ để FE ẩn/hiện; BE vẫn kiểm tra quyền ở từng endpoint.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private List<String> permissions;
}
