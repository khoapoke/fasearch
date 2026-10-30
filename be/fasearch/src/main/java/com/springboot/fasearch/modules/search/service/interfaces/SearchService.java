package com.springboot.fasearch.modules.search.service.interfaces;

import org.springframework.web.multipart.MultipartFile;

import com.springboot.fasearch.modules.search.dto.request.TextSearchReq;
import com.springboot.fasearch.modules.search.dto.response.AiSearchRes;

public interface SearchService {

    AiSearchRes searchByText(TextSearchReq req);

    AiSearchRes searchByImage(MultipartFile file, Integer limit);

    AiSearchRes searchMultimodal(MultipartFile file, String query, Integer limit, Float textWeight);
}

