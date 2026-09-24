package com.fasearch.backend.catalog;

import java.net.URI;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@Component
public final class S3CatalogObjectStore implements CatalogObjectStore {

	private final S3Client client;
	private final String bucket;

	public S3CatalogObjectStore(S3Client client,
			@Value("${fasearch.object.bucket}") String bucket) {
		this.client = client;
		this.bucket = bucket;
	}

	@Override
	public String put(String key, byte[] bytes, String mediaType) {
		try {
			client.putObject(PutObjectRequest.builder()
					.bucket(bucket).key(key).contentType(mediaType).build(),
					RequestBody.fromBytes(bytes));
			return "s3://" + bucket + "/" + key;
		}
		catch (RuntimeException exception) {
			throw unavailable(exception);
		}
	}

	@Override
	public byte[] read(String storageUri) {
		try {
			return client.getObjectAsBytes(GetObjectRequest.builder()
					.bucket(bucket).key(key(storageUri)).build()).asByteArray();
		}
		catch (RuntimeException exception) {
			throw unavailable(exception);
		}
	}

	@Override
	public void delete(String storageUri) {
		try {
			client.deleteObject(DeleteObjectRequest.builder()
					.bucket(bucket).key(key(storageUri)).build());
		}
		catch (RuntimeException exception) {
			throw unavailable(exception);
		}
	}

	private String key(String storageUri) {
		String prefix = "s3://" + bucket + "/products/";
		if (!storageUri.startsWith(prefix) || storageUri.length() == prefix.length()) {
			throw new IllegalArgumentException("Storage URI is outside the product-image bucket");
		}
		return storageUri.substring(("s3://" + bucket + "/").length());
	}

	private static CatalogDraftException unavailable(RuntimeException cause) {
		return new CatalogDraftException("OBJECT_STORAGE_UNAVAILABLE",
				HttpStatus.SERVICE_UNAVAILABLE, "Product image storage is unavailable", cause);
	}

	@Configuration(proxyBeanMethods = false)
	static class S3Configuration {
		@Bean(destroyMethod = "close")
		S3Client catalogS3Client(
				@Value("${fasearch.object.endpoint}") String endpoint,
				@Value("${fasearch.object.region}") String region,
				@Value("${fasearch.object.access-key}") String accessKey,
				@Value("${fasearch.object.secret-key}") String secretKey,
				@Value("${fasearch.object.require-https:false}") boolean requireHttps) {
			if (accessKey.isBlank() != secretKey.isBlank()) {
				throw new IllegalStateException("Set both object-store access and secret keys, or neither");
			}
			if (requireHttps && !"https".equalsIgnoreCase(URI.create(endpoint).getScheme())) {
				throw new IllegalStateException("Production object storage must use HTTPS");
			}
			var builder = S3Client.builder().region(Region.of(region)).forcePathStyle(true);
			if (!endpoint.isBlank()) {
				builder.endpointOverride(URI.create(endpoint));
			}
			if (!accessKey.isBlank()) {
				builder.credentialsProvider(StaticCredentialsProvider.create(
						AwsBasicCredentials.create(accessKey, secretKey)));
			}
			return builder.build();
		}
	}
}
