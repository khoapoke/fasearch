package com.springboot.fasearch.modules.search.service.impl;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.springboot.fasearch.common.enums.ProductStatus;
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

    private final FashionAiClient fashionAiClient;
    private final ProductRepository productRepository;

    @Override
    @Transactional(readOnly = true)
    public AiSearchRes searchByText(TextSearchReq req) {
        if (req == null || req.getQuery() == null || req.getQuery().isBlank()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Nội dung tìm kiếm không được để trống");
        }

        int limit = req.getLimit() != null ? req.getLimit() : 5;
        if (limit < 1 || limit > 24) {
            limit = 5;
        }

        AiApiResponse<AiSearchData> aiResponse = fashionAiClient.searchByText(req.getQuery().trim(), limit);
        return mapToAiSearchRes(aiResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public AiSearchRes searchByImage(MultipartFile file, Integer limit) {
        validateImageFile(file);

        int lim = (limit != null && limit >= 1 && limit <= 24) ? limit : 5;
        AiApiResponse<AiSearchData> aiResponse = fashionAiClient.searchByImage(file, lim);
        return mapToAiSearchRes(aiResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public AiSearchRes searchMultimodal(MultipartFile file, String query, Integer limit, Float textWeight) {
        validateImageFile(file);

        if (query == null || query.isBlank()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Câu mô tả bổ sung không được để trống");
        }

        int lim = (limit != null && limit >= 1 && limit <= 24) ? limit : 5;
        float weight = (textWeight != null && textWeight >= 0.0f && textWeight <= 1.0f) ? textWeight : 0.5f;

        AiApiResponse<AiSearchData> aiResponse = fashionAiClient.searchMultimodal(file, query.trim(), lim, weight);
        return mapToAiSearchRes(aiResponse);
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

    private AiSearchRes mapToAiSearchRes(AiApiResponse<AiSearchData> aiResponse) {
        if (aiResponse == null || aiResponse.getData() == null || aiResponse.getData().getResults() == null) {
            return AiSearchRes.builder()
                    .total(0)
                    .items(Collections.emptyList())
                    .build();
        }

        List<AiSearchResultItem> results = aiResponse.getData().getResults();
        List<ProductSearchItemRes> items = new ArrayList<>();

        for (AiSearchResultItem item : results) {
            items.add(mapToProductSearchItemRes(item));
        }

        return AiSearchRes.builder()
                .total(aiResponse.getData().getTotal() > 0 ? aiResponse.getData().getTotal() : items.size())
                .items(items)
                .build();
    }

    private ProductSearchItemRes mapToProductSearchItemRes(AiSearchResultItem item) {
        Long prodId = null;
        String prodName = null;
        BigDecimal price = null;
        ProductStatus status = null;

        // Nếu AI trả về product_id hợp lệ, tra cứu làm giàu dữ liệu từ cơ sở dữ liệu
        if (item.getProductId() != null && !item.getProductId().isBlank() && !item.getProductId().equalsIgnoreCase("null")) {
            try {
                prodId = Long.parseLong(item.getProductId());
                Optional<Product> prodOpt = productRepository.findById(prodId);
                if (prodOpt.isPresent()) {
                    Product p = prodOpt.get();
                    prodName = p.getProductName();
                    price = p.getPrice();
                    status = p.getStatus();
                }
            } catch (NumberFormatException ignored) {
                // Giữ nguyên prodId null nếu format không phải số
            }
        }

        return ProductSearchItemRes.builder()
                .id(item.getId())
                .score(item.getScore())
                .imagePath(item.getImagePath())
                .fullImageUrl(buildFullImageUrl(item.getImagePath(), item.getFileName()))
                .fileName(item.getFileName())
                .catalog(item.getCatalog())
                .productId(prodId)
                .productName(prodName)
                .price(price)
                .status(status)
                .build();
    }

    @Override
    public com.springboot.fasearch.modules.search.client.FashionAiClient.DatasetImage downloadDatasetImage(
            String fileName) {
        return fashionAiClient.fetchDatasetImage(fileName);
    }

    private String buildFullImageUrl(String imagePath, String fileName) {
        if (imagePath != null && !imagePath.isBlank()) {
            String base = fashionAiClient.getBaseUrl();
            return imagePath.startsWith("/") ? base + imagePath : base + "/" + imagePath;
        }
        // Index hiện tại chỉ có file_name (image_path rỗng): trả URL qua route proxy của BE
        // để FE không gọi trực tiếp cổng AI và không lộ đường dẫn nội bộ.
        if (fileName != null && !fileName.isBlank()) {
            return "/api/v1/search/images/" + fileName;
        }
        return "";
    }
}

