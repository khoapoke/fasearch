package com.springboot.fasearch.modules.review.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class ReviewVisibilityReq {
    @NotNull(message = "Thiếu trạng thái ẩn/hiện")
    private Boolean hidden;

    @Size(max = 255, message = "Lý do tối đa 255 ký tự")
    private String reason;
}
