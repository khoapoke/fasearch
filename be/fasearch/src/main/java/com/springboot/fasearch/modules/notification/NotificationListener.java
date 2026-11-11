package com.springboot.fasearch.modules.notification;

import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.*;
import com.springboot.fasearch.modules.returns.ReturnService;
import com.springboot.fasearch.modules.publish.ProductPublishedEvent;

/** Listener only wakes a bounded worker; committed database signals survive process failures. */
@Slf4j
@Component
public class NotificationListener {
    private final NotificationWorker worker;
    private final boolean enabled;
    private final AtomicBoolean queued=new AtomicBoolean();
    private final ExecutorService executor=Executors.newSingleThreadExecutor(r->{Thread t=new Thread(r,"notification-worker");t.setDaemon(true);return t;});
    public NotificationListener(NotificationWorker worker,@Value("${notifications.worker-enabled:true}") boolean enabled) {this.worker=worker;this.enabled=enabled;}
    @TransactionalEventListener(phase=TransactionPhase.AFTER_COMMIT)
    public void order(NotificationEvents.OrderChanged event) {wake();}
    @TransactionalEventListener(phase=TransactionPhase.AFTER_COMMIT)
    public void returned(ReturnService.ReturnChanged event) {wake();}
    @TransactionalEventListener(phase=TransactionPhase.AFTER_COMMIT)
    public void published(ProductPublishedEvent event) {wake();}
    @Scheduled(fixedDelayString="${notifications.poll-ms:5000}",initialDelayString="${notifications.initial-delay-ms:10000}")
    public void poll() {wake();}
    public void wake() {
        if(!enabled || !queued.compareAndSet(false,true)) return;
        try {executor.execute(()->{try {worker.runBatch();}catch(RuntimeException e){log.warn("Notification worker deferred ({})",e.getClass().getSimpleName());}finally{queued.set(false);}});}
        catch(RejectedExecutionException e) {queued.set(false);}
    }
    @PreDestroy public void close() {executor.shutdownNow();}
}
