package com.springboot.fasearch.modules.khuyenmai.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CodeCreateRequest {
    @NotBlank @Size(max = 50) private String maCode;
    @Min(1) private Integer soLuongPhatHanh;
}
