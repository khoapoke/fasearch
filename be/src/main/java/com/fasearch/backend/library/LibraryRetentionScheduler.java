package com.fasearch.backend.library;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// Dedicated retention runner, separate from LibraryModule, so MVC slice tests
// that stub the module never execute startup/scheduled cleanup against a
// null JdbcTemplate. Behavior: bounded in-process purge at startup and at
// least hourly while the service runs; no separate scheduler infrastructure.
@Component
public class LibraryRetentionScheduler {

	private final LibraryModule library;

	public LibraryRetentionScheduler(LibraryModule library) {
		this.library = library;
	}

	@Scheduled(fixedRate = 3_600_000)
	public void purgeExpiredOnSchedule() {
		library.purgeExpired();
	}

	@EventListener(ApplicationReadyEvent.class)
	public void purgeExpiredOnStartup() {
		library.purgeExpired();
	}
}
