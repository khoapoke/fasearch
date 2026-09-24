package com.fasearch.backend.catalog;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.fasearch.backend.catalog.CatalogDraftModule.Draft;
import com.fasearch.backend.catalog.ProductImageUpload.ImageType;

@Service
public class CatalogImageModule {

	private static final Logger log = LoggerFactory.getLogger(CatalogImageModule.class);

	private final JdbcTemplate jdbc;
	private final TransactionTemplate transactions;
	private final CatalogDraftModule drafts;
	private final CatalogObjectStore objects;

	public CatalogImageModule(JdbcTemplate jdbc, TransactionTemplate transactions,
			CatalogDraftModule drafts, CatalogObjectStore objects) {
		this.jdbc = jdbc;
		this.transactions = transactions;
		this.drafts = drafts;
		this.objects = objects;
	}

	@PreAuthorize("hasAuthority('CATALOG_DRAFT_WRITE')")
	public Draft replacePrimary(UUID productId, int expectedVersionNo, byte[] bytes,
			Authentication actor, String traceId) {
		if (expectedVersionNo < 1 || traceId != null && traceId.length() > 128) {
			throw new CatalogDraftException("INVALID_REQUEST", HttpStatus.BAD_REQUEST,
					"Invalid version or trace ID");
		}
		ImageType type = ProductImageUpload.inspect(bytes);
		// Reject unauthorized or stale requests before sending bytes to object storage.
		Draft visible = drafts.get(productId, actor);
		if (visible.versionNo() != expectedVersionNo) {
			throw conflict();
		}
		UUID nextVersionId = UUID.randomUUID();
		String key = "products/" + productId + "/versions/" + nextVersionId + "/"
				+ UUID.randomUUID() + "." + type.extension();
		String storageUri = objects.put(key, bytes, type.mediaType());
		try {
			return transactions.execute(status -> {
				List<UUID> products = jdbc.query(
						"SELECT id FROM catalog_products WHERE id = ? "
								+ "AND archived_at IS NULL FOR UPDATE",
						(result, row) -> (UUID) result.getObject("id"), productId);
				if (products.isEmpty()) {
					throw new CatalogDraftException("DRAFT_NOT_FOUND", HttpStatus.NOT_FOUND,
							"Catalog product does not exist");
				}
				Draft current = drafts.get(productId, actor);
				if (current.versionNo() != expectedVersionNo) {
					throw conflict();
				}
				UUID actorId = currentActorId(actor);
				jdbc.update("INSERT INTO product_versions "
						+ "(id, product_id, version_no, status, title, description, category, changed_by) "
						+ "VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?)",
							nextVersionId, productId, current.versionNo() + 1, current.title(),
							current.description(), current.category().name(), actorId);
				jdbc.update("INSERT INTO product_images "
						+ "(id, product_version_id, storage_uri, sha256, is_primary, media_type, byte_size) "
						+ "VALUES (?, ?, ?, ?, TRUE, ?, ?)",
							UUID.randomUUID(), nextVersionId, storageUri, sha256(bytes),
							type.mediaType(), bytes.length);
				jdbc.update("INSERT INTO audit_events "
						+ "(id, actor_id, action, resource_type, resource_id, "
						+ "previous_version_id, new_version_id, trace_id) "
						+ "VALUES (?, ?, 'CATALOG_PRIMARY_IMAGE_REPLACED', 'CATALOG_PRODUCT', ?, ?, ?, ?)",
							UUID.randomUUID(), actorId, productId, current.productVersionId(),
							nextVersionId, traceId);
				return drafts.get(productId, actor);
			});
		}
		catch (RuntimeException failure) {
			try {
				objects.delete(storageUri);
			}
			catch (RuntimeException cleanupFailure) {
				log.warn("Orphan product image needs cleanup: {}", storageUri, cleanupFailure);
			}
			throw failure;
		}
	}

	@PreAuthorize("hasAuthority('CATALOG_DRAFT_WRITE')")
	public ImageBytes readPrimary(UUID productId, Authentication actor) {
		Draft draft = drafts.get(productId, actor);
		List<ImageRef> images = jdbc.query(
				"SELECT storage_uri, media_type FROM product_images "
						+ "WHERE product_version_id = ? AND is_primary = TRUE",
				(result, row) -> new ImageRef(result.getString("storage_uri"),
						result.getString("media_type")), draft.productVersionId());
		if (images.isEmpty()) {
			throw new CatalogDraftException("IMAGE_NOT_FOUND", HttpStatus.NOT_FOUND,
					"Draft has no primary image");
		}
		ImageRef image = images.get(0);
		return new ImageBytes(objects.read(image.storageUri()), image.mediaType());
	}

	private UUID currentActorId(Authentication actor) {
		return jdbc.queryForObject(
				"SELECT id FROM user_accounts WHERE LOWER(username) = LOWER(?)",
				UUID.class, actor.getName());
	}

	private static String sha256(byte[] bytes) {
		try {
			return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
		}
		catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException("SHA-256 is unavailable", exception);
		}
	}

	private static CatalogDraftException conflict() {
		return new CatalogDraftException("VERSION_CONFLICT", HttpStatus.CONFLICT,
				"Catalog version changed; reload before editing");
	}

	public record ImageBytes(byte[] bytes, String mediaType) {
	}

	private record ImageRef(String storageUri, String mediaType) {
	}
}
