package com.springboot.fasearch.modules.search.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.springboot.fasearch.modules.search.entity.SearchHistory;

public interface SearchHistoryRepository extends JpaRepository<SearchHistory, Long> {

    Page<SearchHistory> findByAccount_IdOrderByOccurredAtDesc(Long accountId, Pageable pageable);

    @Query("SELECT sh FROM SearchHistory sh WHERE sh.account.id = :accountId AND sh.id = :historyId")
    SearchHistory findByAccountAndId(@Param("accountId") Long accountId, @Param("historyId") Long historyId);
}