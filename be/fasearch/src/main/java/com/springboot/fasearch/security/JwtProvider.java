package com.springboot.fasearch.security;

import java.util.Date;
import java.util.function.Function;

import org.springframework.stereotype.Component;

import com.springboot.fasearch.config.JwtConfig;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.UnsupportedJwtException;
import io.jsonwebtoken.security.SignatureException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtProvider {

    private final JwtConfig jwtConfig;

    public String generateToken(String username, String role, Long accountId) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtConfig.getExpirationMs());

        return Jwts.builder()
                .subject(username)
                .claim("role", role)
                .claim("accountId", accountId)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(jwtConfig.getSigningKey())
                .compact();
    }

    public String extractUsername(String token) {
        return extractClaim(token, claims ->claims.getSubject());
    }

    public String extractRole(String token) {
        return extractClaim(token, claims -> claims.get("role", String.class));
    }

    public Long extractAccountId(String token) {
        return extractClaim(token, claims -> claims.get("accountId", Long.class));
    }

    public Date extractExpiration(String token) {
        return extractClaim(token, claims->claims.getExpiration());
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    public boolean validateToken(String token) {
        try {
            extractAllClaims(token);
            return !isTokenExpired(token);
        } catch (SignatureException e) {
            log.error("Chữ ký JWT không hợp lệ: {}", e.getMessage());
        } catch (MalformedJwtException e) {
            log.error("Token JWT bị lỗi định dạng: {}", e.getMessage());
        } catch (ExpiredJwtException e) {
            log.warn("Token JWT đã hết hạn: {}", e.getMessage());
        } catch (UnsupportedJwtException e) {
            log.error("Token JWT không được hỗ trợ: {}", e.getMessage());
        } catch (IllegalArgumentException e) {
            log.error("Chuỗi claims JWT rỗng hoặc không hợp lệ: {}", e.getMessage());
        } catch (JwtException e) {
            log.error("Lỗi xác thực JWT: {}", e.getMessage());
        }
        return false;
    }

    public boolean isTokenExpired(String token) {
        try {
            return extractExpiration(token).before(new Date());
        } catch (ExpiredJwtException e) {
            return true;
        }
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(jwtConfig.getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
