package com.springboot.fasearch.modules.search.service.interfaces;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.springboot.fasearch.modules.search.dto.request.SearchHistoryReq;
import com.springboot.fasearch.modules.search.dto.response.SearchHistoryRes;

public interface SearchHistoryService {

    SearchHistoryRes record(String username, SearchHistoryReq req);

    Page<SearchHistoryRes> list(String username, Pageable pageable);

    void remove(String username, Long historyId);
}