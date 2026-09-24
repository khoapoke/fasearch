package com.fasearch.backend.catalog;

import org.springframework.http.HttpStatus;

public class CatalogDraftException extends RuntimeException {

	private final String code;
	private final HttpStatus status;

	public CatalogDraftException(String code, HttpStatus status, String message) {
		this(code, status, message, null);
	}

	public CatalogDraftException(String code, HttpStatus status, String message, Throwable cause) {
		super(message, cause);
		this.code = code;
		this.status = status;
	}

	public String code() {
		return code;
	}

	public HttpStatus status() {
		return status;
	}
}
