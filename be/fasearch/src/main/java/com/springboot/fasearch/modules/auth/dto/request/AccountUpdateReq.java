package com.springboot.fasearch.modules.auth.dto.request;

import com.springboot.fasearch.common.enums.AccountStatus;
import com.springboot.fasearch.common.enums.RoleType;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AccountUpdateReq {

    @Email(message = "Email không đúng định dạng")
    private String email;

    private AccountStatus status;

    private RoleType role;

    @Size(min = 6, message = "Mật khẩu mới phải có tối thiểu 6 ký tự")
    private String newPassword;
}
