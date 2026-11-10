package com.springboot.fasearch.modules.khuyenmai.service.interfaces;

import org.springframework.data.domain.PageRequest;

import com.springboot.fasearch.modules.khuyenmai.dto.request.CampaignCreateRequest;
import com.springboot.fasearch.modules.khuyenmai.dto.request.CampaignUpdateRequest;
import com.springboot.fasearch.modules.khuyenmai.dto.request.CodeCreateRequest;
import com.springboot.fasearch.modules.khuyenmai.dto.response.CampaignResponse;
import com.springboot.fasearch.modules.khuyenmai.dto.response.CodeResponse;
import com.springboot.fasearch.modules.khuyenmai.dto.response.PublicOfferRes;
import com.springboot.fasearch.shared.PageResponse;

public interface KhuyenMaiService {
    CampaignResponse create(CampaignCreateRequest request);
    CampaignResponse update(Long id, CampaignUpdateRequest request);
    CampaignResponse get(Long id);
    PageResponse<CampaignResponse> list(String status, String effectiveState, String type, String query, PageRequest page);

    default PageResponse<CampaignResponse> list(String status, String type, String query, PageRequest page) {
        return list(status, null, type, query, page);
    }
    CodeResponse createCode(Long id, CodeCreateRequest request);
    java.util.List<PublicOfferRes> listPublicOffers();
}
