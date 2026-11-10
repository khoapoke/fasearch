package com.springboot.fasearch.modules.publish.service.interfaces;

import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

import com.springboot.fasearch.modules.publish.dto.request.AdminDraftCreateReq;
import com.springboot.fasearch.modules.publish.dto.request.AdminDraftUpdateReq;
import com.springboot.fasearch.modules.publish.dto.response.AdminDraftRes;
import com.springboot.fasearch.modules.publish.dto.response.AiSyncRes;
import com.springboot.fasearch.modules.publish.dto.response.PublishRes;
import com.springboot.fasearch.shared.PageResponse;

public interface PublishService {
    AdminDraftRes createDraft(AdminDraftCreateReq request);
    AdminDraftRes updateDraft(Long draftId, AdminDraftUpdateReq request);
    AdminDraftRes getDraft(Long draftId);
    PageResponse<AdminDraftRes> listDrafts(Pageable pageable, Long productId);
    void deleteDraft(Long draftId);
    String uploadDraftImage(Long draftId, MultipartFile file);
    PublishRes publishDraft(Long draftId, Long expectedVersion);
    PublishRes unpublishProduct(Long productId, String reason);
    AiSyncRes aiSyncState(Long productId);
    AiSyncRes retryAiSync(Long productId);
    void reconcilePending(Long productId);
    void markInterruptedRunsPending();
    AdminDraftRes importFromUrl(String url);
    byte[] readDraftImage(Long draftId, String fileName);
}
