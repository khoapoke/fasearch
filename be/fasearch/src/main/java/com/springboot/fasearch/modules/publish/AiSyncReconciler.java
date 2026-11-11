package com.springboot.fasearch.modules.publish;

import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.springboot.fasearch.modules.publish.entity.AiSyncStatus;
import com.springboot.fasearch.modules.publish.entity.ProductAiSync;
import com.springboot.fasearch.modules.publish.repository.ProductAiSyncRepository;
import com.springboot.fasearch.modules.publish.service.interfaces.PublishService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Durable AI reconciliation: PENDING rows are retried on a timer, so a lost
 * after-commit event or an AI outage still converges without a restart.
 */
@Slf4j
@Component
@EnableScheduling
@RequiredArgsConstructor
public class AiSyncReconciler {

    private final ProductAiSyncRepository aiSyncRepository;
    private final PublishService publishService;

    @Scheduled(fixedDelayString = "${publish.ai.reconcile-interval-ms:20000}",
            initialDelayString = "${publish.ai.reconcile-initial-delay-ms:15000}")
    public void reconcilePendingJobs() {
        for (ProductAiSync sync : aiSyncRepository.findTop20ByStatusOrderByUpdatedAtAsc(AiSyncStatus.PENDING)) {
            try {
                publishService.reconcilePending(sync.getProductId());
            } catch (RuntimeException e) {
                log.warn("Periodic AI reconcile skipped product [{}]: {}", sync.getProductId(), e.getMessage());
            }
        }
    }
}
