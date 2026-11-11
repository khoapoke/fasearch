package com.springboot.fasearch.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;

import org.junit.jupiter.api.Test;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;

class BrevoMailClientTest {

    private static RestClient shortTimeoutClient(String baseUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(1).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(1).toMillis());
        return RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }

    @Test
    void logModeRendersWithoutSending() {
        BrevoMailClient client = new BrevoMailClient(
                "https://api.brevo.com", "", "no-reply@fasearch.local", "FaSearch",
                shortTimeoutClient("https://api.brevo.com"));

        assertThat(client.isBrevoMode()).isFalse();
        assertThat(client.getMode()).isEqualTo("log");
        client.send("user@example.invalid", "User", "Subject", "<p>html</p>", "text");
    }

    @Test
    void blankApiKeyCountsAsLogMode() {
        BrevoMailClient client = new BrevoMailClient(
                "https://api.brevo.com", "   ", "no-reply@fasearch.local", "FaSearch",
                shortTimeoutClient("https://api.brevo.com"));

        assertThat(client.isBrevoMode()).isFalse();
    }

    @Test
    void brevoModeRetriesOnceThenFailsWithEmailSendFailed() {
        // Port 9 (discard) tu choi ket noi ngay lap tuc: that bai nhanh, khong treo test.
        BrevoMailClient client = new BrevoMailClient(
                "http://127.0.0.1:9", "dummy-key-khong-that", "no-reply@fasearch.local", "FaSearch",
                shortTimeoutClient("http://127.0.0.1:9"));

        assertThat(client.isBrevoMode()).isTrue();
        assertThatThrownBy(() -> client.send("user@example.invalid", "User", "Subject", "<p>html</p>", "text"))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.EMAIL_SEND_FAILED));
    }
}
