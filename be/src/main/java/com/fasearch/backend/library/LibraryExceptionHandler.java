package com.fasearch.backend.library;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class LibraryExceptionHandler {

	@ExceptionHandler(LibraryException.class)
	ResponseEntity<ErrorResponse> handle(LibraryException exception) {
		return ResponseEntity.status(exception.status())
				.header("Cache-Control", "no-store")
				.body(new ErrorResponse(exception.code(), exception.getMessage()));
	}

	public record ErrorResponse(String code, String message) {
	}
}
