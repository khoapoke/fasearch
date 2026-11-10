package com.springboot.fasearch.modules.auth.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ForgotPasswordReq {

    @NotBlank(message = "Email không được để trống")
    @Email(message = "Email chưa đúng định dạng")
    private String email;
}
