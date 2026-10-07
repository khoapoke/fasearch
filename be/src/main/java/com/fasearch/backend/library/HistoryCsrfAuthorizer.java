package com.fasearch.backend.library;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.security.web.csrf.XorCsrfTokenRequestAttributeHandler;
import org.springframework.stereotype.Component;

/**
 * Validates a presented CSRF token against the caller's own current session
 * using the exact Spring Security machinery (same session repository as the
 * filter chain, same BREACH-masking request handler, constant-time comparison
 * like {@code CsrfFilter}). Used only to authorize the personal-history side
 * effect on the public CSRF-exempt image endpoint: the search itself stays
 * public, history requires proof of a valid current-session token. Never
 * creates a session and never throws: any doubt means "not authorized".
 */
@Component
public class HistoryCsrfAuthorizer {

	private final HttpSessionCsrfTokenRepository repository = new HttpSessionCsrfTokenRepository();
	private final XorCsrfTokenRequestAttributeHandler handler =
			new XorCsrfTokenRequestAttributeHandler();

	public boolean isValidCurrentSessionToken(HttpServletRequest request) {
		CsrfToken expected;
		try {
			// loadToken (not the deferred get): no session/token is minted here.
			expected = repository.loadToken(request);
		}
		catch (RuntimeException missing) {
			return false;
		}
		if (expected == null || expected.getToken() == null) {
			return false;
		}
		String resolved;
		try {
			// The handler reads the presented header/parameter from the
			// request itself and unmasks it against the session token; a
			// missing, forged or foreign-session value resolves to null.
			resolved = handler.resolveCsrfTokenValue(request, expected);
		}
		catch (RuntimeException invalid) {
			return false;
		}
		if (resolved == null) {
			return false;
		}
		return MessageDigest.isEqual(
				resolved.getBytes(StandardCharsets.UTF_8),
				expected.getToken().getBytes(StandardCharsets.UTF_8));
	}
}
