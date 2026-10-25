package com.springboot.fasearch.config;

import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.Getter;

@Getter
@Configuration
public class JwtConfig {

    @Value("${jwt.secret-key}")
    private String secretKey;

    @Value("${jwt.expiration-ms:86400000}")
    private long expirationMs;

    public SecretKey getSigningKey() {
        if (secretKey == null || secretKey.isBlank()) {
            throw new IllegalStateException("JWT Secret Key không được để rỗng trong cấu hình!");
        }

        byte[] keyBytes;
        try {
            keyBytes = Decoders.BASE64URL.decode(secretKey);
        } catch (IllegalArgumentException e) {
            try {
                keyBytes = Decoders.BASE64.decode(secretKey);
            } catch (IllegalArgumentException ex) {
                keyBytes = secretKey.getBytes(StandardCharsets.UTF_8);
            }
        }

        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                    "JWT Secret Key phải chứa ít nhất 32 bytes (256 bits). Độ dài hiện tại: " + keyBytes.length + " bytes.");
        }

        return Keys.hmacShaKeyFor(keyBytes);
    }
}
