package com.springboot.fasearch.modules.user.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.springboot.fasearch.modules.user.entity.User;

@Repository 
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findBySdt(String sdt);
}
