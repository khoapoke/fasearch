package com.fasearch.backend.search.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;

import com.fasearch.backend.config.FaSearchProperties;

import tools.jackson.databind.json.JsonMapper;

class PublicCatalogBrowseModuleTests {

	private static final FaSearchProperties.Publication PUBLICATION =
			new FaSearchProperties.Publication("catalog-test-v1", "model-v1", "index-v1");

	@TempDir
	private Path tempDir;

	private Path fixture;
	private PublicCatalogBrowseModule module;

	@BeforeEach
	void loadModule() throws Exception {
		fixture = tempDir.resolve("catalog.jsonl");
		Files.writeString(fixture, String.join("\n",
				row("p1", "p1-v1", "Áo đỏ", "TOP"),
				row("p2", "p2-v1", "Quần xanh", "BOTTOM"),
				row("p3", "p3-v1", "Váy hoa", "ONE_PIECE"),
				row("p4", "p4-v1", "Áo trắng", "TOP"),
				row("p5", "p5-v1", "Quần đen", "BOTTOM")) + "\n",
				StandardCharsets.UTF_8);
		PublicCatalogSnapshotProvider provider = new PublicCatalogSnapshotProvider(
				new FaSearchProperties(
						null,
						new FaSearchProperties.Publication("catalog-test-v1", "model-v1", "index-v1"),
						new FaSearchProperties.Catalog(
								fixture.toString(), java.util.List.of())),
				new JsonMapper());
		module = new PublicCatalogBrowseModule(provider, PUBLICATION);
	}

	@Test
	void listPreservesFrozenOrderWithAccurateTotals() {
		PublicCatalogBrowseUseCase.PageResult first = module.list(
				new PublicCatalogBrowseUseCase.ListQuery(1, 2, null, null, "trace-1"));

		assertThat(first.schemaVersion()).isEqualTo("1.0.0");
		assertThat(first.publication().catalogSnapshotId()).isEqualTo("catalog-test-v1");
		assertThat(first.artifactScope()).isEqualTo("PILOT_ONLY");
		assertThat(first.total()).isEqualTo(5);
		assertThat(first.hasMore()).isTrue();
		assertThat(first.items()).extracting(PublicCatalogBrowseUseCase.Item::productId)
				.containsExactly("p1", "p2");

		PublicCatalogBrowseUseCase.PageResult last = module.list(
				new PublicCatalogBrowseUseCase.ListQuery(3, 2, null, null, "trace-1"));
		assertThat(last.items()).extracting(PublicCatalogBrowseUseCase.Item::productId)
				.containsExactly("p5");
		assertThat(last.hasMore()).isFalse();
	}

	@Test
	void categoryFilterKeepsRelativeOrderAndFilteredTotal() {
		PublicCatalogBrowseUseCase.PageResult tops = module.list(
				new PublicCatalogBrowseUseCase.ListQuery(1, 24, "TOP", null, "trace-1"));

		assertThat(tops.total()).isEqualTo(2);
		assertThat(tops.hasMore()).isFalse();
		assertThat(tops.items()).extracting(PublicCatalogBrowseUseCase.Item::productId)
				.containsExactly("p1", "p4");
	}

	@Test
	void pastEndPageIsEmptyWithCorrectTotal() {
		PublicCatalogBrowseUseCase.PageResult pastEnd = module.list(
				new PublicCatalogBrowseUseCase.ListQuery(9, 24, null, null, "trace-1"));

		assertThat(pastEnd.total()).isEqualTo(5);
		assertThat(pastEnd.items()).isEmpty();
		assertThat(pastEnd.hasMore()).isFalse();
	}

	@Test
	void expectedSnapshotMismatchConflicts() {
		assertThatThrownBy(() -> module.list(
				new PublicCatalogBrowseUseCase.ListQuery(1, 24, null, "stale-snapshot", "trace-1")))
				.isInstanceOf(SearchException.class)
				.extracting(exception -> ((SearchException) exception).code())
				.isEqualTo("CATALOG_SNAPSHOT_MISMATCH");
	}

	@Test
	void invalidPagingAndCategoryRejected() {
		assertThatThrownBy(() -> module.list(
				new PublicCatalogBrowseUseCase.ListQuery(0, 24, null, null, "trace-1")))
				.isInstanceOf(SearchException.class);
		assertThatThrownBy(() -> module.list(
				new PublicCatalogBrowseUseCase.ListQuery(1, 61, null, null, "trace-1")))
				.isInstanceOf(SearchException.class);
		assertThatThrownBy(() -> module.list(
				new PublicCatalogBrowseUseCase.ListQuery(1, 24, "SHOES", null, "trace-1")))
				.isInstanceOf(SearchException.class);
	}

