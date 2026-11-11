package com.springboot.fasearch.modules.publish;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.springboot.fasearch.modules.publish.service.interfaces.PublishService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class PublishEventListener {

    private final PublishService publishService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPublished(ProductPublishedEvent event) {
        try {
            publishService.reconcilePending(event.productId());
        } catch (RuntimeException e) {
            log.warn("AI sync deferred for product [{}]: {}", event.productId(), e.getMessage());
        }
    }
}
