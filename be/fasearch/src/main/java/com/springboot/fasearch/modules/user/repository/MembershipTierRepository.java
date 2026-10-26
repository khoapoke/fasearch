package com.springboot.fasearch.modules.user.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.springboot.fasearch.modules.user.entity.MembershipTier;

public interface MembershipTierRepository extends JpaRepository<MembershipTier, Long> {

    Optional<MembershipTier> findFirstByOrderByThresholdPointAsc();
}
