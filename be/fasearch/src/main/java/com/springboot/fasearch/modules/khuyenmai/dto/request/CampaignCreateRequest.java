package com.springboot.fasearch.modules.khuyenmai.dto.request;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Set;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CampaignCreateRequest {
    @NotBlank @Size(max = 255) private String tenCtkm;
    @NotBlank private String loaiGiam;
    @NotNull @DecimalMin("0.01") private BigDecimal giaTriGiam;
    @NotNull private LocalDateTime ngayBatDau;
    @NotNull private LocalDateTime ngayKetThuc;
    @Size(max = 1000) private String dieuKienApDung;
    private Set<@NotNull Long> maSpApDung;
}
