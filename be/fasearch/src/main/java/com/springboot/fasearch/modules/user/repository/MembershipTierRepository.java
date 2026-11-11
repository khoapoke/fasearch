package com.springboot.fasearch.modules.user.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;

import com.springboot.fasearch.modules.user.entity.MembershipTier;

public interface MembershipTierRepository extends JpaRepository<MembershipTier, Long> {

    Optional<MembershipTier> findFirstByOrderByThresholdPointAsc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from MembershipTier t order by t.id")
    List<MembershipTier> findAllForUpdate();
}
