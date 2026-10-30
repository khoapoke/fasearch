package com.springboot.fasearch.modules.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
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
public class LoginReq {

    @NotBlank(message = "Username is required ")
    private String username;

    @NotBlank(message = "Password is requried")
    private String password;
}
