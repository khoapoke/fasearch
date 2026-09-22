package com.fasearch.backend.search.application;

import org.springframework.http.HttpStatus;

public final class SearchException extends RuntimeException {

	private final String code;
	private final HttpStatus status;

	public SearchException(String code, HttpStatus status, String message) {
		super(message);
		this.code = code;
		this.status = status;
	}

	public SearchException(String code, HttpStatus status, String message, Throwable cause) {
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
