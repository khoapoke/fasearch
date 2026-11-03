package com.springboot.fasearch.modules.product.service.interfaces;

import org.springframework.web.multipart.MultipartFile;

public interface ProductImageService {

    /** Upload or replace product image. Returns the safe image URL. */
    String uploadImage(Long productId, MultipartFile file);

    /** Remove product image (sets imageUrl to null). */
    void removeImage(Long productId);

    /** Serve image bytes by safe filename. Returns [contentType, bytes]. */
    ImageData serveImage(String fileName);
}