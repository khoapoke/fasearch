package com.fasearch.backend.catalog;

import java.io.IOException;
import java.util.UUID;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.fasearch.backend.catalog.CatalogDraftModule.Draft;
import com.fasearch.backend.catalog.CatalogImageModule.ImageBytes;

@RestController
@RequestMapping("/api/v1/catalog/admin/drafts/{productId}/image")
public class CatalogDraftImageController {

	private final CatalogImageModule images;

	public CatalogDraftImageController(CatalogImageModule images) {
		this.images = images;
	}

	@PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public Draft replacePrimary(
			@PathVariable UUID productId,
			@RequestPart("image") MultipartFile image,
			@RequestParam("expected_version_no") int expectedVersionNo,
			@RequestHeader(name = "X-Trace-Id", required = false) String traceId,
			Authentication actor) {
		try {
			return images.replacePrimary(productId, expectedVersionNo,
					image.getBytes(), actor, traceId);
		}
		catch (IOException exception) {
			throw new CatalogDraftException("INVALID_IMAGE", HttpStatus.BAD_REQUEST,
					"Product image could not be read", exception);
		}
	}

	@GetMapping
	public ResponseEntity<byte[]> readPrimary(
			@PathVariable UUID productId, Authentication actor) {
		ImageBytes image = images.readPrimary(productId, actor);
		return ResponseEntity.ok()
				.header("X-Content-Type-Options", "nosniff")
				.cacheControl(CacheControl.noStore())
				.contentType(MediaType.parseMediaType(image.mediaType()))
				.body(image.bytes());
	}
}
