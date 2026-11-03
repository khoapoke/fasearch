package com.springboot.fasearch.modules.publish.service.impl;

import java.math.BigDecimal;
import java.net.InetAddress;
import java.net.URI;
import java.net.URL;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.springboot.fasearch.modules.publish.dto.request.AdminDraftCreateReq;
import com.springboot.fasearch.modules.publish.dto.request.AdminDraftVariantReq;
import com.springboot.fasearch.modules.product.repository.CategoryRepository;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.publish.dto.request.AdminDraftCreateReq;
import com.springboot.fasearch.modules.publish.dto.request.AdminDraftVariantReq;
import com.springboot.fasearch.modules.product.repository.CategoryRepository;

/**
 * Bounded URL-assisted metadata import. Fetch failures preserve the manual form;
 * mapping failures reject with a field-level reason instead of inventing values.
 */
final class UrlImport {

    private UrlImport() {
    }

    private static final Set<String> ALLOWED_SUFFIXES = Set.of(
            "teelab.vn", "clownz.vn", "davies.vn", "ontop.com.vn", "nowsaigon.com",
            "rubies.vn", "dkmv.vn", "upload.wikimedia.org", "commons.wikimedia.org");

    private static final ObjectMapper JSON = new ObjectMapper();

    record Parsed(String kind, Map<String, Object> product, String bodySha256) {
    }

