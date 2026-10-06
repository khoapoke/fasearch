package com.fasearch.backend.search.api;

import java.io.IOException;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.fasearch.backend.library.LibraryModule;
import com.fasearch.backend.search.application.ImageSearchUseCase;
import com.fasearch.backend.search.application.SearchException;

@RestController
@RequestMapping("/api/v1/search")
public class ImageSearchController {

	private final ImageSearchUseCase imageSearch;
	private final LibraryModule library;

	public ImageSearchController(ImageSearchUseCase imageSearch, LibraryModule library) {
		this.imageSearch = imageSearch;
		this.library = library;
	}

	@PostMapping(path = "/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public ResponseEntity<ImageSearchUseCase.Result> search(
			@RequestPart("image") MultipartFile image,
			@RequestParam(name = "k", defaultValue = "10") int k,
			@RequestHeader(name = "X-Trace-Id", required = false) String incomingTraceId,
			Authentication authentication,
			HttpServletRequest request) {
		String traceId = incomingTraceId == null || incomingTraceId.isBlank()
				? UUID.randomUUID().toString()
				: incomingTraceId;
		request.setAttribute("fasearch.trace-id", traceId);
		try {
			ImageSearchUseCase.Result result = imageSearch.search(new ImageSearchUseCase.Command(
					image.getBytes(),
					image.getContentType(),
					image.getOriginalFilename(),
					k,
					traceId));
			LibraryModule.HistoryStatus history = library.recordAfterSuccess(
					authentication, "IMAGE", null,
					result.publication().catalogSnapshotId(), result.publication().modelVersion(),
					result.publication().indexVersion(),
					result.results().stream()
						.map(product -> new LibraryModule.ProductRef(
									product.productId(), product.productVersionId(), product.rank()))
						.toList(),
					result.results().size(), traceId);
			return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
					.header("X-Trace-Id", traceId)
					.header("X-History-Status", history.name())
					.body(result);
		}
		catch (IOException exception) {
			throw new SearchException(
					"INVALID_IMAGE",
					org.springframework.http.HttpStatus.BAD_REQUEST,
					"Image upload could not be read",
					exception);
		}
	}
}