	@Test
	void detailResolvesExactVersionWithNullDescription() {
		PublicCatalogBrowseUseCase.DetailResult detail = module.detail(
				new PublicCatalogBrowseUseCase.DetailQuery("p2", null, null, "trace-1"));

		assertThat(detail.productId()).isEqualTo("p2");
		assertThat(detail.productVersionId()).isEqualTo("p2-v1");
		assertThat(detail.title()).isEqualTo("Quần xanh");
		assertThat(detail.category()).isEqualTo("BOTTOM");
		assertThat(detail.description()).isNull();
		assertThat(detail.imageUrl()).isEqualTo("/api/catalog/images/p2/p2-v1");
		assertThat(detail.artifactScope()).isEqualTo("PILOT_ONLY");
	}

	@Test
	void detailWithExactExpectedContextSucceeds() {
		PublicCatalogBrowseUseCase.DetailResult detail = module.detail(
				new PublicCatalogBrowseUseCase.DetailQuery(
						"p2", "p2-v1", "catalog-test-v1", "trace-1"));

		assertThat(detail.productVersionId()).isEqualTo("p2-v1");
	}

	@Test
	void detailDenialsAreUniform() {
		assertThatThrownBy(() -> module.detail(
				new PublicCatalogBrowseUseCase.DetailQuery("missing", null, null, "trace-1")))
				.isInstanceOf(SearchException.class)
				.extracting(exception -> ((SearchException) exception).code())
				.isEqualTo("CATALOG_PRODUCT_NOT_FOUND");
		assertThatThrownBy(() -> module.detail(
				new PublicCatalogBrowseUseCase.DetailQuery("p2", "p2-v9", "catalog-test-v1", "trace-1")))
				.isInstanceOf(SearchException.class)
				.extracting(exception -> ((SearchException) exception).code())
				.isEqualTo("CATALOG_PRODUCT_NOT_FOUND");
		assertThatThrownBy(() -> module.detail(
				new PublicCatalogBrowseUseCase.DetailQuery("p2", "p2-v1", "stale-snapshot", "trace-1")))
				.isInstanceOf(SearchException.class)
				.extracting(exception -> ((SearchException) exception).status())
				.isEqualTo(HttpStatus.CONFLICT);
		assertThatThrownBy(() -> module.detail(
				new PublicCatalogBrowseUseCase.DetailQuery("p2", "p2-v1", null, "trace-1")))
				.isInstanceOf(SearchException.class)
				.extracting(exception -> ((SearchException) exception).code())
				.isEqualTo("INVALID_REQUEST");
	}

	@Test
	void missingPublicationFailsClosed() {
		PublicCatalogSnapshotProvider missing = new PublicCatalogSnapshotProvider(
				new FaSearchProperties(
						null,
						new FaSearchProperties.Publication("catalog-test-v1", "model-v1", "index-v1"),
						new FaSearchProperties.Catalog("", java.util.List.of())),
				new JsonMapper());
		PublicCatalogBrowseModule closed =
				new PublicCatalogBrowseModule(missing, PUBLICATION);

		assertThatThrownBy(() -> closed.list(
				new PublicCatalogBrowseUseCase.ListQuery(1, 24, null, null, "trace-1")))
				.isInstanceOf(SearchException.class)
				.extracting(exception -> ((SearchException) exception).code())
				.isEqualTo("CATALOG_UNAVAILABLE");
	}

	@Test
	void nullCatalogRowFailsClosedAsUnavailable() throws Exception {
		Path file = tempDir.resolve("null-row.jsonl");
		Files.writeString(file, "null\n", StandardCharsets.UTF_8);
		var provider = new PublicCatalogSnapshotProvider(
				new FaSearchProperties(null,
						new FaSearchProperties.Publication("catalog-test-v1", "model-v1", "index-v1"),
						new FaSearchProperties.Catalog(file.toString(), java.util.List.of())), new JsonMapper());
		assertThatThrownBy(provider::snapshot).isInstanceOf(SearchException.class)
				.extracting(exception -> ((SearchException) exception).code()).isEqualTo("CATALOG_UNAVAILABLE");
	}

	@Test
	void duplicateProductIdFailsFast() throws Exception {
		Path duplicated = tempDir.resolve("duplicated.jsonl");
		Files.writeString(duplicated,
				row("p1", "p1-v1", "Áo đỏ", "TOP") + "\n"
						+ row("p1", "p1-v2", "Áo đỏ v2", "TOP") + "\n",
				StandardCharsets.UTF_8);

		assertThatThrownBy(
				() -> new PublicCatalogSnapshot("catalog-test-v1", duplicated, new JsonMapper()))
				.isInstanceOf(IllegalStateException.class);
	}

	private static String row(String productId, String versionId, String title, String category) {
		return "{\"product_id\":\"" + productId + "\",\"product_version_id\":\"" + versionId
				+ "\",\"title\":\"" + title + "\",\"category\":\"" + category
				+ "\",\"catalog_snapshot_id\":\"catalog-test-v1\"}";
	}

}
