package com.springboot.fasearch.modules.search.service.interfaces;

import org.springframework.web.multipart.MultipartFile;

import com.springboot.fasearch.modules.search.dto.request.TextSearchReq;
import com.springboot.fasearch.modules.search.dto.response.AiSearchRes;

public interface SearchService {

    /** Tải ảnh dataset (theo tên file) qua AI service để BE phục vụ lại cho FE. */
    com.springboot.fasearch.modules.search.client.FashionAiClient.DatasetImage downloadDatasetImage(
            String fileName);

    AiSearchRes searchByText(TextSearchReq req);

    AiSearchRes searchByImage(MultipartFile file, Integer limit);

    AiSearchRes searchMultimodal(MultipartFile file, String query, Integer limit, Float textWeight);
}

