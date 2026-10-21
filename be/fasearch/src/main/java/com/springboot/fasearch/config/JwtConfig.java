package com.springboot.fasearch.config;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;

import javax.crypto.SecretKey;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;


@Setter 
@Getter 
@AllArgsConstructor 
@Configuration 
public class JwtConfig {
    private  String secretKey;
    private  LocalDateTime expiration;


    @Bean
    public SecretKey getJwtSecretKey() {
        if (secretKey == null || secretKey.isBlank()) {
            throw new IllegalStateException("JWT Secret Key không được để rỗng trong file cấu hình/env!");
        }

        byte[] keyBytes;
        try {
            keyBytes = Decoders.BASE64URL.decode(secretKey);
        } catch (IllegalArgumentException e) {
            keyBytes = secretKey.getBytes(StandardCharsets.UTF_8);
        }

        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                    "JWT secret key phải chứa ít nhất 32 bytes (256 bits). Độ dài hiện tại: " + keyBytes.length
                            + " bytes.");
        }

        return Keys.hmacShaKeyFor(keyBytes);
    }
}
