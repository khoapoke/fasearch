package com.fasearch.backend.search.api;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;

import com.fasearch.backend.search.application.ComposedSearchUseCase;
import com.fasearch.backend.search.application.ComposedSearchUseCase.Reference;
import com.fasearch.backend.search.application.SearchException;

@RestController
@RequestMapping("/api/v1/search")
public class ComposedSearchController {

	private static final Set<String> TEXT_PARTS = Set.of(
			"schema_version",
			"modification_text",
			"k",
			"anchor_product_id",
			"anchor_product_version_id",
			"anchor_catalog_snapshot_id");
	private static final int MAX_TRACE_LENGTH = 128;

	private final ComposedSearchUseCase composedSearch;

	public ComposedSearchController(ComposedSearchUseCase composedSearch) {
		this.composedSearch = composedSearch;
	}

	@PostMapping(path = "/composed", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public ResponseEntity<ComposedSearchUseCase.Result> search(
			MultipartHttpServletRequest multipart,
			@RequestHeader(name = "X-Trace-Id", required = false) String incomingTraceId,
			HttpServletRequest request) {
		String traceId = resolveTraceId(incomingTraceId);
		request.setAttribute("fasearch.trace-id", traceId);
		ComposedSearchUseCase.Command command = parse(multipart, traceId);
		ComposedSearchUseCase.Result result = composedSearch.search(command);
		return ResponseEntity.ok()
				.header("X-Trace-Id", traceId)
				.body(result);
	}

	private static ComposedSearchUseCase.Command parse(
			MultipartHttpServletRequest multipart, String traceId) {
		for (String name : multipart.getFileMap().keySet()) {
			if (!"image".equals(name)) {
				throw invalid("Unknown part: " + name);
			}
		}
		for (String name : multipart.getParameterMap().keySet()) {
			if (!TEXT_PARTS.contains(name)) {
				throw invalid("Unknown part: " + name);
			}
		}
		if (multipart.getFiles("image").size() > 1) {
			throw invalid("Duplicate 'image' part");
		}
		for (String name : TEXT_PARTS) {
			String[] values = multipart.getParameterMap().get(name);
			if (values != null && values.length > 1) {
				throw invalid("Duplicate '" + name + "' part");
			}
		}

		String schemaVersion = single(multipart, "schema_version");
		if (!"1.0.0".equals(schemaVersion)) {
			throw invalid("Unsupported schema_version");
		}
		String modificationText = single(multipart, "modification_text");
		int k = parseK(single(multipart, "k"));

		MultipartFile image = multipart.getFile("image");
		String anchorProductId = single(multipart, "anchor_product_id");
		String anchorProductVersionId = single(multipart, "anchor_product_version_id");
		String anchorSnapshotId = single(multipart, "anchor_catalog_snapshot_id");
		boolean hasAnchorPart = anchorProductId != null
				|| anchorProductVersionId != null
				|| anchorSnapshotId != null;

		Reference reference;
		if (image != null && hasAnchorPart) {
			throw invalid("Image and anchor reference cannot be combined");
		}
		if (image != null) {
			reference = new Reference.Upload(
					readBytes(image), image.getContentType(), image.getOriginalFilename());
		}
		else if (hasAnchorPart) {
			if (anchorProductId == null || anchorProductVersionId == null || anchorSnapshotId == null) {
				throw invalid("Incomplete anchor reference");
			}
			reference = new Reference.Product(anchorProductId, anchorProductVersionId, anchorSnapshotId);
		}
		else {
			throw invalid("Missing image or anchor reference");
		}
		return new ComposedSearchUseCase.Command(reference, modificationText, k, traceId);
	}

	private static String single(MultipartHttpServletRequest multipart, String name) {
		String[] values = multipart.getParameterMap().get(name);
		if (values == null || values.length == 0) {
			return null;
		}
		return values[0];
	}

	private static int parseK(String raw) {
		if (raw == null) {
			return 10;
		}
		if (!raw.matches("[0-9]+")) {
			throw invalid("Invalid k");
		}
		try {
			return Integer.parseInt(raw);
		}
		catch (NumberFormatException exception) {
			throw invalid("Invalid k");
		}
	}

	private static byte[] readBytes(MultipartFile image) {
		try {
			return image.getBytes();
		}
		catch (IOException exception) {
			throw new SearchException(
					"INVALID_IMAGE",
					org.springframework.http.HttpStatus.BAD_REQUEST,
					"Image upload could not be read",
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
				org.springframework.http.HttpStatus.BAD_REQUEST,
				message);
	}
}
