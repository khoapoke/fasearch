package com.springboot.fasearch.modules.audit;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.*;

/** Bind the authenticated actor to the SAME DB transaction, including JPA flush at commit.
 * PostgreSQL SET LOCAL resets on commit/rollback and cannot leak through the connection pool. */
@Configuration
public class AuditTransactionConfig {
    @Bean
    InitializingBean auditTransactionActor(PlatformTransactionManager manager, JdbcTemplate db) {
        return () -> {
            if (!(manager instanceof ConfigurableTransactionManager configurable)) {
                throw new IllegalStateException("Không thể cấu hình nhật ký giao dịch.");
            }
            configurable.addListener(new TransactionExecutionListener() {
                @Override public void afterBegin(TransactionExecution transaction, Throwable failure) {
                    if (failure != null || transaction.isReadOnly()) return;
                    var auth = SecurityContextHolder.getContext().getAuthentication();
                    String actor = auth != null && auth.isAuthenticated() && !auth.getName().equals("anonymousUser") ? auth.getName() : "";
                    // Snapshot identity before any mutation (including renaming/changing an account).
                    db.queryForObject("""
                        select set_config('fasearch.actor',?,true),
                         set_config('fasearch.actor_id',coalesce((select ma_tk::text from tai_khoan where ten_dang_nhap=?),''),true),
                         set_config('fasearch.actor_role',coalesce((select v.ten_vai_tro from tai_khoan a join vai_tro v using(ma_vai_tro) where a.ten_dang_nhap=?),'SYSTEM'),true)
                        """, (rs, n) -> rs.getString(1), actor, actor, actor);
                }
            });
        };
    }
}
