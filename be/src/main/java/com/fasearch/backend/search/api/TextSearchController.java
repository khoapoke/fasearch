package com.fasearch.backend.search.api;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasearch.backend.search.application.SearchException;
import com.fasearch.backend.search.application.TextSearchUseCase;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping("/api/v1/search")
public class TextSearchController {

	private static final int MAX_TRACE_LENGTH = 128;
	private static final int MAX_JSON_BYTES = 16 * 1024;
	private static final Set<String> ALLOWED_FIELDS = Set.of("schema_version", "query_text", "k");

	private final TextSearchUseCase textSearch;
	private final JsonMapper json;

	public TextSearchController(TextSearchUseCase textSearch, JsonMapper json) {
		this.textSearch = textSearch;
		this.json = json;
	}

	@PostMapping(path = "/text", consumes = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<TextSearchUseCase.Result> search(
			HttpServletRequest request,
			@RequestHeader(name = "X-Trace-Id", required = false) String incomingTraceId) {
		String traceId = resolveTraceId(incomingTraceId);
		request.setAttribute("fasearch.trace-id", traceId);
		TextSearchUseCase.Command command = parse(request, traceId);
		TextSearchUseCase.Result result = textSearch.search(command);
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.header("X-Trace-Id", traceId)
				.body(result);
	}

	private TextSearchUseCase.Command parse(HttpServletRequest request, String traceId) {
		byte[] body = readCapped(request);
		JsonNode node;
		try {
			node = json.readTree(new String(body, StandardCharsets.UTF_8));
		}
		catch (RuntimeException exception) {
			throw invalid("Request validation failed");
		}
		if (node == null || !node.isObject()) {
			throw invalid("Request validation failed");
		}
		for (String field : node.propertyNames()) {
			if (!ALLOWED_FIELDS.contains(field)) {
				throw invalid("Unknown field");
			}
		}
		JsonNode schemaVersion = node.get("schema_version");
		if (schemaVersion == null || !"1.0.0".equals(schemaVersion.asText())) {
			throw invalid("Unsupported schema_version");
		}
		JsonNode queryText = node.get("query_text");
		if (queryText == null || !queryText.isTextual()) {
			throw invalid("Missing query_text");
		}
		int k = 10;
		JsonNode kNode = node.get("k");
		if (kNode != null && !kNode.isNull()) {
			if (!kNode.isInt() && !kNode.isLong()) {
				throw invalid("Invalid k");
			}
			k = kNode.asInt();
		}
		return new TextSearchUseCase.Command(queryText.asText(), k, traceId);
	}

	private static byte[] readCapped(HttpServletRequest request) {
		try (InputStream input = request.getInputStream();
				ByteArrayOutputStream output = new ByteArrayOutputStream()) {
			byte[] buffer = new byte[4096];
			int total = 0;
			int read;
			while ((read = input.read(buffer)) != -1) {
				total += read;
				if (total > MAX_JSON_BYTES) {
					throw new SearchException(
							"INVALID_REQUEST",
							HttpStatus.CONTENT_TOO_LARGE,
							"Request body exceeds the 16 KiB limit");
				}
				output.write(buffer, 0, read);
			}
			return output.toByteArray();
		}
		catch (IOException exception) {
			throw new SearchException(
					"INVALID_REQUEST",
					HttpStatus.BAD_REQUEST,
					"Request body could not be read",
					exception);
		}
	}

	private static String resolveTraceId(String incomingTraceId) {
		if (incomingTraceId == null || incomingTraceId.isBlank()) {
			return UUID.randomUUID().toString();
		}
		if (incomingTraceId.length() > MAX_TRACE_LENGTH
				|| !incomingTraceId.matches("[A-Za-z0-9_\\-.:]+")) {
			throw invalid("Invalid trace identity");
		}
		return incomingTraceId;
	}

	private static SearchException invalid(String message) {
		return new SearchException(
				"INVALID_REQUEST",
				HttpStatus.BAD_REQUEST,
				message);
	}
}
