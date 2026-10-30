package com.springboot.fasearch.modules.auth.dto.response;

import java.time.LocalDateTime;

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
    private String username;
    private String email;
    private RoleType role;
    private AccountStatus status;
    private LocalDateTime createdAt;
}
