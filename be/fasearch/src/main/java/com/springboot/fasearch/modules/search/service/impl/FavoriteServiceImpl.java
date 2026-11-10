package com.springboot.fasearch.modules.search.service.impl;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.modules.search.dto.response.FavoriteRes;
import com.springboot.fasearch.modules.search.entity.Favorite;
import com.springboot.fasearch.modules.search.repository.FavoriteRepository;
import com.springboot.fasearch.modules.search.service.interfaces.FavoriteService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class FavoriteServiceImpl implements FavoriteService {

    private final FavoriteRepository favoriteRepository;
    private final AccountRepository accountRepository;
    private final ProductRepository productRepository;

    @Override
    @Transactional
    public FavoriteRes add(String username, Long productId) {
        Account account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new AppException(ErrorCode.PRODUCT_NOT_FOUND, "Sản phẩm không tồn tại"));

        if (product.getIsDeleted() != null && product.getIsDeleted()) {
            throw new AppException(ErrorCode.PRODUCT_NOT_FOUND, "Sản phẩm không tồn tại");
        }
        if (product.getStatus() != com.springboot.fasearch.common.enums.ProductStatus.ACTIVE) {
            throw new AppException(ErrorCode.PRODUCT_NOT_FOUND, "Sản phẩm không khả dụng");
        }

        // Atomically insert or ignore conflict (race-safe, no constraint violation)
        favoriteRepository.insertIgnoreConflict(account.getId(), productId);

        // Fetch the favorite (either newly inserted or pre-existing)
        Favorite existing = favoriteRepository.findAnyByAccountAndProduct(account.getId(), productId)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Yêu thích không tồn tại"));

        // Reactivate if soft-deleted
        if (existing.getIsDeleted()) {
            existing.setIsDeleted(false);
            existing = favoriteRepository.save(existing);
        }

        return FavoriteRes.builder()
                .id(existing.getId())
                .productId(product.getId())
                .productName(product.getProductName())
                .price(product.getPrice())
                .createdAt(existing.getCreatedAt())
                .build();
    }

    @Override
    @Transactional
    public void remove(String username, Long productId) {
        Account account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        Favorite favorite = favoriteRepository.findByAccount_IdAndProduct_IdAndIsDeletedFalse(account.getId(), productId)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Yêu thích không tồn tại"));

        favorite.setIsDeleted(true);
        favoriteRepository.save(favorite);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<FavoriteRes> list(String username, Pageable pageable) {
        Account account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        return favoriteRepository.findByAccount_IdAndIsDeletedFalseOrderByCreatedAtDesc(account.getId(), pageable)
                .map(f -> FavoriteRes.builder()
                        .id(f.getId())
                        .productId(f.getProduct().getId())
                        .productName(f.getProduct().getProductName())
                        .price(f.getProduct().getPrice())
                        .createdAt(f.getCreatedAt())
                        .build());
    }
}