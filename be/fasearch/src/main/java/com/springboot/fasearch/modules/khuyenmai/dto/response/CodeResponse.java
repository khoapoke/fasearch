package com.springboot.fasearch.modules.khuyenmai.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CodeResponse {
    private Long maVoucher;
    private Long maKm;
    private String maCode;
    private Integer soLuongPhatHanh;
    private Integer daSuDung;
    private Integer soLuongGiuCho;
    private String trangThai;
}
