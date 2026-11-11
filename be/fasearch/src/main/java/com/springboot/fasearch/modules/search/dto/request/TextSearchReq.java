package com.springboot.fasearch.modules.search.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class TextSearchReq {

    @NotBlank(message = "Nội dung tìm kiếm không được để trống")
    private String query;

    @Min(value = 1, message = "Số lượng kết quả tối thiểu là 1")
    @Max(value = 24, message = "Số lượng kết quả tối đa là 24")
    @Builder.Default
    private Integer limit = 12;
}

