package com.springboot.fasearch.modules.search.dto.response;

import java.time.LocalDateTime;

import com.springboot.fasearch.common.enums.SearchMode;
import com.springboot.fasearch.common.enums.SearchStatus;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
public class SearchHistoryRes {

    private Long id;

    private SearchMode mode;

    private String query;

    private Integer resultCount;

    private String resultRefs;

    private SearchStatus status;

    private LocalDateTime occurredAt;
}