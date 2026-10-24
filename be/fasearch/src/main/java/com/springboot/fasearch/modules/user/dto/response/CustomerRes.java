package com.springboot.fasearch.modules.user.dto.response;

import java.time.LocalDate;

import com.springboot.fasearch.common.enums.Gender;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Setter 
@Getter 
@Builder 
public class CustomerRes {
    private Long id;
    private String firstName;
    private String lastName; 
    private Gender gender;
    private String phoneNumber;
    private LocalDate dob;
    private Integer accumulatePoint;
}

