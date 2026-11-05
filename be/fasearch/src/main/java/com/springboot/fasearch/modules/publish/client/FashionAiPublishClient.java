package com.springboot.fasearch.modules.publish.client;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;

@Component
public class FashionAiPublishClient {

    private final RestClient restClient;

    public FashionAiPublishClient(@Value("${ai-service.base-url:http://localhost:8000}") String baseUrl) {
        String base = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.restClient = RestClient.builder().baseUrl(base).build();
    }

    public record IndexedPoint(String pointId) {}

    public IndexedPoint upsertProduct(Long productId, String name, String description, String brandSlug,
            String model, byte[] imageBytes, String imageFileName) {
        try {
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("product_id", String.valueOf(productId));
            if (name != null) body.add("name", name);
            if (description != null) body.add("description", description);
            if (brandSlug != null) body.add("brand_slug", brandSlug);
            if (model != null) body.add("model", model);
            if (imageBytes != null && imageBytes.length > 0) {
                ByteArrayResource fileResource = new ByteArrayResource(imageBytes) {
                    @Override
                    public String getFilename() {
                        return imageFileName != null ? imageFileName : "product.jpg";
                    }
                };
                body.add("file", fileResource);
            }
            return restClient.post()
                    .uri("/internal/v1/index/upsert")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body)
                    .retrieve()
                    .body(new ParameterizedTypeReference<IndexedPoint>() {});
        } catch (RestClientResponseException e) {
            throw new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE,
                    "AI index responded with error (" + e.getStatusCode() + ")");
        } catch (Exception e) {
            throw new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE,
                    "Cannot reach AI index service");
        }
    }

    public void deleteProduct(Long productId) {
        try {
            restClient.delete()
                    .uri("/internal/v1/index/products/{id}", productId)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            throw new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE,
                    "AI index responded with error (" + e.getStatusCode() + ")");
        } catch (Exception e) {
            throw new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE,
                    "Cannot reach AI index service");
        }
    }
}
