package com.springboot.fasearch.modules.product.service.impl;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Set;
import java.util.UUID;

import javax.imageio.ImageIO;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.product.dto.request.ProductUpdateReq;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.modules.product.service.interfaces.ImageData;
import com.springboot.fasearch.modules.product.service.interfaces.ProductImageService;
import com.springboot.fasearch.modules.product.service.interfaces.ProductService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductImageServiceImpl implements ProductImageService {

    private static final Set<String> ALLOWED_TYPES = Set.of("image/png", "image/jpeg", "image/jpg", "image/webp");
    private static final long MAX_SIZE = 5 * 1024 * 1024; // 5MB

    private final ProductService productService;
    private final ProductRepository productRepository;

    @Value("${product.image.upload-dir:uploads/products}")
    private String uploadDir;

    @Override
    @Transactional
    public String uploadImage(Long productId, MultipartFile file) {
        // Validate product exists and is active BEFORE any file write
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new AppException(ErrorCode.PRODUCT_NOT_FOUND, "Sản phẩm không tồn tại"));

        if (product.getIsDeleted() != null && product.getIsDeleted()) {
            throw new AppException(ErrorCode.PRODUCT_NOT_FOUND, "Sản phẩm không tồn tại");
        }
        if (product.getStatus() != com.springboot.fasearch.common.enums.ProductStatus.ACTIVE) {
            throw new AppException(ErrorCode.PRODUCT_NOT_FOUND, "Sản phẩm không khả dụng");
        }

        // Validate file
        if (file == null || file.isEmpty()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Vui lòng chọn file ảnh");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType.toLowerCase())) {
            throw new AppException(ErrorCode.INVALID_IMAGE_FILE, "Chỉ chấp nhận ảnh PNG, JPG, JPEG, WEBP");
        }

        if (file.getSize() > MAX_SIZE) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Dung lượng file ảnh vượt quá 5MB");
        }

        String originalName = file.getOriginalFilename();
        if (originalName == null || originalName.isBlank()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Tên file ảnh không hợp lệ");
        }

        int dotIndex = originalName.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == originalName.length() - 1) {
            throw new AppException(ErrorCode.INVALID_IMAGE_FILE, "Phần mở rộng file không hợp lệ");
        }

        String ext = originalName.substring(dotIndex).toLowerCase();
        if (!ext.matches("\\.(png|jpg|jpeg|webp)")) {
            throw new AppException(ErrorCode.INVALID_IMAGE_FILE, "Phần mở rộng file không hợp lệ");
        }

        // Cross-validate declared MIME vs extension
        String normalizedMime = contentType.toLowerCase();
        if (normalizedMime.equals("image/jpg")) normalizedMime = "image/jpeg";
        boolean mimeExtMatch = (normalizedMime.equals("image/png") && ext.equals(".png"))
                || (normalizedMime.equals("image/jpeg") && (ext.equals(".jpg") || ext.equals(".jpeg")))
                || (normalizedMime.equals("image/webp") && ext.equals(".webp"));
        if (!mimeExtMatch) {
            throw new AppException(ErrorCode.INVALID_IMAGE_FILE, "Loại MIME và phần mở rộng file không khớp");
        }

        // Validate actual image bytes (not just MIME/extension)
        BufferedImage image;
        try {
            image = ImageIO.read(file.getInputStream());
        } catch (IOException e) {
            throw new AppException(ErrorCode.INVALID_IMAGE_FILE, "Không thể đọc file ảnh");
        }
        if (image == null) {
            throw new AppException(ErrorCode.INVALID_IMAGE_FILE, "File ảnh không hợp lệ hoặc bị hỏng");
        }
        if (image.getWidth() < 1 || image.getHeight() < 1) {
            throw new AppException(ErrorCode.INVALID_IMAGE_FILE, "Kích thước ảnh không hợp lệ");
        }

        // Generate safe filename (no path traversal)
        String safeFileName = UUID.randomUUID().toString() + ext;

        // Remove old image if exists
        String oldImageUrl = product.getImageUrl();
        if (oldImageUrl != null && oldImageUrl.startsWith("/api/v1/products/images/")) {
            String oldFileName = oldImageUrl.substring(oldImageUrl.lastIndexOf('/') + 1);
            try {
                Path oldPath = Paths.get(uploadDir).toAbsolutePath().normalize().resolve(oldFileName).normalize();
                Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
                if (oldPath.startsWith(uploadPath)) {
                    Files.deleteIfExists(oldPath);
                }
            } catch (IOException ignored) {
                // Best effort cleanup of old image
            }
        }

        // Write file
        Path targetPath = null;
        try {
            Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
            Files.createDirectories(uploadPath);
            targetPath = uploadPath.resolve(safeFileName).normalize();
            if (!targetPath.startsWith(uploadPath)) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Đường dẫn file không hợp lệ");
            }
            Files.write(targetPath, file.getBytes());
        } catch (IOException e) {
            // Cleanup orphan on write failure
            if (targetPath != null) {
                try { Files.deleteIfExists(targetPath); } catch (IOException ignored) {}
            }
            throw new AppException(ErrorCode.INVALID_REQUEST, "Không thể lưu file ảnh");
        }

        // Update product imageUrl (with orphan cleanup on failure)
        String imageUrl = "/api/v1/products/images/" + safeFileName;
        try {
            ProductUpdateReq req = new ProductUpdateReq();
            req.setImageUrl(imageUrl);
            productService.updateProduct(productId, req);
        } catch (RuntimeException e) {
            // Cleanup orphan file on DB failure
            try { Files.deleteIfExists(targetPath); } catch (IOException ignored) {}
            throw e;
        }

        log.info("Uploaded image for product ID [{}]: {}", productId, safeFileName);
        return imageUrl;
    }

    @Override
    @Transactional
    public void removeImage(Long productId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new AppException(ErrorCode.PRODUCT_NOT_FOUND, "Sản phẩm không tồn tại"));

        if (product.getIsDeleted() != null && product.getIsDeleted()) {
            throw new AppException(ErrorCode.PRODUCT_NOT_FOUND, "Sản phẩm không tồn tại");
        }

        String oldImageUrl = product.getImageUrl();
        if (oldImageUrl != null && oldImageUrl.startsWith("/api/v1/products/images/")) {
            String oldFileName = oldImageUrl.substring(oldImageUrl.lastIndexOf('/') + 1);
            try {
                Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
                Path oldPath = uploadPath.resolve(oldFileName).normalize();
                if (oldPath.startsWith(uploadPath)) {
                    Files.deleteIfExists(oldPath);
                }
            } catch (IOException ignored) {
                // Best effort cleanup
            }
        }

        ProductUpdateReq req = new ProductUpdateReq();
        req.setImageUrl("");
        productService.updateProduct(productId, req);

        log.info("Removed image for product ID [{}]", productId);
    }

    @Override
    public ImageData serveImage(String fileName) {
        if (fileName == null || fileName.isBlank() || fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Tên file không hợp lệ");
        }

        String lower = fileName.toLowerCase();
        if (!lower.endsWith(".png") && !lower.endsWith(".jpg") && !lower.endsWith(".jpeg") && !lower.endsWith(".webp")) {
            throw new AppException(ErrorCode.INVALID_IMAGE_FILE, "Phần mở rộng file không hợp lệ");
        }

        try {
            Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
            Path filePath = uploadPath.resolve(fileName).normalize();
            if (!filePath.startsWith(uploadPath)) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Đường dẫn file không hợp lệ");
            }
            if (!Files.exists(filePath)) {
                throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Ảnh không tồn tại");
            }
            byte[] bytes = Files.readAllBytes(filePath);
            String mediaType = lower.endsWith(".png") ? "image/png" :
                    lower.endsWith(".webp") ? "image/webp" : "image/jpeg";
            return new ImageData(mediaType, bytes);
        } catch (IOException e) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Không thể đọc file ảnh");
        }
    }
}