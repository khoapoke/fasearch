package com.fasearch.backend.library;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/v1/me")
public class LibraryController {

	private final LibraryModule library;

	public LibraryController(LibraryModule library) {
		this.library = library;
	}

	@PutMapping("/saved-products/{productId}")
	public ResponseEntity<Void> saveProduct(
			Authentication authentication,
			@PathVariable String productId) {
		library.saveProduct(authentication, productId);
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}

	@DeleteMapping("/saved-products/{productId}")
	public ResponseEntity<Void> removeProduct(
			Authentication authentication,
			@PathVariable String productId) {
		library.removeProduct(authentication, productId);
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}

	@GetMapping("/saved-products")
	public ResponseEntity<LibraryModule.SavedPage> listSaved(
			Authentication authentication,
			@RequestParam(name = "page", defaultValue = "1") int page,
			@RequestParam(name = "size", defaultValue = "20") int size) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(library.listSaved(authentication, page, size));
	}

	@GetMapping("/library-preferences")
	public ResponseEntity<LibraryModule.Preferences> getPreferences(Authentication authentication) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(library.getPreferences(authentication));
	}

	@PatchMapping("/library-preferences")
	public ResponseEntity<LibraryModule.Preferences> updatePreferences(
			Authentication authentication, @RequestBody JsonNode body) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(library.updatePreferences(authentication, body));
	}

	@GetMapping("/search-history")
	public ResponseEntity<LibraryModule.HistoryPage> listHistory(
			Authentication authentication,
			@RequestParam(name = "mode", required = false) String mode,
			@RequestParam(name = "page", defaultValue = "1") int page,
			@RequestParam(name = "size", defaultValue = "20") int size) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(library.listHistory(authentication, mode, page, size));
	}

	@DeleteMapping("/search-history/{entryId}")
	public ResponseEntity<Void> deleteHistoryEntry(
			Authentication authentication, @PathVariable String entryId) {
		library.deleteHistoryEntry(authentication, entryId);
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}

	@DeleteMapping("/search-history")
	public ResponseEntity<Void> clearHistory(Authentication authentication) {
		library.clearHistory(authentication);
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}
}
