package com.springboot.fasearch.modules.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VerifyEmailReq {

    @NotBlank(message = "Token không được để trống")
    private String token;
}
