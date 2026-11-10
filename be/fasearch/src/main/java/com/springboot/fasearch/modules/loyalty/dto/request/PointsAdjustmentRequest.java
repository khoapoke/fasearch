package com.springboot.fasearch.modules.loyalty.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Manual point adjustment. {@code requestId} makes a double submit idempotent. */
@Getter
@Setter
@NoArgsConstructor
public class PointsAdjustmentRequest {
    /** Signed, non-zero whole number of points. */
    @NotNull
    private Integer delta;

    /** BOI_THUONG, DIEU_CHINH_SAI_SOT, TANG_THEM, HOAN_DON or KHAC. */
    @NotBlank
    @Size(max = 30)
    private String reasonCode;

    @Size(max = 500)
    private String note;

    @NotBlank
    @Size(min = 8, max = 36)
    @Pattern(regexp = "[A-Za-z0-9-]+")
    private String requestId;
}
