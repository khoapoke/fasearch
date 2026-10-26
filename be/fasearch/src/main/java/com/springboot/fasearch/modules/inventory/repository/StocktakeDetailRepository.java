package com.springboot.fasearch.modules.inventory.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.springboot.fasearch.modules.inventory.entity.StocktakeDetail;

public interface StocktakeDetailRepository extends JpaRepository<StocktakeDetail, Long> {

    List<StocktakeDetail> findByStocktakeId(Long stocktakeId);
}
