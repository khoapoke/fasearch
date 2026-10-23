package com.springboot.fasearch.modules.user.dto.response;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Setter 
@Getter 
@Builder 
public class UserResponse {
    private Long id;
    private String hoTen; // gộp họ và tên 
    private String sdt;
    private String email;
    private Integer diemTichLuy;
}
