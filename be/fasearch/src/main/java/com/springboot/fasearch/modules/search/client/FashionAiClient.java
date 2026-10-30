package com.springboot.fasearch.modules.search.client;

import java.io.IOException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.multipart.MultipartFile;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.search.dto.ai.AiApiResponse;
import com.springboot.fasearch.modules.search.dto.ai.AiSearchData;
import com.springboot.fasearch.modules.search.dto.ai.AiTextSearchReq;

@Component
public class FashionAiClient {

    private final RestClient restClient;
    private final String baseUrl;

    public FashionAiClient(@Value("${ai-service.base-url:http://localhost:8000}") String baseUrl) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.restClient = RestClient.builder()
                .baseUrl(this.baseUrl)
                .build();
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public AiApiResponse<AiSearchData> searchByText(String query, int limit) {
        try {
            AiTextSearchReq request = AiTextSearchReq.builder()
                    .query(query)
                    .limit(limit)
                    .build();

            return restClient.post()
                    .uri("/api/search/text")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(new ParameterizedTypeReference<AiApiResponse<AiSearchData>>() {});
        } catch (RestClientResponseException e) {
            throw new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE,
                    "Máy chủ AI phản hồi lỗi (" + e.getStatusCode() + "): " + e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE,
                    "Không thể kết nối đến máy chủ AI tìm kiếm (Port 8000). Vui lòng kiểm tra lại dịch vụ AI");
        }
    }

    public AiApiResponse<AiSearchData> searchByImage(MultipartFile file, int limit) {
        try {
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            ByteArrayResource fileResource = new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename() != null ? file.getOriginalFilename() : "image.jpg";
                }
            };
            body.add("file", fileResource);
            body.add("limit", limit);

            return restClient.post()
                    .uri("/api/search/image")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body)
                    .retrieve()
                    .body(new ParameterizedTypeReference<AiApiResponse<AiSearchData>>() {});
        } catch (IOException e) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Không thể đọc dữ liệu file ảnh tải lên: " + e.getMessage());
        } catch (RestClientResponseException e) {
            throw new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE,
                    "Máy chủ AI phản hồi lỗi (" + e.getStatusCode() + "): " + e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE,
                    "Không thể kết nối đến máy chủ AI tìm kiếm (Port 8000). Vui lòng kiểm tra lại dịch vụ AI");
        }
    }

    public AiApiResponse<AiSearchData> searchMultimodal(MultipartFile file, String query, int limit, float textWeight) {
        try {
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            ByteArrayResource fileResource = new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename() != null ? file.getOriginalFilename() : "image.jpg";
                }
            };
            body.add("file", fileResource);
            body.add("query", query);
            body.add("limit", limit);
            body.add("text_weight", textWeight);

            return restClient.post()
                    .uri("/api/search/multimodal")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body)
                    .retrieve()
                    .body(new ParameterizedTypeReference<AiApiResponse<AiSearchData>>() {});
        } catch (IOException e) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Không thể đọc dữ liệu file ảnh tải lên: " + e.getMessage());
        } catch (RestClientResponseException e) {
            throw new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE,
                    "Máy chủ AI phản hồi lỗi (" + e.getStatusCode() + "): " + e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE,
                    "Không thể kết nối đến máy chủ AI tìm kiếm (Port 8000). Vui lòng kiểm tra lại dịch vụ AI");
        }
    }
}

