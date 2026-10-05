package com.fasearch.backend.identity;

import java.net.URI;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/v1/auth")
public class AccountController {

	private final AccountModule accounts;

	public AccountController(AccountModule accounts) {
		this.accounts = accounts;
	}

	@PostMapping(value = "/register", consumes = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<AccountModule.Profile> register(@RequestBody JsonNode body) {
		AccountModule.Profile profile = accounts.register(body);
		return ResponseEntity.created(URI.create("/api/v1/auth/profile"))
				.header("Cache-Control", "no-store")
				.body(profile);
	}

	@GetMapping("/profile")
	public ResponseEntity<AccountModule.Profile> ownProfile(Authentication authentication) {
		return ResponseEntity.ok()
				.header("Cache-Control", "no-store")
				.body(accounts.ownProfile(authentication));
	}

	@PatchMapping(value = "/profile", consumes = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<AccountModule.Profile> updateProfile(
			Authentication authentication, @RequestBody JsonNode body) {
		return ResponseEntity.ok()
				.header("Cache-Control", "no-store")
				.body(accounts.updateProfile(authentication, body));
	}

	@PostMapping(value = "/password", consumes = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<Void> changePassword(
			Authentication authentication, @RequestBody JsonNode body, HttpServletRequest request) {
		accounts.changePassword(authentication, body);
		jakarta.servlet.http.HttpSession session = request.getSession(false);
		if (session != null) {
			session.invalidate();
		}
		return ResponseEntity.noContent().header("Cache-Control", "no-store").build();
	}
}
