package com.springboot.fasearch.modules.publish.service.impl;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Set;
import java.util.UUID;

import javax.imageio.ImageIO;

import org.springframework.web.multipart.MultipartFile;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;

/** Shared upload helpers for draft product images (same rules as ProductImageService). */
final class DraftImageFiles {

    private DraftImageFiles() {
    }

    static final Set<String> ALLOWED_TYPES = Set.of("image/png", "image/jpeg", "image/jpg");
    static final long MAX_SIZE = 5 * 1024 * 1024;

    static Path uploadRoot(String uploadDir) {
        Path root = Paths.get(uploadDir).toAbsolutePath().normalize().resolve("drafts");
        try {
            Files.createDirectories(root);
        } catch (IOException e) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Cannot prepare image directory");
        }
        return root;
    }

    static String store(MultipartFile file, Path root) {
        if (file == null || file.isEmpty()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Image file is required");
        }
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(java.util.Locale.ROOT);
        if (!ALLOWED_TYPES.contains(contentType)) {
            throw new AppException(ErrorCode.INVALID_IMAGE_FILE, "Only PNG, JPG, JPEG images are accepted");
        }
        if (file.getSize() > MAX_SIZE) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Image exceeds 5MB");
        }
        String original = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        int dot = original.lastIndexOf('.');
        if (dot < 0) {
            throw new AppException(ErrorCode.INVALID_IMAGE_FILE, "Image file needs an extension");
        }
        String ext = original.substring(dot).toLowerCase(java.util.Locale.ROOT);
        if (!ext.matches("\\.(png|jpg|jpeg)")) {
            throw new AppException(ErrorCode.INVALID_IMAGE_FILE, "Unsupported image extension");
        }
        if ((contentType.equals("image/png") && !ext.equals(".png"))
                || ((contentType.equals("image/jpeg") || contentType.equals("image/jpg"))
                        && !(ext.equals(".jpg") || ext.equals(".jpeg")))) {
            throw new AppException(ErrorCode.INVALID_IMAGE_FILE, "MIME type and extension do not match");
        }
        try {
            BufferedImage image = ImageIO.read(file.getInputStream());
            if (image == null || image.getWidth() < 1 || image.getHeight() < 1) {
                throw new AppException(ErrorCode.INVALID_IMAGE_FILE, "Image is unreadable");
            }
        } catch (IOException e) {
            throw new AppException(ErrorCode.INVALID_IMAGE_FILE, "Image is unreadable");
        }
        String fileName = UUID.randomUUID() + ext;
        Path target = root.resolve(fileName).normalize();
        if (!target.startsWith(root)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Invalid image path");
        }
        try {
            Files.write(target, file.getBytes());
        } catch (IOException e) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Cannot store image");
        }
        return fileName;
    }
}
