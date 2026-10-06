package com.fasearch.backend.identity;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.JsonNode;

@Service
public class AccountModule {

	private static final Pattern USERNAME = Pattern.compile("^[A-Za-z0-9_.-]+$");
	private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
	private static final Set<String> REGISTER_FIELDS = Set.of(
			"username", "email", "password", "display_name");
	private static final UUID REGISTERED_USER_ROLE = UUID.fromString(
			"00000000-0000-0000-0000-000000000101");

	private final JdbcTemplate jdbc;
	private final PasswordEncoder passwords;

	public AccountModule(JdbcTemplate jdbc, PasswordEncoder passwords) {
		this.jdbc = jdbc;
		this.passwords = passwords;
	}

	@Transactional
	public Profile register(JsonNode body) {
		assertJsonObject(body);
		rejectUnknownFields(body, REGISTER_FIELDS);
		String username = validatedUsername(requiredText(body, "username"));
		String email = validatedEmail(requiredText(body, "email"));
		String password = requiredText(body, "password");
		validatedNewPassword(password);
		String displayName = validatedDisplayName(optionalText(body, "display_name"));
		UUID id = UUID.randomUUID();
		try {
			jdbc.update(
					"INSERT INTO user_accounts (id, username, email, password_hash, display_name, status) "
							+ "VALUES (?, ?, ?, ?, ?, 'ACTIVE')",
					id, username, email, passwords.encode(password), displayName);
			jdbc.update("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
					id, REGISTERED_USER_ROLE);
		}
		catch (DuplicateKeyException conflict) {
			throw new AccountException("ACCOUNT_CONFLICT", HttpStatus.CONFLICT,
					"Username or email is already registered");
		}
		jdbc.update(
				"INSERT INTO audit_events (id, actor_id, action, resource_type, resource_id) "
						+ "VALUES (?, ?, 'ACCOUNT_REGISTERED', 'USER_ACCOUNT', ?)",
				UUID.randomUUID(), id, id);
		return profileOf(id);
	}

	private static final Set<String> PROFILE_PATCH_FIELDS = Set.of("display_name");
	private static final Set<String> PASSWORD_FIELDS = Set.of(
			"current_password", "new_password");

	@Transactional(readOnly = true)
	public Profile ownProfile(Authentication actor) {
		return profileOf(accountId(actor));
	}

