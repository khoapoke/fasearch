package com.fasearch.backend.identity;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public final class JdbcIdentityService implements UserDetailsService {

	private final JdbcTemplate jdbc;

	public JdbcIdentityService(JdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	@Override
	public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
		List<Account> accounts = jdbc.query(
				"SELECT id, username, password_hash, status, password_version "
						+ "FROM user_accounts WHERE LOWER(username) = ?",
				(result, row) -> new Account(
						(UUID) result.getObject("id"),
						result.getString("username"),
						result.getString("password_hash"),
						result.getString("status"),
						result.getLong("password_version")),
				username.toLowerCase(Locale.ROOT));
		if (accounts.isEmpty()) {
			throw new UsernameNotFoundException("Account not found");
		}
		Account account = accounts.get(0);
		// Stamp the request session with the version observed by THIS credential
		// read. A login whose password check crosses a password-change commit
		// then carries a stale stamp, and PasswordVersionSessionGuard drops its
		// session at save time. Same statement, no extra query; absent outside a
		// web request (fail-open, non-login callers never mint sessions).
		if (RequestContextHolder.getRequestAttributes()
					instanceof ServletRequestAttributes web) {
			jakarta.servlet.http.HttpSession session = web.getRequest().getSession(false);
			if (session != null) {
				session.setAttribute(
						PasswordVersionSessionGuard.VERSION_ATTRIBUTE, account.passwordVersion());
			}
		}
		List<SimpleGrantedAuthority> authorities = new ArrayList<>();
		for (String role : jdbc.queryForList(
				"SELECT r.code FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ?",
				String.class,
				account.id())) {
			authorities.add(new SimpleGrantedAuthority("ROLE_" + role));
		}
		for (String permission : jdbc.queryForList(
				"SELECT DISTINCT rp.permission_code FROM role_permissions rp "
						+ "JOIN user_roles ur ON ur.role_id = rp.role_id WHERE ur.user_id = ?",
				String.class,
				account.id())) {
			authorities.add(new SimpleGrantedAuthority(permission));
		}
		return User.withUsername(account.username())
				.password(account.passwordHash())
				.authorities(authorities)
				.accountLocked(!"ACTIVE".equals(account.status()))
				.disabled("DISABLED".equals(account.status()))
				.build();
	}

	private record Account(UUID id, String username, String passwordHash, String status,
			long passwordVersion) {
	}
}
