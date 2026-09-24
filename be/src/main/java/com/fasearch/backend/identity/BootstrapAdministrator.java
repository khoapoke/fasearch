package com.fasearch.backend.identity;

import java.util.UUID;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Component
public final class BootstrapAdministrator implements ApplicationRunner {

	private static final UUID SUPER_ADMIN_ROLE = UUID.fromString(
			"00000000-0000-0000-0000-000000000104");

	private final JdbcTemplate jdbc;
	private final PasswordEncoder passwordEncoder;
	private final Environment environment;
	private final TransactionTemplate transactions;

	public BootstrapAdministrator(
			JdbcTemplate jdbc,
			PasswordEncoder passwordEncoder,
			Environment environment,
			TransactionTemplate transactions) {
		this.jdbc = jdbc;
		this.passwordEncoder = passwordEncoder;
		this.environment = environment;
		this.transactions = transactions;
	}

	@Override
	public void run(ApplicationArguments arguments) {
		transactions.executeWithoutResult(status -> {
			// Serializes first-run bootstrap across multiple backend instances.
			jdbc.execute("SELECT pg_advisory_xact_lock(1982026)");
			Integer count = jdbc.queryForObject(
					"SELECT COUNT(*) FROM user_roles WHERE role_id = ?",
					Integer.class,
					SUPER_ADMIN_ROLE);
			if (count != null && count > 0) {
				return;
			}
			String username = environment.getProperty("FASEARCH_BOOTSTRAP_ADMIN_USERNAME");
			String email = environment.getProperty("FASEARCH_BOOTSTRAP_ADMIN_EMAIL");
			String password = environment.getProperty("FASEARCH_BOOTSTRAP_ADMIN_PASSWORD");
			if (username == null || username.isBlank()
					|| email == null || email.isBlank()
					|| password == null || password.length() < 12) {
				throw new IllegalStateException(
						"First startup requires explicit bootstrap administrator credentials");
			}
			UUID id = UUID.randomUUID();
			jdbc.update(
					"INSERT INTO user_accounts (id, username, email, password_hash) VALUES (?, ?, ?, ?)",
					id, username, email, passwordEncoder.encode(password));
			jdbc.update("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", id, SUPER_ADMIN_ROLE);
		});
	}
}
