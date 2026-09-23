package com.fasearch.backend.search.api;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasearch.backend.search.application.CatalogImageReader;
import com.fasearch.backend.search.application.CatalogProductReader;

@RestController
@RequestMapping("/api/v1/catalog/images")
public class CatalogImageController {

	private final CatalogImageReader images;

	public CatalogImageController(CatalogImageReader images) {
		this.images = images;
	}

	@GetMapping("/{productId}/{productVersionId}")
	public ResponseEntity<byte[]> getImage(
			@PathVariable String productId,
			@PathVariable String productVersionId) {
		return images.findActiveImage(new CatalogProductReader.Key(productId, productVersionId))
				.map(image -> ResponseEntity.ok()
						.contentType(MediaType.parseMediaType(image.contentType()))
						.cacheControl(CacheControl.noStore())
						.body(image.content()))
				.orElseGet(() -> ResponseEntity.notFound().build());
	}
}
