package com.springboot.fasearch.modules.user.dto.request;

import java.time.LocalDate;

import com.springboot.fasearch.common.enums.Gender;

import jakarta.validation.constraints.NotBlank;
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
public class CustomerCreateReq {

    @Size(max = 50, message = "Họ đệm không được vượt quá 50 ký tự")
    private String firstName;

    @NotBlank(message = "Tên khách hàng không được để trống")
    @Size(max = 50, message = "Tên không được vượt quá 50 ký tự")
    private String lastName;

    @NotBlank(message = "Số điện thoại không được để trống")
    @Pattern(regexp = "^(0|\\+84)[0-9]{9}$", message = "Số điện thoại không đúng định dạng Việt Nam")
    private String phoneNumber;

    private Gender gender;

    private LocalDate dob;

    private String address;
}
