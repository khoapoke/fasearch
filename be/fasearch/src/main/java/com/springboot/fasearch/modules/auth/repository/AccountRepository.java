package com.springboot.fasearch.modules.auth.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.springboot.fasearch.modules.auth.entity.Account;

public interface AccountRepository extends JpaRepository<Account, Long>, JpaSpecificationExecutor<Account> {

    Optional<Account> findByUsername(String username);

    Optional<Account> findByEmail(String email);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);
}
