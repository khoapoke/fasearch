package com.springboot.fasearch.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import com.springboot.fasearch.common.enums.RoleType;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.springboot.fasearch.security.CustomAccessDeniedHandler;
import com.springboot.fasearch.security.JwtAuthenticationEntryPoint;
import com.springboot.fasearch.security.JwtAuthenticationFilter;

import lombok.RequiredArgsConstructor;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;
    private final CustomAccessDeniedHandler customAccessDeniedHandler;

    private static final String[] PUBLIC_ENDPOINTS = {
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/swagger-ui/**",
            "/swagger-ui.html",
            "/v3/api-docs/**",
            "/v3/api-docs",
            "/favicon.ico"
    };

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf->csrf.disable()) // tắt cơ chế bảo vệ chống tấn công CSRF
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(jwtAuthenticationEntryPoint)
                        .accessDeniedHandler(customAccessDeniedHandler))
                .authorizeHttpRequests(auth -> auth
                        // 1. Nhóm endpoint công khai (Public)
                        .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                        .requestMatchers("/api/v1/products/pos-lookup/**", "/api/v1/products/pos-search/**", "/api/v1/products/variants/*/barcode/**")
                                .hasAnyRole(RoleType.ADMIN.name(), RoleType.STAFF.name())
                        .requestMatchers(HttpMethod.GET, "/api/v1/products/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/categories/**").permitAll()

                        // 2. Nhóm quyền Admin
                        .requestMatchers("/api/v1/admin/**").hasRole(RoleType.ADMIN.toString())
                        .requestMatchers("/api/v1/auth/accounts/**").hasRole(RoleType.ADMIN.name())
                        .requestMatchers("/api/v1/categories/**").hasRole(RoleType.ADMIN.name())
                        .requestMatchers("/api/v1/products/**").hasRole(RoleType.ADMIN.name())

                        // 3. Nhóm quyền Nhân viên hoặc Admin
                        .requestMatchers("/api/v1/staff/**").hasAnyRole(RoleType.ADMIN.toString(), RoleType.STAFF.toString())
                        .requestMatchers("/api/v1/users/**").hasAnyRole(RoleType.ADMIN.name(), RoleType.STAFF.name(), RoleType.CUSTOMER.name())
                        .requestMatchers("/api/v1/inventory/**").hasAnyRole(RoleType.ADMIN.name(), RoleType.STAFF.name())

                        // 4. Nhóm quyền Khách hàng & Đơn hàng
                        .requestMatchers(HttpMethod.GET, "/api/v1/orders/**").hasAnyRole(RoleType.ADMIN.name(), RoleType.STAFF.name(), RoleType.CUSTOMER.name())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/orders/*/status").hasAnyRole(RoleType.ADMIN.name(), RoleType.STAFF.name())
                        .requestMatchers("/api/v1/cart/**").hasRole(RoleType.CUSTOMER.toString())
                        .requestMatchers("/api/v1/orders/checkout").hasRole(RoleType.CUSTOMER.toString())
                        .requestMatchers("/api/v1/orders/my-orders/**").hasRole(RoleType.CUSTOMER.toString())

                        // Mọi endpoint còn lại bắt buộc phải xác thực
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(List.of("*"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
