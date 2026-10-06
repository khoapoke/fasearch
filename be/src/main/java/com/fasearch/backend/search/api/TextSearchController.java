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
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasearch.backend.library.LibraryModule;
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
	private final LibraryModule library;
	private final JsonMapper json;

	public TextSearchController(TextSearchUseCase textSearch, LibraryModule library, JsonMapper json) {
		this.textSearch = textSearch;
		this.library = library;
		this.json = json;
	}

	@PostMapping(path = "/text", consumes = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<TextSearchUseCase.Result> search(
			HttpServletRequest request,
			Authentication authentication,
			@RequestHeader(name = "X-Trace-Id", required = false) String incomingTraceId) {
		String traceId = resolveTraceId(incomingTraceId);
		request.setAttribute("fasearch.trace-id", traceId);
		TextSearchUseCase.Command command = parse(request, traceId);
		TextSearchUseCase.Result result = textSearch.search(command);
		LibraryModule.HistoryStatus history = library.recordAfterSuccess(
				authentication, "TEXT", command.queryText(),
				result.publication().catalogSnapshotId(), result.publication().modelVersion(),
				result.publication().indexVersion(),
				result.results().stream()
						.map(product -> new LibraryModule.ProductRef(
									product.productId(), product.productVersionId(), product.rank()))
						.toList(),
				result.results().size(), command.traceId());
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.header("X-Trace-Id", traceId)
				.header("X-History-Status", history.name())
				.body(result);
	}

	private TextSearchUseCase.Command parse(HttpServletRequest request, String traceId) {
		byte[] body = readCapped(request);
		JsonNode node;
		try {
			node = json.readTree(strictUtf8(body));
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
		String rawQuery = queryText.asText();
		if (hasLoneSurrogate(rawQuery)) {
			throw invalid("Query text is not valid UTF-8 text");
		}
		int k = 10;
		JsonNode kNode = node.get("k");
		if (kNode != null) {
			if (kNode.isNull()
					|| kNode.isBoolean()
					|| !kNode.isNumber()
					|| kNode.isFloatingPointNumber()) {
				throw invalid("Invalid k");
			}
			long wide = kNode.asLong();
			if (wide < 1 || wide > 100 || wide != kNode.asInt()) {
				throw invalid("Invalid k");
			}
			k = (int) wide;
		}
		return new TextSearchUseCase.Command(rawQuery, k, traceId);
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

	private static String strictUtf8(byte[] body) {
		try {
			return java.nio.charset.Charset.forName("UTF-8")
					.newDecoder()
					.onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
					.onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT)
					.decode(java.nio.ByteBuffer.wrap(body))
					.toString();
		}
		catch (java.nio.charset.CharacterCodingException exception) {
			throw invalid("Request body is not valid UTF-8");
		}
	}

	private static boolean hasLoneSurrogate(String value) {
		for (int i = 0; i < value.length(); i++) {
			char ch = value.charAt(i);
			if (Character.isHighSurrogate(ch)) {
				if (i + 1 >= value.length() || !Character.isLowSurrogate(value.charAt(i + 1))) {
					return true;
				}
				i++;
			}
			else if (Character.isLowSurrogate(ch)) {
				return true;
			}
		}
		return false;
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
