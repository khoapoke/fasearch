package com.springboot.fasearch.client;

import java.time.Duration;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;

import lombok.extern.slf4j.Slf4j;

/**
 * Transactional email qua Brevo HTTP API v3.
 *
 * <p>Che do gui duoc chon theo su hien dien cua bien moi truong:
 * <ul>
 *   <li>Co {@code BREVO_API_KEY} (non-blank) -&gt; che do {@code brevo}: goi that API.</li>
 *   <li>Khong co -&gt; che do {@code log}: render + ghi log email, khong gui that.</li>
 * </ul>
 * Khong bao gio in API key ra log. Loi mang/timeout duoc thu lai dung mot lan.
 */
@Slf4j
@Component
public class BrevoMailClient {

    private static final String SEND_PATH = "/v3/smtp/email";

    private final RestClient restClient;
    private final String apiKey;
    private final String senderEmail;
    private final String senderName;

    @Autowired
    public BrevoMailClient(
            @Value("${brevo.api-url:https://api.brevo.com}") String apiUrl,
            @Value("${brevo.api-key:}") String apiKey,
            @Value("${brevo.sender-email:no-reply@fasearch.local}") String senderEmail,
            @Value("${brevo.sender-name:FaSearch}") String senderName,
            @Value("${brevo.timeout-seconds:10}") int timeoutSeconds) {
        this(apiUrl, apiKey, senderEmail, senderName, buildRestClient(apiUrl, timeoutSeconds));
    }

    BrevoMailClient(String apiUrl, String apiKey, String senderEmail, String senderName, RestClient restClient) {
        String base = apiUrl != null && apiUrl.endsWith("/") ? apiUrl.substring(0, apiUrl.length() - 1) : apiUrl;
        this.restClient = restClient;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.senderEmail = senderEmail;
        this.senderName = senderName;
        if (isBrevoMode()) {
            log.info("BrevoMailClient che do brevo (api={}, sender={})", base, senderEmail);
        } else {
            log.info("BrevoMailClient che do log (chua co BREVO_API_KEY): chi render + ghi log, khong gui that");
        }
    }

    private static RestClient buildRestClient(String apiUrl, int timeoutSeconds) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        int timeoutMs = (int) Duration.ofSeconds(Math.max(1, timeoutSeconds)).toMillis();
        factory.setConnectTimeout(timeoutMs);
        factory.setReadTimeout(timeoutMs);
        return RestClient.builder().baseUrl(apiUrl).requestFactory(factory).build();
    }

    /** true khi co API key (gui that), false khi o che do log. */
    public boolean isBrevoMode() {
        return !apiKey.isBlank();
    }

    public String getMode() {
        return isBrevoMode() ? "brevo" : "log";
    }

    /**
     * Gui email giao dich. Che do log chi render + ghi log (khong throw).
     * Che do brevo thu lai dung mot lan roi moi bao loi EMAIL_SEND_FAILED.
     */
    public void send(String toEmail, String toName, String subject, String htmlContent, String textContent) {
        if (!isBrevoMode()) {
            log.info("[mail:log] to={} subject={}\n--- text ---\n{}\n--- html ---\n{}",
                    toEmail, subject, textContent, htmlContent);
            return;
        }
        BrevoSendReq body = new BrevoSendReq(
                new BrevoParty(senderName, senderEmail),
                new BrevoParty[] { new BrevoParty(toName, toEmail) },
                subject, htmlContent, textContent);
        AppException failure = null;
        for (int attempt = 1; attempt <= 2; attempt++) {
            try {
                restClient.post()
                        .uri(SEND_PATH)
                        .header("api-key", apiKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .toBodilessEntity();
                return;
            } catch (RestClientResponseException e) {
                failure = new AppException(ErrorCode.EMAIL_SEND_FAILED,
                        "Brevo tu choi yeu cau (" + e.getStatusCode() + ")");
                log.warn("Brevo send that bai lan {} (HTTP {}), to={}", attempt, e.getStatusCode(), toEmail);
            } catch (Exception e) {
                failure = new AppException(ErrorCode.EMAIL_SEND_FAILED,
                        "Khong ket noi duoc Brevo: " + e.getClass().getSimpleName());
                log.warn("Brevo send that bai lan {} ({}), to={}", attempt, e.getClass().getSimpleName(), toEmail);
            }
        }
        throw failure;
    }

    private record BrevoParty(String name, String email) {
    }

    private record BrevoSendReq(BrevoParty sender, BrevoParty[] to, String subject,
            String htmlContent, String textContent) {
    }
}
