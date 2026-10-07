package com.fasearch.backend.library;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;

// Unit proof for the masked-token resolution the public image endpoint relies
// on: same machinery as the filter chain (session repository + XOR handler),
// exercised without HTTP.
class HistoryCsrfAuthorizerTests {

	private final HistoryCsrfAuthorizer authorizer = new HistoryCsrfAuthorizer();
	private final HttpSessionCsrfTokenRepository repository = new HttpSessionCsrfTokenRepository();

	private MockHttpServletRequest requestWithSession(MockHttpSession session, String presented) {
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.setSession(session);
		if (presented != null) {
			request.addHeader("X-CSRF-TOKEN", presented);
		}
		return request;
	}

	private String maskedTokenFor(MockHttpSession session) {
		MockHttpServletRequest generating = new MockHttpServletRequest();
		generating.setSession(session);
		MockHttpServletResponse response = new MockHttpServletResponse();
		CsrfToken generated = repository.generateToken(generating);
		repository.saveToken(generated, generating, response);
		// Present the token exactly as the XOR request handler serves it to
		// pages (masked on the wire, raw in the session): handle() installs a
		// supplier whose token value is the masked form of the raw token.
		org.springframework.security.web.csrf.XorCsrfTokenRequestAttributeHandler handler =
				new org.springframework.security.web.csrf.XorCsrfTokenRequestAttributeHandler();
		MockHttpServletRequest serving = new MockHttpServletRequest();
		serving.setSession(session);
		handler.handle(serving, response, () -> generated);
		CsrfToken masked =
				(CsrfToken) serving.getAttribute(CsrfToken.class.getName());
		return masked.getToken();
	}

	@Test
	void validOwnSessionMaskedTokenAuthorizes() {
		MockHttpSession session = new MockHttpSession();
		String masked = maskedTokenFor(session);

		assertThat(authorizer.isValidCurrentSessionToken(requestWithSession(session, masked)))
				.isTrue();
	}

	@Test
	void missingTokenDoesNotAuthorize() {
		MockHttpSession session = new MockHttpSession();
		maskedTokenFor(session);

		assertThat(authorizer.isValidCurrentSessionToken(requestWithSession(session, null)))
				.isFalse();
	}

	@Test
	void forgedTokenDoesNotAuthorize() {
		MockHttpSession session = new MockHttpSession();
		maskedTokenFor(session);

		assertThat(authorizer.isValidCurrentSessionToken(requestWithSession(session, "forged")))
				.isFalse();
	}

	@Test
	void crossSessionTokenDoesNotAuthorize() {
		MockHttpSession victim = new MockHttpSession();
		MockHttpSession attacker = new MockHttpSession();
		maskedTokenFor(victim);
		String attackerMasked = maskedTokenFor(attacker);

		assertThat(authorizer.isValidCurrentSessionToken(requestWithSession(victim, attackerMasked)))
				.isFalse();
	}

	@Test
	void sessionWithoutTokenDoesNotAuthorize() {
		assertThat(authorizer
				.isValidCurrentSessionToken(requestWithSession(new MockHttpSession(), "anything")))
				.isFalse();
	}

	@Test
	void requestWithoutSessionDoesNotAuthorizeAndMintsNothing() {
		MockHttpServletRequest request = new MockHttpServletRequest();

		assertThat(authorizer.isValidCurrentSessionToken(request)).isFalse();
		assertThat(request.getSession(false)).isNull();
	}
}
