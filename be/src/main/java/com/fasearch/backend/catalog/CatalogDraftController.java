package com.fasearch.backend.catalog;

import java.net.URI;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fasearch.backend.catalog.CatalogDraftModule.Category;
import com.fasearch.backend.catalog.CatalogDraftModule.CreateDraft;
import com.fasearch.backend.catalog.CatalogDraftModule.Draft;
import com.fasearch.backend.catalog.CatalogDraftModule.DraftList;

@RestController
@RequestMapping("/api/v1/catalog/admin/drafts")
public class CatalogDraftController {

	private final CatalogDraftModule module;

	public CatalogDraftController(CatalogDraftModule module) {
		this.module = module;
	}

	@PostMapping
	public ResponseEntity<Draft> create(
			@Valid @RequestBody DraftInput input,
			@RequestHeader(name = "X-Trace-Id", required = false) String traceId,
			Authentication actor) {
		Draft draft = module.create(
				new CreateDraft(input.title(), input.description(), input.category()),
				actor,
				traceId);
		return ResponseEntity.created(URI.create(
				"/api/v1/catalog/admin/drafts/" + draft.productId())).body(draft);
	}

	@GetMapping
	public DraftList list(
			@RequestParam(name = "limit", required = false) String limit,
			@RequestParam(name = "offset", required = false) String offset,
			@RequestParam(name = "q", required = false) String query,
			@RequestParam(name = "category", required = false) String category,
			@RequestParam(name = "has_primary_image", required = false) String hasPrimaryImage,
			Authentication actor) {
		return module.list(limit, offset, query, category, hasPrimaryImage, actor);
	}

	@GetMapping("/{productId}")
	public Draft get(@PathVariable UUID productId, Authentication actor) {
		return module.get(productId, actor);
	}

	@PatchMapping("/{productId}")
	public Draft revise(
			@PathVariable UUID productId,
			@Valid @RequestBody DraftRevision input,
			@RequestHeader(name = "X-Trace-Id", required = false) String traceId,
			Authentication actor) {
		return module.revise(productId, input.expectedVersionNo(),
				new CreateDraft(input.title(), input.description(), input.category()), actor, traceId);
	}

	public record DraftInput(
			@NotBlank @Size(max = 250) String title,
			@Size(max = 4000) String description,
			@NotNull Category category) {
	}

	public record DraftRevision(
			@NotBlank @Size(max = 250) String title,
			@Size(max = 4000) String description,
			@NotNull Category category,
			@jakarta.validation.constraints.Min(1) int expectedVersionNo) {
	}
}
