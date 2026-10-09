package com.fasearch.backend.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

@Testcontainers
class S3CatalogObjectStoreTests {

	private static final String BUCKET = "fasearch-product-images";

	@Container
	static GenericContainer<?> seaweed = new GenericContainer<>(
			DockerImageName.parse("chrislusf/seaweedfs:4.47"))
				.withExposedPorts(8333)
				.withEnv("AWS_ACCESS_KEY_ID", "fasearch-test-key")
				.withEnv("AWS_SECRET_ACCESS_KEY", "fasearch-test-secret")
				.withEnv("S3_BUCKET", BUCKET);

	@Test
	void storesAndReadsBytesThroughTheS3CompatibleProtocol() {
		URI endpoint = URI.create("http://" + seaweed.getHost() + ":" + seaweed.getMappedPort(8333));
		try (S3Client client = S3Client.builder()
				.endpointOverride(endpoint)
				.forcePathStyle(true)
				.region(Region.US_EAST_1)
				.credentialsProvider(StaticCredentialsProvider.create(
						AwsBasicCredentials.create("fasearch-test-key", "fasearch-test-secret")))
				.build()) {
			CatalogObjectStore store = new S3CatalogObjectStore(client, BUCKET);
			byte[] bytes = "test-image-bytes".getBytes(StandardCharsets.UTF_8);
			String uri = store.put("products/test/versions/test/image.png", bytes, "image/png");
			assertThat(uri).isEqualTo("s3://" + BUCKET + "/products/test/versions/test/image.png");
			assertThat(store.read(uri)).isEqualTo(bytes);
			store.delete(uri);
		}
	}

	@Test
	void productionConfigurationRejectsPlaintextObjectEndpoint() {
		assertThatThrownBy(() -> new S3CatalogObjectStore.S3Configuration()
				.catalogS3Client("http://object-store.example.test", "us-east-1", "", "", true, false))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("HTTPS");
	}

	@Test
	void anonymousAccessRejectsStaticKeyCombination() {
		assertThatThrownBy(() -> new S3CatalogObjectStore.S3Configuration()
				.catalogS3Client("http://object-store.example.test", "us-east-1",
						"some-key", "some-secret", false, true))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("Anonymous");
	}
}