	@Transactional
	public Profile updateProfile(Authentication actor, JsonNode body) {
		assertJsonObject(body);
		rejectUnknownFields(body, PROFILE_PATCH_FIELDS);
		if (body.get("display_name") == null || body.get("display_name").isNull()) {
			throw new AccountException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
					"Missing required field: display_name");
		}
		String displayName = validatedDisplayName(optionalText(body, "display_name"));
		UUID id = accountId(actor);
		jdbc.update("UPDATE user_accounts SET display_name = ?, updated_at = CURRENT_TIMESTAMP "
					+ "WHERE id = ?", displayName, id);
		jdbc.update("INSERT INTO audit_events (id, actor_id, action, resource_type, resource_id) "
					+ "VALUES (?, ?, 'ACCOUNT_PROFILE_UPDATED', 'USER_ACCOUNT', ?)",
				UUID.randomUUID(), id, id);
		return profileOf(id);
	}

	private Profile profileOf(UUID id) {
		List<Profile> rows = jdbc.query(
				"SELECT username, email, display_name FROM user_accounts WHERE id = ?",
				(result, row) -> new Profile(
						result.getString("username"),
						result.getString("email"),
						result.getString("display_name")),
				id);
		if (rows.isEmpty()) {
			throw new AccountException("UNAUTHENTICATED", HttpStatus.UNAUTHORIZED,
					"Account does not exist");
		}
		return rows.get(0);
	}

	private UUID accountId(Authentication actor) {
		UUID id = jdbc.queryForObject(
				"SELECT id FROM user_accounts WHERE LOWER(username) = ?",
				UUID.class,
				actor.getName().toLowerCase(Locale.ROOT));
		if (id == null) {
			throw new AccountException("UNAUTHENTICATED", HttpStatus.UNAUTHORIZED,
					"Account does not exist");
		}
		return id;
	}

	private static void assertJsonObject(JsonNode body) {
		if (body == null || !body.isObject()) {
			throw new AccountException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
					"Request body must be a JSON object");
		}
	}

	private static void rejectUnknownFields(JsonNode body, Set<String> allowed) {
		var fields = body.propertyNames();
		for (String field : fields) {
			if (!allowed.contains(field)) {
				throw new AccountException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
						"Unknown or protected field: " + field);
			}
		}
	}

	private static String requiredText(JsonNode body, String field) {
		JsonNode value = body.get(field);
		if (value == null || value.isNull() || !value.isString()) {
			throw new AccountException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
					"Missing required field: " + field);
		}
		return value.asText();
	}

	private static String optionalText(JsonNode body, String field) {
		JsonNode value = body.get(field);
		if (value == null || value.isNull()) {
			return null;
		}
		if (!value.isString()) {
			throw new AccountException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
					"Invalid field type: " + field);
		}
		return value.asText();
	}

	static String validatedUsername(String raw) {
		if (raw == null) {
			throw new AccountException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
					"Missing required field: username");
		}
		String username = raw.trim();
		int codePoints = username.codePointCount(0, username.length());
		if (codePoints < 3 || codePoints > 100 || !USERNAME.matcher(username).matches()) {
			throw new AccountException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
					"Username must be 3-100 ASCII letters, digits, underscore, dot or hyphen");
		}
		return username;
	}

	static String validatedEmail(String raw) {
		if (raw == null) {
			throw new AccountException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
					"Missing required field: email");
		}
		for (int i = 0; i < raw.length(); i++) {
			if (Character.isISOControl(raw.charAt(i))) {
				throw new AccountException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
						"Email address must not contain control characters");
			}
		}
		String email = raw.trim();
		if (email.length() > 254 || !EMAIL.matcher(email).matches()) {
			throw new AccountException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
					"Email address is invalid");
		}
		return email;
	}

	static void validatedNewPassword(String password) {
		if (password == null) {
			throw new AccountException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
					"Missing required field: password");
		}
		int codePoints = password.codePointCount(0, password.length());
		if (codePoints < 15 || codePoints > 64) {
			throw new AccountException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
					"New password must be 15-64 characters");
		}
		int utf8Bytes = password.getBytes(StandardCharsets.UTF_8).length;
		if (utf8Bytes > 72) {
			throw new AccountException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
					"New password exceeds 72 UTF-8 bytes supported by the password hash");
		}
	}

	static String validatedDisplayName(String raw) {
		if (raw == null) {
			return null;
		}
		String displayName = raw.trim();
		if (displayName.isEmpty()) {
			throw new AccountException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
					"Display name must not be blank");
		}
		int codePoints = displayName.codePointCount(0, displayName.length());
		if (codePoints < 1 || codePoints > 100) {
			throw new AccountException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
					"Display name must be 1-100 characters");
		}
		for (int i = 0; i < displayName.length(); i++) {
			if (Character.isISOControl(displayName.charAt(i))) {
				throw new AccountException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
						"Display name must not contain control characters");
			}
		}
		return displayName;
	}

	public record Profile(String username, String email, String displayName) {
	}

	@Transactional
	public void changePassword(Authentication actor, JsonNode body) {
		assertJsonObject(body);
		rejectUnknownFields(body, PASSWORD_FIELDS);
		String current = requiredText(body, "current_password");
		String next = requiredText(body, "new_password");
		validatedNewPassword(next);
		List<PasswordRow> rows = jdbc.query(
				"SELECT id, username, password_hash FROM user_accounts "
						+ "WHERE LOWER(username) = ? FOR UPDATE",
				(result, row) -> new PasswordRow(
						(UUID) result.getObject("id"),
						result.getString("username"),
						result.getString("password_hash")),
				actor.getName().toLowerCase(Locale.ROOT));
		if (rows.isEmpty()) {
			throw new AccountException("UNAUTHENTICATED", HttpStatus.UNAUTHORIZED,
					"Account does not exist");
		}
		PasswordRow account = rows.get(0);
		if (!passwords.matches(current, account.passwordHash())) {
			throw new AccountException("CURRENT_PASSWORD_INVALID", HttpStatus.BAD_REQUEST,
					"Current password is incorrect");
		}
		jdbc.update("UPDATE user_accounts SET password_hash = ?, password_version = password_version + 1, "
				+ "updated_at = CURRENT_TIMESTAMP "
					+ "WHERE id = ?", passwords.encode(next), account.id());
		jdbc.update("DELETE FROM SPRING_SESSION WHERE PRINCIPAL_NAME = ?", account.username());
		jdbc.update("INSERT INTO audit_events (id, actor_id, action, resource_type, resource_id) "
					+ "VALUES (?, ?, 'ACCOUNT_PASSWORD_CHANGED', 'USER_ACCOUNT', ?)",
				UUID.randomUUID(), account.id(), account.id());
	}

	private record PasswordRow(UUID id, String username, String passwordHash) {
	}
}
