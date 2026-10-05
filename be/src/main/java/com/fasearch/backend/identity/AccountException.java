package com.fasearch.backend.identity;

import org.springframework.http.HttpStatus;

public class AccountException extends RuntimeException {

	private final String code;
	private final HttpStatus status;

	public AccountException(String code, HttpStatus status, String message) {
		super(message);
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
