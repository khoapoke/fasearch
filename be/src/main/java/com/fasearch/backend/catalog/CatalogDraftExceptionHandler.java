package com.fasearch.backend.catalog;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class CatalogDraftExceptionHandler {

	@ExceptionHandler(CatalogDraftException.class)
	ResponseEntity<ErrorResponse> handle(CatalogDraftException exception) {
		return ResponseEntity.status(exception.status())
				.body(new ErrorResponse(exception.code(), exception.getMessage()));
	}

	public record ErrorResponse(String code, String message) {
	}
}
