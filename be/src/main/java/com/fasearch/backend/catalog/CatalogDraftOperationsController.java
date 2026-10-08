package com.fasearch.backend.catalog;

import java.util.UUID;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fasearch.backend.catalog.CatalogDraftOperations.AuditList;
import com.fasearch.backend.catalog.CatalogDraftOperations.DraftSummaryCounts;
import com.fasearch.backend.catalog.CatalogDraftOperations.VersionDetail;
import com.fasearch.backend.catalog.CatalogDraftOperations.VersionList;
import com.fasearch.backend.catalog.CatalogImageModule.ImageBytes;

/**
 * Read-only operations for the Catalog Operations Console. All endpoints
 * require CATALOG_DRAFT_WRITE with the existing owner/CATALOG_PUBLISH
 * binding enforced by {@link CatalogDraftOperations}.
 */
@RestController
@RequestMapping("/api/v1/catalog/admin/drafts")
public class CatalogDraftOperationsController {

	private final CatalogDraftOperations operations;

	public CatalogDraftOperationsController(CatalogDraftOperations operations) {
		this.operations = operations;
	}

	@GetMapping("/summary")
	public ResponseEntity<DraftSummaryCounts> summary(Authentication actor) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(operations.summary(actor));
	}

	@GetMapping("/{productId}/versions")
	public ResponseEntity<VersionList> versions(
			@PathVariable UUID productId,
			@RequestParam(name = "limit", required = false) String limit,
			@RequestParam(name = "offset", required = false) String offset,
			Authentication actor) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(operations.versions(productId, limit, offset, actor));
	}

	@GetMapping("/{productId}/versions/{productVersionId}")
	public ResponseEntity<VersionDetail> version(
			@PathVariable UUID productId,
			@PathVariable UUID productVersionId,
			Authentication actor) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(operations.versionDetail(productId, productVersionId, actor));
	}

	@GetMapping("/{productId}/versions/{productVersionId}/image")
	public ResponseEntity<byte[]> versionImage(
			@PathVariable UUID productId,
			@PathVariable UUID productVersionId,
			Authentication actor) {
		ImageBytes image = operations.versionImage(productId, productVersionId, actor);
		return ResponseEntity.ok()
				.header("X-Content-Type-Options", "nosniff")
				.cacheControl(CacheControl.noStore())
				.contentType(MediaType.parseMediaType(image.mediaType()))
				.body(image.bytes());
	}

	@GetMapping("/{productId}/audit")
	public ResponseEntity<AuditList> audit(
			@PathVariable UUID productId,
			@RequestParam(name = "limit", required = false) String limit,
			@RequestParam(name = "offset", required = false) String offset,
			Authentication actor) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(operations.audit(productId, limit, offset, actor));
	}
}
