package com.springboot.fasearch.modules.khuyenmai.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CampaignResponse {
    private Long maKm;
    private String tenCtkm;
    private String loaiGiam;
    private BigDecimal giaTriGiam;
    private LocalDateTime ngayBatDau;
    private LocalDateTime ngayKetThuc;
    private String dieuKienApDung;
    private String trangThai;
    private Long phienBan;
    private List<Long> maSpApDung;
    private List<CodeResponse> codes;
}
