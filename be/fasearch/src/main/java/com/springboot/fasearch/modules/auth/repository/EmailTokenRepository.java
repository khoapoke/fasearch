package com.springboot.fasearch.modules.auth.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.springboot.fasearch.common.enums.EmailTokenPurpose;
import com.springboot.fasearch.modules.auth.entity.EmailToken;

public interface EmailTokenRepository extends JpaRepository<EmailToken, Long> {

    Optional<EmailToken> findByTokenHashAndPurpose(String tokenHash, EmailTokenPurpose purpose);

    @Modifying
    @Query("UPDATE EmailToken t SET t.usedAt = CURRENT_TIMESTAMP "
            + "WHERE t.account.id = :accountId AND t.purpose = :purpose AND t.usedAt IS NULL")
    int invalidateActive(@Param("accountId") Long accountId, @Param("purpose") EmailTokenPurpose purpose);
}
