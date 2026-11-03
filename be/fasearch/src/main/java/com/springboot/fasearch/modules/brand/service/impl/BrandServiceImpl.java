package com.springboot.fasearch.modules.brand.service.impl;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.charset.StandardCharsets;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.brand.dto.response.BrandLogoData;
import com.springboot.fasearch.modules.brand.dto.response.BrandRes;
import com.springboot.fasearch.modules.brand.entity.Brand;
import com.springboot.fasearch.modules.brand.repository.BrandRepository;
import com.springboot.fasearch.modules.brand.service.interfaces.BrandService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class BrandServiceImpl implements BrandService {
    private final BrandRepository brandRepository;

    @Value("${brand.logo.upload-dir:uploads/brands}")
    private String logoUploadDir;

    @Override
    @Transactional(readOnly = true)
    public List<BrandRes> list() {
        return brandRepository.findAllByIsDeletedFalseOrderByNameAsc().stream()
                .map(this::response).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public BrandLogoData logo(String slug) {
        Brand brand = brandRepository.findBySlug(slug)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Brand not found"));
        String fileName = brand.getLogoFileName();
        if (fileName == null || fileName.isBlank() || fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) {
            throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Brand logo not found");
        }
        try {
            Path root = Paths.get(logoUploadDir).toAbsolutePath().normalize();
            Path file = root.resolve(fileName).normalize();
            if (!file.startsWith(root) || !Files.exists(file)) {
                throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Brand logo not found");
            }
            byte[] bytes = Files.readAllBytes(file);
            return new BrandLogoData(validatedContentType(fileName, bytes), bytes);
        } catch (IOException e) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Cannot read brand logo");
        }
    }

    public static String validatedContentType(String fileName, byte[] bytes) {
        String lower = fileName.toLowerCase();
        if (lower.endsWith(".svg")) {
            String text = new String(bytes, StandardCharsets.UTF_8).trim();
            String normalized = text.toLowerCase();
            boolean svgRoot = text.startsWith("<svg") || (text.startsWith("<?xml") && normalized.contains("<svg"));
            boolean active = normalized.contains("<script") || normalized.contains("javascript:")
                    || normalized.contains("onload=") || normalized.contains("onerror=")
                    || normalized.contains("onclick=") || normalized.contains("onmouseover=")
                    || normalized.contains("<foreignobject") || normalized.contains("<iframe")
                    || normalized.contains("<object") || normalized.contains("<embed")
                    || normalized.contains("<!entity") || normalized.contains("<!doctype")
                    || normalized.contains("href=\"http") || normalized.contains("href='http")
                    || normalized.contains("xlink:href=\"http") || normalized.contains("xlink:href='http");
            if (!svgRoot || active) throw new AppException(ErrorCode.INVALID_IMAGE_FILE, "Unsafe SVG logo");
            return "image/svg+xml";
        }
        if (lower.endsWith(".png") && bytes.length > 8 && (bytes[0] & 0xff) == 0x89
                && bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G') {
            return "image/png";
        }
        if ((lower.endsWith(".jpg") || lower.endsWith(".jpeg")) && bytes.length > 3
                && (bytes[0] & 0xff) == 0xff && (bytes[1] & 0xff) == 0xd8 && (bytes[2] & 0xff) == 0xff) {
            return "image/jpeg";
        }
        if (lower.endsWith(".webp") && bytes.length > 12 && bytes[0] == 'R' && bytes[1] == 'I'
                && bytes[2] == 'F' && bytes[3] == 'F' && bytes[8] == 'W' && bytes[9] == 'E'
                && bytes[10] == 'B' && bytes[11] == 'P') {
            return "image/webp";
        }
        throw new AppException(ErrorCode.INVALID_IMAGE_FILE, "Unsupported or mismatched brand logo content");
    }

    private BrandRes response(Brand brand) {
        return BrandRes.builder().id(brand.getId()).name(brand.getName()).slug(brand.getSlug())
                .country(brand.getCountry())
                .logoUrl(brand.getLogoFileName() == null || brand.getLogoFileName().isBlank()
                        ? null : "/api/v1/brands/" + brand.getSlug() + "/logo")
                .officialUrl(brand.getOfficialUrl()).build();
    }
}
