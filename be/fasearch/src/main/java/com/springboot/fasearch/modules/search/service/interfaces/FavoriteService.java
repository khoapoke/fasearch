package com.springboot.fasearch.modules.search.service.interfaces;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.springboot.fasearch.modules.search.dto.response.FavoriteRes;

public interface FavoriteService {

    FavoriteRes add(String username, Long productId);

    void remove(String username, Long productId);

    Page<FavoriteRes> list(String username, Pageable pageable);
}