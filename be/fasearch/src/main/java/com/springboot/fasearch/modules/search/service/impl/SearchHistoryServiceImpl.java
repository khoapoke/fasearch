package com.springboot.fasearch.modules.search.service.impl;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.common.enums.SearchMode;
import com.springboot.fasearch.common.enums.SearchStatus;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.search.dto.request.SearchHistoryReq;
import com.springboot.fasearch.modules.search.dto.response.SearchHistoryRes;
import com.springboot.fasearch.modules.search.entity.SearchHistory;
import com.springboot.fasearch.modules.search.repository.SearchHistoryRepository;
import com.springboot.fasearch.modules.search.service.interfaces.SearchHistoryService;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SearchHistoryServiceImpl implements SearchHistoryService {

    private final SearchHistoryRepository searchHistoryRepository;
    private final AccountRepository accountRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    @Transactional
    public SearchHistoryRes record(String username, SearchHistoryReq req) {
        Account account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        SearchMode mode = req.getMode();
        SearchStatus status = req.getStatus();

        if (mode == null || status == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Chế độ và trạng thái tìm kiếm là bắt buộc");
        }

        // Only record after actual search response; no fake success for failed/cancelled
        if (status == SearchStatus.SUCCESS && (req.getResultCount() == null || req.getResultCount() < 0)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Kết quả tìm kiếm không hợp lệ");
        }

        // Validate resultRefs: must be valid JSON array of safe bounded references
        String validatedRefs = validateResultRefs(req.getResultRefs());

        SearchHistory history = SearchHistory.builder()
                .account(account)
                .mode(mode)
                .query(req.getQuery())
                .resultCount(req.getResultCount() != null ? req.getResultCount() : 0)
                .resultRefs(validatedRefs)
                .status(status)
                .build();

        history = searchHistoryRepository.save(history);

        return SearchHistoryRes.builder()
                .id(history.getId())
                .mode(history.getMode())
                .query(history.getQuery())
                .resultCount(history.getResultCount())
                .resultRefs(history.getResultRefs())
                .status(history.getStatus())
                .occurredAt(history.getOccurredAt())
                .build();
    }

    private String validateResultRefs(String resultRefs) {
        if (resultRefs == null || resultRefs.isBlank()) {
            return null;
        }
        // Size cap: max 4096 chars
        if (resultRefs.length() > 4096) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Tham chiếu kết quả vượt quá giới hạn cho phép");
        }
        // Reject data URLs, raw files, internal paths, secrets
        String lower = resultRefs.toLowerCase();
        if (lower.contains("data:") || lower.contains("base64") || lower.contains("file://")
                || lower.contains("/etc/") || lower.contains("/proc/") || lower.contains("secret")
                || lower.contains("password") || lower.contains("token")) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Tham chiếu kết quả chứa nội dung không an toàn");
        }
        // Must be valid JSON array of strings
        try {
            List<String> refs = objectMapper.readValue(resultRefs, new TypeReference<List<String>>() {});
            if (refs.size() > 24) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Số lượng tham chiếu kết quả không được vượt quá 24");
            }
            for (String ref : refs) {
                if (ref == null || ref.isBlank() || ref.length() > 256) {
                    throw new AppException(ErrorCode.INVALID_REQUEST, "Tham chiếu kết quả không hợp lệ");
                }
            }
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Tham chiếu kết quả phải là mảng JSON hợp lệ");
        }
        return resultRefs;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<SearchHistoryRes> list(String username, Pageable pageable) {
        Account account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        return searchHistoryRepository.findByAccount_IdOrderByOccurredAtDesc(account.getId(), pageable)
                .map(h -> SearchHistoryRes.builder()
                        .id(h.getId())
                        .mode(h.getMode())
                        .query(h.getQuery())
                        .resultCount(h.getResultCount())
                        .resultRefs(h.getResultRefs())
                        .status(h.getStatus())
                        .occurredAt(h.getOccurredAt())
                        .build());
    }

    @Override
    @Transactional
    public void remove(String username, Long historyId) {
        Account account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        SearchHistory history = searchHistoryRepository.findByAccountAndId(account.getId(), historyId);
        if (history == null) {
            throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Lịch sử tìm kiếm không tồn tại");
        }

        history.setIsDeleted(true);
        searchHistoryRepository.save(history);
    }
}