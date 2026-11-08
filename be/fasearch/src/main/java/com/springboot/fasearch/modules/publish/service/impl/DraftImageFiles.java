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
            throw new AppException(ErrorCode.INVALID_REQUEST, "Không chuẩn bị được thư mục ảnh.");
        }
        return root;
    }

    static String store(MultipartFile file, Path root) {
        if (file == null || file.isEmpty()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Cần chọn tệp ảnh.");
        }
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(java.util.Locale.ROOT);
        if (!ALLOWED_TYPES.contains(contentType)) {
            throw new AppException(ErrorCode.INVALID_IMAGE_FILE, "Chỉ chấp nhận ảnh PNG, JPG, JPEG.");
        }
        if (file.getSize() > MAX_SIZE) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Ảnh vượt quá 5MB.");
        }
        String original = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        int dot = original.lastIndexOf('.');
        if (dot < 0) {
            throw new AppException(ErrorCode.INVALID_IMAGE_FILE, "Tệp ảnh cần có phần mở rộng.");
        }
        String ext = original.substring(dot).toLowerCase(java.util.Locale.ROOT);
        if (!ext.matches("\\.(png|jpg|jpeg)")) {
            throw new AppException(ErrorCode.INVALID_IMAGE_FILE, "Phần mở rộng ảnh không được hỗ trợ.");
        }
        if ((contentType.equals("image/png") && !ext.equals(".png"))
                || ((contentType.equals("image/jpeg") || contentType.equals("image/jpg"))
                        && !(ext.equals(".jpg") || ext.equals(".jpeg")))) {
            throw new AppException(ErrorCode.INVALID_IMAGE_FILE, "Loại MIME và phần mở rộng của tệp không khớp.");
        }
        try {
            BufferedImage image = ImageIO.read(file.getInputStream());
            if (image == null || image.getWidth() < 1 || image.getHeight() < 1) {
                throw new AppException(ErrorCode.INVALID_IMAGE_FILE, "Không đọc được ảnh.");
            }
        } catch (IOException e) {
            throw new AppException(ErrorCode.INVALID_IMAGE_FILE, "Không đọc được ảnh.");
        }
        String fileName = UUID.randomUUID() + ext;
        Path target = root.resolve(fileName).normalize();
        if (!target.startsWith(root)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Đường dẫn ảnh không hợp lệ.");
        }
        try {
            Files.write(target, file.getBytes());
        } catch (IOException e) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Không lưu được ảnh.");
        }
        return fileName;
    }
}
