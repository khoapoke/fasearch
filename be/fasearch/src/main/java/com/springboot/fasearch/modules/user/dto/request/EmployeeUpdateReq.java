package com.springboot.fasearch.modules.user.dto.request;

import java.time.LocalDate;

import com.springboot.fasearch.common.enums.Gender;

import jakarta.validation.constraints.Pattern;
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
public class EmployeeUpdateReq {

    @Size(max = 50, message = "Họ đệm không được vượt quá 50 ký tự")
    private String firstName;

    @Size(max = 50, message = "Tên không được vượt quá 50 ký tự")
    private String lastName;

    @Pattern(regexp = "^(0|\\+84)[0-9]{9}$", message = "Số điện thoại không đúng định dạng Việt Nam")
    private String phoneNumber;

    @Pattern(regexp = "^[0-9]{12}$", message = "CCCD phải đúng 12 chữ số")
    private String cccd;

    private Gender gender;

    private LocalDate dob;

    private String address;

    private Long accountId;
}
