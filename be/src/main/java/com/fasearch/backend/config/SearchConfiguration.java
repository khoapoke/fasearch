package com.fasearch.backend.config;

import java.net.http.HttpClient;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import com.fasearch.backend.search.application.AiComposedSearchPort;
import com.fasearch.backend.search.application.AiImageSearchPort;
import com.fasearch.backend.search.application.CatalogImageReader;
import com.fasearch.backend.search.application.CatalogProductReader;
import com.fasearch.backend.search.application.ComposedSearchModule;
import com.fasearch.backend.search.application.ComposedSearchUseCase;
import com.fasearch.backend.search.application.ImageSearchModule;
import com.fasearch.backend.search.application.ImageSearchUseCase;

@Configuration
@EnableConfigurationProperties(FaSearchProperties.class)
public class SearchConfiguration {

	@Bean
	RestClient aiRestClient(FaSearchProperties properties) {
		HttpClient httpClient = HttpClient.newBuilder()
				.connectTimeout(properties.ai().connectTimeout())
				.build();
		JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
		requestFactory.setReadTimeout(properties.ai().readTimeout());
		return RestClient.builder()
				.baseUrl(properties.ai().baseUrl().toString())
				.requestFactory(requestFactory)
				.build();
	}

	@Bean
	ImageSearchUseCase imageSearchUseCase(
			AiImageSearchPort aiSearch,
			CatalogProductReader catalog,
			FaSearchProperties properties) {
		return new ImageSearchModule(aiSearch, catalog, properties.publication());
	}

	@Bean
	ComposedSearchUseCase composedSearchUseCase(
			AiComposedSearchPort aiSearch,
			CatalogProductReader catalog,
			CatalogImageReader images,
			FaSearchProperties properties) {
		return new ComposedSearchModule(aiSearch, catalog, images, properties.publication());
	}
}
