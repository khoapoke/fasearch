package com.fasearch.backend.identity;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.HttpMediaTypeNotSupportedException;

@RestControllerAdvice
public class AccountExceptionHandler {

	@ExceptionHandler(AccountException.class)
	ResponseEntity<ErrorResponse> handle(AccountException exception) {
		return ResponseEntity.status(exception.status())
				.header("Cache-Control", "no-store")
				.body(new ErrorResponse(exception.code(), exception.getMessage()));
	}

	@ExceptionHandler(HttpMediaTypeNotSupportedException.class)
	ResponseEntity<ErrorResponse> handleUnsupportedMediaType() {
		return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
				.header("Cache-Control", "no-store")
				.body(new ErrorResponse("UNSUPPORTED_MEDIA_TYPE",
						"Request content type must be application/json"));
	}

	public record ErrorResponse(String code, String message) {
	}
}
