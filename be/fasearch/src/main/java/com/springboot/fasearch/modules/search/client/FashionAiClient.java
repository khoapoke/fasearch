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

    /** Tên file ảnh hợp lệ: không dấu /, không .., phần mở rộng ảnh cho phép. */
    private static final java.util.regex.Pattern SAFE_IMAGE_NAME =
            java.util.regex.Pattern.compile("^[A-Za-z0-9_-]{1,64}\\.(jpg|jpeg|png|webp)$",
                    java.util.regex.Pattern.CASE_INSENSITIVE);

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

    /**
     * Tải bytes ảnh dataset theo tên file (index chỉ trả file_name, không có image_path).
     *
     * <p>Chỉ chấp nhận tên file an toàn trong một thư mục: chặn path traversal và
     * không cho phép proxy tuỳ ý sang đường dẫn khác của AI service.
     */
    public DatasetImage fetchDatasetImage(String fileName) {
        if (fileName == null || !SAFE_IMAGE_NAME.matcher(fileName).matches()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Tên file ảnh không hợp lệ");
        }
        try {
            byte[] bytes = restClient.get()
                    .uri("/dataset/images/{fileName}", fileName)
                    .retrieve()
                    .body(byte[].class);
            if (bytes == null || bytes.length == 0) {
                throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Không tìm thấy ảnh");
            }
            return new DatasetImage(bytes, contentTypeOf(fileName));
        } catch (AppException e) {
            throw e;
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() == 404) {
                throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Không tìm thấy ảnh");
            }
            throw new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE,
                    "Máy chủ AI phản hồi lỗi (" + e.getStatusCode() + ")");
        } catch (Exception e) {
            throw new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE,
                    "Không thể kết nối đến máy chủ AI tìm kiếm");
        }
    }

    /** Ảnh dataset đã tải: bytes + content-type suy ra từ phần mở rộng. */
    public record DatasetImage(byte[] bytes, String contentType) {
    }

    private static String contentTypeOf(String fileName) {
        String lower = fileName.toLowerCase();
        if (lower.endsWith(".png")) {
            return "image/png";
        }
        if (lower.endsWith(".webp")) {
            return "image/webp";
        }
        return "image/jpeg";
    }
}
