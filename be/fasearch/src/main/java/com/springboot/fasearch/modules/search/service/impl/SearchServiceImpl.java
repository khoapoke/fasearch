package com.springboot.fasearch.modules.search.service.impl;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.modules.search.client.FashionAiClient;
import com.springboot.fasearch.modules.search.dto.ai.AiApiResponse;
import com.springboot.fasearch.modules.search.dto.ai.AiSearchData;
import com.springboot.fasearch.modules.search.dto.ai.AiSearchResultItem;
import com.springboot.fasearch.modules.search.dto.request.TextSearchReq;
import com.springboot.fasearch.modules.search.dto.response.AiSearchRes;
import com.springboot.fasearch.modules.search.dto.response.ProductSearchItemRes;
import com.springboot.fasearch.modules.search.service.interfaces.SearchService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SearchServiceImpl implements SearchService {

    /** AI service chỉ nhận limit <= 24 (max_search_limit). */
    private static final int AI_MAX_LIMIT = 24;
    /** Lấy dư từ AI để sau khi lọc sản phẩm không còn bán vẫn đủ số kết quả. */
    private static final int OVERFETCH_FACTOR = 3;
    /** Giá trị placeholder của biến thể, không phải màu thật (khớp ProductMapper). */
    private static final String SENTINEL_COLOR = "Default Title";

    private final FashionAiClient fashionAiClient;
    private final ProductRepository productRepository;

    private static int aiFetchLimit(int limit) {
        return Math.min(AI_MAX_LIMIT, limit * OVERFETCH_FACTOR);
    }

    @Override
    @Transactional(readOnly = true)
    public AiSearchRes searchByText(TextSearchReq req) {
        if (req == null || req.getQuery() == null || req.getQuery().isBlank()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Nội dung tìm kiếm không được để trống");
        }

        int limit = req.getLimit() != null ? req.getLimit() : 12;
        if (limit < 1 || limit > 24) {
            limit = 12;
        }

        AiApiResponse<AiSearchData> aiResponse = fashionAiClient.searchByText(req.getQuery().trim(), aiFetchLimit(limit));
        return toLiveSearchRes(aiResponse, limit);
    }

    @Override
    @Transactional(readOnly = true)
    public AiSearchRes searchByImage(MultipartFile file, Integer limit) {
        validateImageFile(file);

        int lim = (limit != null && limit >= 1 && limit <= 24) ? limit : 12;
        AiApiResponse<AiSearchData> aiResponse = fashionAiClient.searchByImage(file, aiFetchLimit(lim));
        return toLiveSearchRes(aiResponse, lim);
    }

    @Override
    @Transactional(readOnly = true)
    public AiSearchRes searchMultimodal(MultipartFile file, String query, Integer limit, Float textWeight) {
        validateImageFile(file);

        if (query == null || query.isBlank()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Câu mô tả bổ sung không được để trống");
        }

        int lim = (limit != null && limit >= 1 && limit <= 24) ? limit : 12;
        float weight = (textWeight != null && textWeight >= 0.0f && textWeight <= 1.0f) ? textWeight : 0.5f;

        AiApiResponse<AiSearchData> aiResponse = fashionAiClient.searchMultimodal(file, query.trim(), aiFetchLimit(lim), weight);
        return toLiveSearchRes(aiResponse, lim);
    }

    private void validateImageFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Vui lòng chọn file ảnh hợp lệ");
        }

        String filename = file.getOriginalFilename();
        if (filename == null || filename.isBlank()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Tên file ảnh không hợp lệ");
        }

        String lower = filename.toLowerCase();
        if (!lower.endsWith(".png") && !lower.endsWith(".jpg") && !lower.endsWith(".jpeg") && !lower.endsWith(".webp")) {
            throw new AppException(ErrorCode.INVALID_IMAGE_FILE);
        }

        // Giới hạn dung lượng tối đa 10MB
        if (file.getSize() > 10 * 1024 * 1024) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Dung lượng file ảnh vượt quá giới hạn tối đa cho phép (10MB)");
        }
    }

    /**
     * Làm giàu kết quả vector từ danh mục đang bán (một truy vấn gộp, không N+1): chỉ giữ sản phẩm
     * PUBLISHED + ACTIVE + chưa xóa mềm + còn tồn kho khả dụng; gộp trùng theo productId (giữ điểm cao nhất,
     * thứ tự theo điểm); cắt về {@code limit}.
     */
    private AiSearchRes toLiveSearchRes(AiApiResponse<AiSearchData> aiResponse, int limit) {
        if (aiResponse == null || aiResponse.getData() == null || aiResponse.getData().getResults() == null) {
            return AiSearchRes.builder().total(0).items(Collections.emptyList()).build();
        }

        Map<Long, AiSearchResultItem> best = new LinkedHashMap<>();
        for (AiSearchResultItem hit : aiResponse.getData().getResults()) {
            Long pid = parseProductId(hit.getProductId());
            if (pid == null) {
                continue;
            }
            AiSearchResultItem prev = best.get(pid);
            if (prev == null || hit.getScore() > prev.getScore()) {
                best.put(pid, hit);
            }
        }
        if (best.isEmpty()) {
            return AiSearchRes.builder().total(0).items(Collections.emptyList()).build();
        }

        Map<Long, Product> live = new HashMap<>();
        for (Product p : productRepository.findLiveInStockByIdIn(best.keySet())) {
            live.put(p.getId(), p);
        }
        Map<Long, Set<String>> colors = new HashMap<>();
        if (!live.isEmpty()) {
            for (Object[] row : productRepository.findInStockColorsByProductIdIn(live.keySet())) {
                String color = row[1] == null ? null : row[1].toString().trim();
                if (color == null || color.isEmpty() || SENTINEL_COLOR.equalsIgnoreCase(color)) {
                    continue;
                }
                colors.computeIfAbsent((Long) row[0], k -> new LinkedHashSet<>()).add(color);
            }
        }

        List<ProductSearchItemRes> items = new ArrayList<>();
        best.values().stream()
                .sorted((a, b) -> Double.compare(b.getScore(), a.getScore()))
                .forEach(hit -> {
                    if (items.size() >= limit) {
                        return;
                    }
                    Product p = live.get(parseProductId(hit.getProductId()));
                    if (p == null) {
                        return;
                    }
                    items.add(ProductSearchItemRes.builder()
                            .id(hit.getId())
                            .score(hit.getScore())
                            .productId(p.getId())
                            .productName(p.getProductName())
                            .brandName(p.getBrand() != null ? p.getBrand().getName() : null)
                            .price(p.getPrice())
                            .imageUrl(p.getImageUrl())
                            .colors(new ArrayList<>(colors.getOrDefault(p.getId(), Collections.emptySet())))
                            .status(p.getStatus())
                            .build());
                });

        return AiSearchRes.builder().total(items.size()).items(items).build();
    }

    private static Long parseProductId(String raw) {
        if (raw == null || raw.isBlank() || raw.equalsIgnoreCase("null")) {
            return null;
        }
        try {
            return Long.parseLong(raw.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    @Override
    public com.springboot.fasearch.modules.search.client.FashionAiClient.DatasetImage downloadDatasetImage(
            String fileName) {
        return fashionAiClient.fetchDatasetImage(fileName);
    }
}
