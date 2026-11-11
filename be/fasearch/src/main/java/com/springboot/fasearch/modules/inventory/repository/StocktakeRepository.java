package com.springboot.fasearch.modules.inventory.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.springboot.fasearch.modules.inventory.entity.Stocktake;

public interface StocktakeRepository extends JpaRepository<Stocktake, Long>, JpaSpecificationExecutor<Stocktake> {

    Optional<Stocktake> findByStocktakeCode(String stocktakeCode);

    boolean existsByStocktakeCode(String stocktakeCode);

    long countByStocktakeCodeStartingWith(String prefix);
}