    static Parsed fetchAndParse(String url) {
        URI uri;
        try {
            uri = new URI(url);
        } catch (Exception e) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "URL is malformed");
        }
        if (!"https".equalsIgnoreCase(uri.getScheme())) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Only https URLs are accepted");
        }
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        boolean allowed = ALLOWED_SUFFIXES.stream()
                .anyMatch(suffix -> host.equals(suffix) || host.endsWith("." + suffix));
        if (!allowed) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "URL host is not allowlisted");
        }
        try {
            for (InetAddress address : InetAddress.getAllByName(host)) {
                if (address.isLoopbackAddress() || address.isLinkLocalAddress() || address.isSiteLocalAddress()
                        || address.isMulticastAddress() || address.getHostAddress().startsWith("169.254.")) {
                    throw new AppException(ErrorCode.INVALID_REQUEST, "URL resolves to a non-public address");
                }
            }
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Cannot resolve URL host");
        }
        byte[] body = fetchBytes(url);
        String sha = sha256Hex(body);
        Object parsed;
        try {
            parsed = JSON.readValue(body, Object.class);
        } catch (Exception e) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "URL did not return JSON");
        }
        if (!(parsed instanceof Map)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "URL JSON must be a product object");
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> product = (Map<String, Object>) parsed;
        if (product.get("id") == null && product.get("variants") == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "URL JSON is not a product record");
        }
        return new Parsed("VN_FEED", product, sha);
    }

    private static byte[] fetchBytes(String url) {
        try {
            javax.net.ssl.HttpsURLConnection connection =
                    (javax.net.ssl.HttpsURLConnection) new URL(url).openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestProperty("User-Agent", "FaSearch-AdminImport/1.0 (academic demo)");
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "URL fetch failed with status " + status);
            }
            String contentType = connection.getContentType() == null ? "" : connection.getContentType();
            if (!contentType.contains("json") && !contentType.contains("javascript")) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "URL must serve JSON, got: " + contentType);
            }
            try (java.io.InputStream in = connection.getInputStream()) {
                byte[] data = in.readNBytes(2 * 1024 * 1024 + 1);
                if (data.length > 2 * 1024 * 1024) {
                    throw new AppException(ErrorCode.INVALID_REQUEST, "URL response exceeds 2MB");
                }
                return data;
            }
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "URL fetch failed");
        }
    }

    static String sha256Hex(byte[] data) {
        try {
            byte[] digest = java.security.MessageDigest.getInstance("SHA-256").digest(data);
            StringBuilder hex = new StringBuilder();
            for (byte b : digest) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception e) {
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
    }

    @SuppressWarnings("unchecked")
    static AdminDraftCreateReq mapToDraft(Map<String, Object> product, CategoryRepository categoryRepository) {
        Object rawName = product.get("name");
        String name = rawName instanceof String s && !s.isBlank() ? s.strip() : null;
        if (name == null && product.get("title") instanceof String t && !t.isBlank()) {
            name = t.strip();
        }
        if (name == null || name.length() > 255) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Feed product has no usable name");
        }
        Object variantsRaw = product.get("variants");
        if (!(variantsRaw instanceof List<?> variantList) || variantList.isEmpty()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Feed product has no variants");
        }
        String colorKey = null;
        String sizeKey = null;
        Object optionsRaw = product.get("options");
        if (optionsRaw instanceof List<?> options) {
            for (Object item : options) {
                if (!(item instanceof Map<?, ?> opt)) {
                    continue;
                }
                Object optNameRaw = opt.get("name");
                String optName = String.valueOf(optNameRaw == null ? "" : optNameRaw).toLowerCase(Locale.ROOT);
                Object position = opt.get("position");
                int pos = position instanceof Number n ? n.intValue() : -1;
                String key = pos == 1 ? "option1" : pos == 2 ? "option2" : pos == 3 ? "option3" : null;
                if (key == null) {
                    continue;
                }
                if (optName.contains("m\u00e0u") || optName.contains("color")) {
                    colorKey = key;
                } else if (optName.contains("k\u00edch") || optName.contains("size") || optName.contains("c\u1ee1")) {
                    sizeKey = key;
                }
            }
        }
        List<AdminDraftVariantReq> variants = new ArrayList<>();
        BigDecimal price = null;
        String imageUrl = null;
        for (Object item : variantList) {
            if (!(item instanceof Map)) {
                continue;
            }
            Map<String, Object> v = (Map<String, Object>) item;
            Object priceRaw = v.get("price");
            if (price == null && priceRaw instanceof Number n) {
                BigDecimal candidate = BigDecimal.valueOf(n.doubleValue());
                if (candidate.signum() > 0) {
                    price = candidate;
                }
            }
            if (imageUrl == null) {
                Object images = product.get("images");
                if (images instanceof List<?> imgs && !imgs.isEmpty() && imgs.get(0) instanceof String first) {
                    imageUrl = first;
                } else if (v.get("featured_image") instanceof Map<?, ?> feat && feat.get("src") instanceof String src) {
                    imageUrl = src;
                } else if (v.get("featured_image") instanceof String s && !s.isBlank()) {
                    imageUrl = s;
                }
            }
            AdminDraftVariantReq variant = new AdminDraftVariantReq();
            Object colorRaw = colorKey == null ? null : v.get(colorKey);
            Object sizeRaw = sizeKey == null ? null : v.get(sizeKey);
            variant.setColor(colorRaw instanceof String s && !s.isBlank() ? s.strip() : null);
            if (sizeRaw instanceof String s && !s.isBlank()) {
                variant.setSize(s.strip());
            } else if (sizeRaw != null) {
                variant.setSize(String.valueOf(sizeRaw));
            }
            Object barcode = v.get("barcode");
            if (barcode == null || barcode.toString().isBlank()) {
                barcode = v.get("sku");
            }
            variant.setBarcode(barcode == null || barcode.toString().isBlank() ? null
                    : barcode.toString().strip().toUpperCase(Locale.ROOT));
            Object stockRaw = v.get("inventory_quantity");
            variant.setStock(stockRaw instanceof Number n ? Math.max(0, n.intValue()) : 0);
            variants.add(variant);
            if (variants.size() >= 50) {
                break;
            }
        }
        if (price == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Feed product has no usable price");
        }
        if (imageUrl == null || imageUrl.isBlank()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Feed product has no usable image");
        }
        AdminDraftCreateReq req = new AdminDraftCreateReq();
        req.setProductName(name);
        req.setPrice(price);
        req.setDescription(product.get("description") instanceof String d ? d : null);
        req.setImageUrl(imageUrl);
        req.setVariants(variants);
        req.setCategoryId(suggestCategoryId(product, categoryRepository));
        return req;
    }

    private static Long suggestCategoryId(Map<String, Object> product, CategoryRepository categoryRepository) {
        String haystack = String.valueOf(product.getOrDefault("product_type", "")) + " "
                + String.valueOf(product.getOrDefault("name", "")) + " "
                + String.valueOf(product.getOrDefault("title", ""));
        String lowered = haystack.toLowerCase(Locale.ROOT);
        String candidate;
        if (lowered.contains("jean") || lowered.contains("denim")) candidate = "Qu\u1ea7n Jean";
        else if (lowered.contains("short")) candidate = "Qu\u1ea7n Short";
        else if (lowered.contains("dress") || lowered.contains("\u0111\u1ea7m")) candidate = "\u0110\u1ea7m";
        else if (lowered.contains("jacket") || lowered.contains("kho\u00e1c")) candidate = "\u00c1o Kho\u00e1c";
        else if (lowered.contains("hoodie")) candidate = "\u00c1o Hoodie";
        else if (lowered.contains("shirt") || lowered.contains("tee") || lowered.contains("\u00e1o thun")) candidate = "\u00c1o Thun";
        else if (lowered.contains("shoe") || lowered.contains("sneaker") || lowered.contains("gi\u00e0y")) candidate = "Gi\u00e0y Sneaker";
        else if (lowered.contains("hat") || lowered.contains("cap") || lowered.contains("m\u0169")) candidate = "M\u0169 N\u00f3n";
        else if (lowered.contains("bag") || lowered.contains("t\u00fai")) candidate = "T\u00fai X\u00e1ch";
        else return null;
        return categoryRepository.findAll().stream()
                .filter(c -> candidate.equals(c.getCategoryName()))
                .map(c -> c.getId()).findFirst().orElse(null);
    }
}
