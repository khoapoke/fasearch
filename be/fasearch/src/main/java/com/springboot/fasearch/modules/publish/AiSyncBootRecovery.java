package com.springboot.fasearch.modules.publish;

import java.util.List;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.modules.publish.entity.AiSyncStatus;
import com.springboot.fasearch.modules.publish.entity.ProductAiSync;
import com.springboot.fasearch.modules.publish.repository.ProductAiSyncRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class AiSyncBootRecovery implements ApplicationRunner {

    private final ProductAiSyncRepository aiSyncRepository;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<ProductAiSync> stuck = aiSyncRepository.findByStatus(AiSyncStatus.RUNNING);
        for (ProductAiSync sync : stuck) {
            sync.setStatus(AiSyncStatus.PENDING);
            sync.setLastError("Worker interrupted; re-queued on boot");
            aiSyncRepository.save(sync);
        }
        if (!stuck.isEmpty()) {
            log.info("Re-queued {} interrupted AI sync job(s)", stuck.size());
        }
    }
}
