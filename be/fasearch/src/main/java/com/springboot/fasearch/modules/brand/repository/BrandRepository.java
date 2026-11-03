package com.springboot.fasearch.modules.brand.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.springboot.fasearch.modules.brand.entity.Brand;

public interface BrandRepository extends JpaRepository<Brand, Long> {
    Optional<Brand> findBySlug(String slug);
    List<Brand> findAllByIsDeletedFalseOrderByNameAsc();
}
