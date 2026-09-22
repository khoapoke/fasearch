package com.fasearch.backend.search.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

import com.fasearch.backend.search.application.SearchException;

@RestControllerAdvice
public final class SearchApiExceptionHandler {

	@ExceptionHandler(SearchException.class)
	ResponseEntity<ApiError> handleSearchException(
			SearchException exception,
			HttpServletRequest request) {
		return ResponseEntity.status(exception.status())
				.body(ApiError.of(exception.code(), exception.getMessage(), traceId(request)));
	}

	@ExceptionHandler({
			ConstraintViolationException.class,
			MethodArgumentNotValidException.class,
			MissingServletRequestPartException.class,
			MissingServletRequestParameterException.class,
			MethodArgumentTypeMismatchException.class
	})
	ResponseEntity<ApiError> handleValidationException(
			Exception exception,
			HttpServletRequest request) {
		return ResponseEntity.badRequest()
				.body(ApiError.of("INVALID_REQUEST", "Request validation failed", traceId(request)));
	}

	@ExceptionHandler(MaxUploadSizeExceededException.class)
	ResponseEntity<ApiError> handleUploadLimit(
			MaxUploadSizeExceededException exception,
			HttpServletRequest request) {
		return ResponseEntity.status(HttpStatus.CONTENT_TOO_LARGE)
				.body(ApiError.of("IMAGE_TOO_LARGE", "Image exceeds the upload limit", traceId(request)));
	}

	private static String traceId(HttpServletRequest request) {
		Object generated = request.getAttribute("fasearch.trace-id");
		if (generated != null) {
			return generated.toString();
		}
		String incoming = request.getHeader("X-Trace-Id");
		return incoming == null || incoming.isBlank() ? null : incoming;
	}

	public record ApiError(String schemaVersion, String traceId, String code, String message) {
		static ApiError of(String code, String message, String traceId) {
			return new ApiError("1.0.0", traceId, code, message);
		}
	}
}
