package com.fasearch.backend.search.api;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasearch.backend.search.application.PublicCatalogBrowseUseCase;
import com.fasearch.backend.search.application.SearchException;

/**
 * Public read-only catalog browse on the pinned immutable pilot publication.
 * Query parsing is strict: unknown, duplicate, blank-invalid or overflowing
 * values fail with typed {@code INVALID_REQUEST}. Success and error outcomes
 * are {@code no-store} with a safe trace identity.
 */
@RestController
@RequestMapping("/api/v1/catalog/products")
public class PublicCatalogController {

	private static final Set<String> LIST_PARAMS = Set.of(
			"page", "size", "category", "catalog_snapshot_id");
	private static final Set<String> DETAIL_PARAMS = Set.of(
			"product_version_id", "catalog_snapshot_id");
	private static final int MAX_TRACE_LENGTH = 128;
	private static final int MAX_SNAPSHOT_CODE_POINTS = 256;

	private final PublicCatalogBrowseUseCase browse;

	public PublicCatalogController(PublicCatalogBrowseUseCase browse) {
		this.browse = browse;
	}

	@GetMapping
	public ResponseEntity<PublicCatalogBrowseUseCase.PageResult> list(HttpServletRequest request) {
		String traceId = safeTraceId(request);
		Map<String, String> params = parseQuery(request.getQueryString(), LIST_PARAMS);
		int page = parsePage(params.get("page"));
		int size = parseSize(params.get("size"));
		String category = parseCategory(params.get("category"));
		String snapshot = parseSnapshot(params.get("catalog_snapshot_id"));
		PublicCatalogBrowseUseCase.PageResult result = browse.list(
				new PublicCatalogBrowseUseCase.ListQuery(page, size, category, snapshot, traceId));
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.header("X-Trace-Id", traceId)
				.body(result);
	}

	@GetMapping("/{productId}")
	public ResponseEntity<PublicCatalogBrowseUseCase.DetailResult> detail(
			@PathVariable String productId,
			HttpServletRequest request) {
		String traceId = safeTraceId(request);
		if (productId == null || productId.isBlank()) {
			throw invalid("Invalid product identity");
		}
		Map<String, String> params = parseQuery(request.getQueryString(), DETAIL_PARAMS);
		String version = parseSnapshot(params.get("product_version_id"));
		String snapshot = parseSnapshot(params.get("catalog_snapshot_id"));
		if ((version == null) != (snapshot == null)) {
			throw invalid("Expected product context requires both version and snapshot");
	}
		PublicCatalogBrowseUseCase.DetailResult result = browse.detail(
				new PublicCatalogBrowseUseCase.DetailQuery(
						productId, version, snapshot, traceId));
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.header("X-Trace-Id", traceId)
				.body(result);
	}

	private static Map<String, String> parseQuery(String raw, Set<String> allowed) {
		Map<String, String> params = new LinkedHashMap<>();
		if (raw == null || raw.isEmpty()) {
			return params;
		}
		for (String token : raw.split("&", -1)) {
			if (token.isEmpty()) {
				throw invalid("Invalid query");
			}
			int separator = token.indexOf('=');
			if (separator < 0) {
				throw invalid("Invalid query");
			}
			String name = token.substring(0, separator);
			String value = token.substring(separator + 1);
			String decodedName;
			String decodedValue;
			try {
				decodedName = URLDecoder.decode(name, StandardCharsets.UTF_8);
				decodedValue = value == null ? null : URLDecoder.decode(value, StandardCharsets.UTF_8);
			}
			catch (IllegalArgumentException exception) {
				throw invalid("Invalid query encoding");
			}
			if (!allowed.contains(decodedName)) {
				throw invalid("Unknown query parameter");
			}
			if (params.containsKey(decodedName)) {
				throw invalid("Duplicate query parameter");
			}
			params.put(decodedName, decodedValue);
		}
		return params;
	}

	private static int parsePage(String raw) {
		if (raw == null) {
			return 1;
		}
		if (raw.isBlank() || !raw.matches("[0-9]+")) {
			throw invalid("Invalid page");
		}
		try {
			long wide = Long.parseLong(raw);
			if (wide < 1 || wide > Integer.MAX_VALUE) {
				throw invalid("Invalid page");
			}
			return (int) wide;
		}
		catch (NumberFormatException exception) {
			throw invalid("Invalid page");
		}
	}

	private static int parseSize(String raw) {
		if (raw == null) {
			return 24;
		}
		if (raw.isBlank() || !raw.matches("[0-9]+")) {
			throw invalid("Invalid size");
		}
		try {
			long wide = Long.parseLong(raw);
			if (wide < 1 || wide > 60) {
				throw invalid("Invalid size");
			}
			return (int) wide;
		}
		catch (NumberFormatException exception) {
			throw invalid("Invalid size");
		}
	}

	private static String parseCategory(String raw) {
		if (raw == null) {
			return null;
		}
		if (raw.isBlank()
				|| (!"TOP".equals(raw) && !"BOTTOM".equals(raw) && !"ONE_PIECE".equals(raw))) {
			throw invalid("Invalid category");
		}
		return raw;
	}

	private static String parseSnapshot(String raw) {
		if (raw == null) {
			return null;
		}
		if (raw.isBlank()
				|| raw.codePointCount(0, raw.length()) > MAX_SNAPSHOT_CODE_POINTS) {
			throw invalid("Invalid snapshot reference");
		}
		return raw;
	}

	/**
	 * Resolve the incoming trace, or mint a safe one. A rejected trace value
	 * is never reflected in the error envelope: the handler falls back to
	 * the request attribute, so it must already hold a generated identity
	 * before any validation failure is thrown.
	 */
	private static String safeTraceId(HttpServletRequest request) {
		try {
			String traceId = resolveTraceId(request.getHeader("X-Trace-Id"));
			request.setAttribute("fasearch.trace-id", traceId);
			return traceId;
		}
		catch (SearchException invalid) {
			String generated = UUID.randomUUID().toString();
			request.setAttribute("fasearch.trace-id", generated);
			throw invalid;
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
				org.springframework.http.HttpStatus.BAD_REQUEST,
				message);
	}
}
