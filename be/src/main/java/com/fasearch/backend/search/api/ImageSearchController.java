package com.fasearch.backend.search.api;

import java.io.IOException;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.fasearch.backend.search.application.ImageSearchUseCase;
import com.fasearch.backend.search.application.SearchException;

@RestController
@RequestMapping("/api/v1/search")
public class ImageSearchController {

	private final ImageSearchUseCase imageSearch;

	public ImageSearchController(ImageSearchUseCase imageSearch) {
		this.imageSearch = imageSearch;
	}

	@PostMapping(path = "/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public ResponseEntity<ImageSearchUseCase.Result> search(
			@RequestPart("image") MultipartFile image,
			@RequestParam(name = "k", defaultValue = "10") int k,
			@RequestHeader(name = "X-Trace-Id", required = false) String incomingTraceId,
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
			return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
					.header("X-Trace-Id", traceId)
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
