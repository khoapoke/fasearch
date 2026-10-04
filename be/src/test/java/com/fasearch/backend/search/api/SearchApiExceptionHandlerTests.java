package com.fasearch.backend.search.api;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/**
 * Envelope boundary: Spring's {@code max-request-size: 11MB} rejects an
 * over-envelope multipart body before the controller runs. This pins the
 * typed safe error the handler returns for that path (413
 * {@code IMAGE_TOO_LARGE}, no stack trace or filesystem path).
 */
class SearchApiExceptionHandlerTests {

	@Test
	void mapsOverEnvelopeUploadToSafe413Envelope() {
		SearchApiExceptionHandler handler = new SearchApiExceptionHandler();
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.setAttribute("fasearch.trace-id", "trace-envelope");

		var response = handler.handleUploadLimit(
				new MaxUploadSizeExceededException(11 * 1024 * 1024), request);

		assertThat(response.getStatusCode().value()).isEqualTo(413);
		assertThat(response.getBody().schemaVersion()).isEqualTo("1.0.0");
		assertThat(response.getBody().code()).isEqualTo("IMAGE_TOO_LARGE");
		assertThat(response.getBody().traceId()).isEqualTo("trace-envelope");
		assertThat(response.getBody().message()).doesNotContain("at ", "/tmp", ".java");
	}
}
