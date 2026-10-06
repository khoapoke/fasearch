package com.fasearch.backend.identity;

import java.lang.reflect.Proxy;

import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;

import java.util.Locale;

// Closes the stale-login window: a login that reads credentials BEFORE a
// password-change commit must not gain a usable session when its session row
// is written AFTER the commit. The credential read
// (JdbcIdentityService.loadUserByUsername) stamps the request session with the
// observed password_version; this guard drops (instead of saving) any session
// whose stamp no longer matches the account row. Unstamped sessions (created
// before deploy, anonymous, non-login paths) pass through untouched, so there
// is no mass logout and no behavior change for valid sessions.
// Cost: one indexed SELECT per save of a stamped session.
// ponytail: per-save SELECT; gate on recently-changed principals only if
// session write load ever matters (correctness first, it never skips a check).
@Configuration(proxyBeanMethods = false)
public class PasswordVersionSessionGuard {

	static final String VERSION_ATTRIBUTE = "FASEARCH_PWD_VER";
	static final String SECURITY_CONTEXT_ATTRIBUTE = "SPRING_SECURITY_CONTEXT";

	@Bean
	static BeanPostProcessor passwordVersionGuardPostProcessor(JdbcTemplate jdbc) {
		return new BeanPostProcessor() {
			@Override
			@SuppressWarnings({ "unchecked", "rawtypes" })
			public Object postProcessAfterInitialization(Object bean, String name) {
				if (bean instanceof SessionRepository) {
					SessionRepository<?> sessions = (SessionRepository<?>) bean;
					return Proxy.newProxyInstance(bean.getClass().getClassLoader(),
							bean.getClass().getInterfaces(),
							(proxy, method, args) -> {
								if (method.getName().equals("save") && args.length == 1
										&& args[0] instanceof Session session
										&& stale(session, jdbc)) {
									sessions.deleteById(session.getId());
									return null;
								}
								try {
									return method.invoke(bean, args);
								}
								catch (java.lang.reflect.InvocationTargetException failed) {
									throw failed.getCause();
								}
							});
				}
				return bean;
			}
		};
	}

	private static boolean stale(Session session, JdbcTemplate jdbc) {
		Object stamp = session.getAttribute(VERSION_ATTRIBUTE);
		if (!(stamp instanceof Number)) {
			return false;
		}
		String principal = principalOf(session);
		if (principal == null) {
			return false;
		}
		Long current = jdbc.query(
				"SELECT password_version FROM user_accounts WHERE LOWER(username) = ?",
				result -> result.next() ? result.getLong(1) : null,
				principal.toLowerCase(Locale.ROOT));
		// Account gone entirely: the session can never authenticate again.
		return current == null || current.longValue() != ((Number) stamp).longValue();
	}

	private static String principalOf(Session session) {
		try {
			Object context = session.getAttribute(SECURITY_CONTEXT_ATTRIBUTE);
			if (context instanceof org.springframework.security.core.context.SecurityContext
					security) {
				return security.getAuthentication() == null ? null
						: security.getAuthentication().getName();
			}
		}
		catch (RuntimeException ignored) {
		}
		return null;
	}
}
