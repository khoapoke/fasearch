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
public class CustomerRes {

    private Long id;
    private String firstName;
    private String lastName;
    private Gender gender;
    private String phoneNumber;
    private LocalDate dob;
    private String address;
    private Integer accumulatePoint;
    private Long tierId;
    private String tierName;
    @JsonInclude(JsonInclude.Include.ALWAYS)
    private java.math.BigDecimal cumulativePaidSales;
    @JsonInclude(JsonInclude.Include.ALWAYS)
    private Long salesTierId;
    @JsonInclude(JsonInclude.Include.ALWAYS)
    private String salesTierName;
    @JsonInclude(JsonInclude.Include.ALWAYS)
    private String salesTierStatus;
    private Double deliveryLatitude;
    private Double deliveryLongitude;

}
