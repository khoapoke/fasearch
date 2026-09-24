package com.fasearch.backend.identity;

import java.io.IOException;
import java.util.Map;

import jakarta.servlet.http.HttpServletResponse;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;

import tools.jackson.databind.json.JsonMapper;

@Configuration(proxyBeanMethods = false)
@EnableMethodSecurity
public class SecurityConfiguration {

	@Bean
	PasswordEncoder passwordEncoder() {
		return new DelegatingPasswordEncoder(
				"bcrypt", Map.of("bcrypt", new BCryptPasswordEncoder(12)));
	}

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, JsonMapper json) throws Exception {
		HttpSessionCsrfTokenRepository csrfRepository = new HttpSessionCsrfTokenRepository();
		http
				.csrf(csrf -> csrf
						.csrfTokenRepository(csrfRepository)
						.ignoringRequestMatchers("/api/v1/search/image"))
				.authorizeHttpRequests(authorize -> authorize
						.requestMatchers("/actuator/health", "/api/v1/search/image",
								"/api/v1/catalog/images/**", "/api/v1/auth/csrf",
								"/api/v1/auth/login").permitAll()
						.requestMatchers("/api/v1/auth/me", "/api/v1/auth/logout").authenticated()
						.requestMatchers("/api/v1/catalog/admin/drafts", "/api/v1/catalog/admin/drafts/**")
								.hasAuthority("CATALOG_DRAFT_WRITE")
						.requestMatchers("/api/v1/catalog/admin/publications", "/api/v1/catalog/admin/publications/**")
								.hasAuthority("CATALOG_PUBLISH")
						.anyRequest().denyAll())
				.exceptionHandling(exceptions -> exceptions
						.authenticationEntryPoint((request, response, error) ->
								writeError(response, json, HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED"))
						.accessDeniedHandler((request, response, error) ->
								writeError(response, json, HttpStatus.FORBIDDEN, "FORBIDDEN")))
				.httpBasic(AbstractHttpConfigurer::disable)
				.requestCache(AbstractHttpConfigurer::disable)
				.formLogin(form -> form
						.loginProcessingUrl("/api/v1/auth/login")
						.successHandler((request, response, authentication) ->
								writeSuccess(response, json, authentication))
						.failureHandler((request, response, error) ->
								writeError(response, json, HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS")))
				.logout(logout -> logout
						.logoutUrl("/api/v1/auth/logout")
						.invalidateHttpSession(true)
						.deleteCookies("FASEARCH_SESSION")
						.logoutSuccessHandler((request, response, authentication) -> {
							response.setStatus(HttpStatus.NO_CONTENT.value());
						}))
				.sessionManagement(session -> session.sessionFixation(fixation -> fixation.changeSessionId()));
		return http.build();
	}

	private static void writeSuccess(
			HttpServletResponse response,
			JsonMapper json,
			Authentication authentication) throws IOException {
		response.setStatus(HttpStatus.OK.value());
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		response.getWriter().write(json.writeValueAsString(Map.of(
				"username", authentication.getName(),
				"authenticated", true)));
	}

	private static void writeError(
			HttpServletResponse response,
			JsonMapper json,
			HttpStatus status,
			String code) throws IOException {
		response.setStatus(status.value());
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		response.getWriter().write(json.writeValueAsString(Map.of(
				"code", code,
				"message", status.getReasonPhrase())));
	}
}
