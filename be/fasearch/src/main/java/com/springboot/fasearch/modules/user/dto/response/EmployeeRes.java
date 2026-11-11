package com.springboot.fasearch.modules.user.dto.response;

import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.springboot.fasearch.common.enums.Gender;

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
@JsonInclude(JsonInclude.Include.NON_NULL)
public class EmployeeRes {

    private Long id;
    private String firstName;
    private String lastName;
    private String avatar;
    private Gender gender;
    private String phoneNumber;
    private String cccd;
    private LocalDate dob;
    private String address;
    private Long accountId;
    private String username;
    private String role;
}
