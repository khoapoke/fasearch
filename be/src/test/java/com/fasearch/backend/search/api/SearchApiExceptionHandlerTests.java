package com.fasearch.backend.search.api;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;

import com.fasearch.backend.search.application.SearchException;

class SearchApiExceptionHandlerTests {

	@Test
	void preControllerErrorsNeverReflectUnsafeIncomingTrace() {
		for (String unsafe : new String[] { "unsafe<probe>", "x".repeat(200) }) {
			MockHttpServletRequest request = new MockHttpServletRequest();
			request.addHeader("X-Trace-Id", unsafe);
			var response = new SearchApiExceptionHandler().handleSearchException(
					new SearchException("CATALOG_UNAVAILABLE", HttpStatus.SERVICE_UNAVAILABLE,
							"Catalog publication is not available"), request);
			assertThat(response.getBody().traceId()).isNotEqualTo(unsafe)
					.matches("[A-Za-z0-9_.:\\-]{1,128}");
			assertThat(response.getHeaders().getFirst("X-Trace-Id")).isEqualTo(response.getBody().traceId());
			assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
		}
	}

	@Test
	void validIncomingTraceAndSafeControllerTraceRemainStable() {
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.addHeader("X-Trace-Id", "valid-incoming");
		var handler = new SearchApiExceptionHandler();
		var error = new IllegalArgumentException("private input");
		assertThat(handler.handleValidationException(error, request).getBody().traceId()).isEqualTo("valid-incoming");
		request.setAttribute("fasearch.trace-id", "controller-trace");
		assertThat(handler.handleValidationException(error, request).getBody().traceId()).isEqualTo("controller-trace");
	}
}
