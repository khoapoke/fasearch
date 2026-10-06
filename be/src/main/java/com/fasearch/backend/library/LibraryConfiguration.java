package com.fasearch.backend.library;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
public class LibraryConfiguration {

	@Bean
	Clock libraryClock() {
		return Clock.systemUTC();
	}
}
