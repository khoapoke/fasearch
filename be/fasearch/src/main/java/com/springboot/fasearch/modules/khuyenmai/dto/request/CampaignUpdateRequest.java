package com.springboot.fasearch.modules.khuyenmai.dto.request;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Set;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CampaignUpdateRequest {
    @NotNull @Min(0) private Long phienBan;
    @Size(max = 255) private String tenCtkm;
    private String loaiGiam;
    @DecimalMin("0.01") private BigDecimal giaTriGiam;
    private LocalDateTime ngayBatDau;
    private LocalDateTime ngayKetThuc;
    @Size(max = 1000) private String dieuKienApDung;
    private Set<@NotNull Long> maSpApDung;
    private String trangThai;
}
