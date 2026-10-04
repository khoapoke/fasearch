package com.fasearch.backend.catalog;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CatalogDraftModule {

	private final JdbcTemplate jdbc;

	public CatalogDraftModule(JdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	@PreAuthorize("hasAuthority('CATALOG_DRAFT_WRITE')")
	@Transactional
	public Draft create(CreateDraft input, Authentication actor, String traceId) {
		validateTraceId(traceId);
		UUID actorId = accountId(actor);
		UUID productId = UUID.randomUUID();
		UUID versionId = UUID.randomUUID();
		UUID groupId = UUID.randomUUID();
		jdbc.update(
				"INSERT INTO catalog_products (id, product_group_id, created_by) VALUES (?, ?, ?)",
				productId, groupId, actorId);
		jdbc.update(
				"INSERT INTO product_versions "
						+ "(id, product_id, version_no, status, title, description, category, changed_by) "
						+ "VALUES (?, ?, 1, 'DRAFT', ?, ?, ?, ?)",
				versionId, productId, input.title().trim(), input.description(),
				input.category().name(), actorId);
		jdbc.update(
				"INSERT INTO audit_events "
						+ "(id, actor_id, action, resource_type, resource_id, new_version_id, trace_id) "
						+ "VALUES (?, ?, 'CATALOG_DRAFT_CREATED', 'CATALOG_PRODUCT', ?, ?, ?)",
				UUID.randomUUID(), actorId, productId, versionId, traceId);
		return get(productId, actor);
	}

	@PreAuthorize("hasAuthority('CATALOG_DRAFT_WRITE')")
	@Transactional
	public Draft revise(
			UUID productId,
			int expectedVersionNo,
			CreateDraft input,
			Authentication actor,
			String traceId) {
		validateTraceId(traceId);
		UUID actorId = accountId(actor);
		List<UUID> owners = jdbc.query(
				"SELECT created_by FROM catalog_products WHERE id = ? AND archived_at IS NULL FOR UPDATE",
				(result, row) -> (UUID) result.getObject("created_by"),
				productId);
		if (owners.isEmpty()) {
			throw new CatalogDraftException("DRAFT_NOT_FOUND", HttpStatus.NOT_FOUND,
					"Catalog product does not exist");
		}
		boolean isAdministrator = actor.getAuthorities().stream()
				.anyMatch(authority -> authority.getAuthority().equals("CATALOG_PUBLISH"));
		if (!isAdministrator && !owners.get(0).equals(actorId)) {
			throw new CatalogDraftException("FORBIDDEN", HttpStatus.FORBIDDEN,
					"Catalog draft belongs to another account");
		}
		List<VersionRef> versions = jdbc.query(
				"SELECT id, version_no FROM product_versions WHERE product_id = ? "
						+ "ORDER BY version_no DESC LIMIT 1",
				(result, row) -> new VersionRef(
						(UUID) result.getObject("id"), result.getInt("version_no")),
				productId);
		VersionRef current = versions.get(0);
		if (expectedVersionNo != current.versionNo()) {
			throw new CatalogDraftException("VERSION_CONFLICT", HttpStatus.CONFLICT,
					"Catalog version changed; reload before editing");
		}
		UUID newVersionId = UUID.randomUUID();
		jdbc.update(
				"INSERT INTO product_versions "
						+ "(id, product_id, version_no, status, title, description, category, changed_by) "
						+ "VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?)",
				newVersionId, productId, current.versionNo() + 1,
				input.title().trim(), input.description(), input.category().name(), actorId);
		List<ImageRef> images = jdbc.query(
				"SELECT storage_uri, sha256, is_primary, media_type, byte_size, quality_state "
						+ "FROM product_images WHERE product_version_id = ?",
				(result, row) -> new ImageRef(
						result.getString("storage_uri"), result.getString("sha256"),
						result.getBoolean("is_primary"), result.getString("media_type"),
						result.getObject("byte_size", Long.class), result.getString("quality_state")),
				current.id());
		for (ImageRef image : images) {
			jdbc.update("INSERT INTO product_images "
						+ "(id, product_version_id, storage_uri, sha256, is_primary, "
						+ "media_type, byte_size, quality_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
					UUID.randomUUID(), newVersionId, image.storageUri(), image.sha256(),
					image.primary(), image.mediaType(), image.byteSize(), image.qualityState());
		}
		jdbc.update(
				"INSERT INTO audit_events "
						+ "(id, actor_id, action, resource_type, resource_id, previous_version_id, new_version_id, trace_id) "
						+ "VALUES (?, ?, 'CATALOG_DRAFT_REVISED', 'CATALOG_PRODUCT', ?, ?, ?, ?)",
				UUID.randomUUID(), actorId, productId, current.id(), newVersionId, traceId);
		return get(productId, actor);
	}

	@PreAuthorize("hasAuthority('CATALOG_DRAFT_WRITE')")
	@Transactional(readOnly = true)
	public Draft get(UUID productId, Authentication actor) {
		List<Draft> drafts = jdbc.query(
				"SELECT p.id AS product_id, v.id AS version_id, v.version_no, v.status, "
						+ "v.title, v.description, v.category, p.created_by, v.created_at, "
						+ "EXISTS (SELECT 1 FROM product_images i WHERE i.product_version_id = v.id "
						+ "AND i.is_primary) AS has_primary_image "
						+ "FROM catalog_products p JOIN product_versions v ON v.product_id = p.id "
						+ "WHERE p.id = ? AND p.archived_at IS NULL AND v.version_no = "
						+ "(SELECT MAX(v2.version_no) FROM product_versions v2 WHERE v2.product_id = p.id)",
				(result, row) -> new Draft(
						(UUID) result.getObject("product_id"),
						(UUID) result.getObject("version_id"),
						result.getInt("version_no"),
						result.getString("status"),
						result.getString("title"),
						result.getString("description"),
						Category.valueOf(result.getString("category")),
						(UUID) result.getObject("created_by"),
						result.getObject("created_at", OffsetDateTime.class),
						result.getBoolean("has_primary_image")),
				productId);
		if (drafts.isEmpty()) {
			throw new CatalogDraftException("DRAFT_NOT_FOUND", HttpStatus.NOT_FOUND,
					"Catalog draft does not exist");
		}
		Draft draft = drafts.get(0);
		boolean isAdministrator = actor.getAuthorities().stream()
				.anyMatch(authority -> authority.getAuthority().equals("CATALOG_PUBLISH"));
		if (!isAdministrator && !draft.createdBy().equals(accountId(actor))) {
			throw new CatalogDraftException("FORBIDDEN", HttpStatus.FORBIDDEN,
					"Catalog draft belongs to another account");
		}
		return draft;
	}

	@PreAuthorize("hasAuthority('CATALOG_DRAFT_WRITE')")
	@Transactional(readOnly = true)
	public DraftList list(String limitParam, String offsetParam, Authentication actor) {
		int limit = parseLimit(limitParam);
		int offset = parseOffset(offsetParam);
		UUID actorId = accountId(actor);
		boolean isAdministrator = actor.getAuthorities().stream()
				.anyMatch(authority -> authority.getAuthority().equals("CATALOG_PUBLISH"));
		String ownerFilter = isAdministrator ? "" : "AND p.created_by = ? ";
		Object[] args = isAdministrator
				? new Object[] { limit + 1, offset }
				: new Object[] { actorId, limit + 1, offset };
		List<DraftSummary> rows = jdbc.query(
				"SELECT p.id AS product_id, v.id AS version_id, v.version_no, v.status, "
						+ "v.title, v.category, v.created_at, "
						+ "EXISTS (SELECT 1 FROM product_images i WHERE i.product_version_id = v.id "
						+ "AND i.is_primary) AS has_primary_image "
						+ "FROM catalog_products p JOIN product_versions v ON v.product_id = p.id "
						+ "WHERE p.archived_at IS NULL AND v.status = 'DRAFT' AND v.version_no = "
						+ "(SELECT MAX(v2.version_no) FROM product_versions v2 WHERE v2.product_id = p.id) "
						+ ownerFilter
						+ "ORDER BY v.created_at DESC, p.id DESC LIMIT ? OFFSET ?",
				(result, row) -> new DraftSummary(
						(UUID) result.getObject("product_id"),
						(UUID) result.getObject("version_id"),
						result.getInt("version_no"),
						result.getString("status"),
						result.getString("title"),
						Category.valueOf(result.getString("category")),
						result.getObject("created_at", OffsetDateTime.class),
						result.getBoolean("has_primary_image")),
				args);
		boolean hasMore = rows.size() > limit;
		return new DraftList(hasMore ? rows.subList(0, limit) : rows, limit, offset, hasMore);
	}

	private static int parseLimit(String limitParam) {
		if (limitParam == null) {
			return 20;
		}
		try {
			int limit = Integer.parseInt(limitParam.trim());
			if (limit < 1 || limit > 100) {
				throw new CatalogDraftException("INVALID_REQUEST", HttpStatus.BAD_REQUEST,
						"Limit must be between 1 and 100");
			}
			return limit;
		}
		catch (NumberFormatException invalid) {
			throw new CatalogDraftException("INVALID_REQUEST", HttpStatus.BAD_REQUEST,
					"Limit must be an integer between 1 and 100");
		}
	}

	private static int parseOffset(String offsetParam) {
		if (offsetParam == null) {
			return 0;
		}
		try {
			int offset = Integer.parseInt(offsetParam.trim());
			if (offset < 0) {
				throw new CatalogDraftException("INVALID_REQUEST", HttpStatus.BAD_REQUEST,
						"Offset must be a non-negative integer");
			}
			return offset;
		}
		catch (NumberFormatException invalid) {
			throw new CatalogDraftException("INVALID_REQUEST", HttpStatus.BAD_REQUEST,
					"Offset must be a non-negative integer");
		}
	}

	private UUID accountId(Authentication actor) {
		return jdbc.queryForObject(
				"SELECT id FROM user_accounts WHERE LOWER(username) = ?",
				UUID.class,
				actor.getName().toLowerCase(Locale.ROOT));
	}

	private static void validateTraceId(String traceId) {
		if (traceId != null && traceId.length() > 128) {
			throw new CatalogDraftException("INVALID_REQUEST", HttpStatus.BAD_REQUEST,
					"Trace ID exceeds 128 characters");
		}
	}

	public enum Category {
		TOP, BOTTOM, ONE_PIECE
	}

	public record CreateDraft(String title, String description, Category category) {
	}

	public record Draft(
			UUID productId,
			UUID productVersionId,
			int versionNo,
			String status,
			String title,
			String description,
			Category category,
			UUID createdBy,
			OffsetDateTime createdAt,
			boolean hasPrimaryImage) {
	}

	public record DraftSummary(
			UUID productId,
			UUID productVersionId,
			int versionNo,
			String status,
			String title,
			Category category,
			OffsetDateTime createdAt,
			boolean hasPrimaryImage) {
	}

	public record DraftList(
			List<DraftSummary> items,
			int limit,
			int offset,
			boolean hasMore) {
	}

	private record VersionRef(UUID id, int versionNo) {
	}

	private record ImageRef(String storageUri, String sha256, boolean primary,
			String mediaType, Long byteSize, String qualityState) {
	}
}
