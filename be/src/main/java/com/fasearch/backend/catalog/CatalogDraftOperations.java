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

import com.fasearch.backend.catalog.CatalogDraftModule.Category;
import com.fasearch.backend.catalog.CatalogImageModule.ImageBytes;

/**
 * Read-only operations for the Catalog Operations Console: scoped summary
 * counts, immutable version timeline/detail, version-bound image reads and
 * product-scoped catalog audit trail. All reads require
 * CATALOG_DRAFT_WRITE plus the existing owner/CATALOG_PUBLISH binding.
 */
@Service
public class CatalogDraftOperations {

	private final JdbcTemplate jdbc;
	private final CatalogDraftModule drafts;
	private final CatalogObjectStore objects;

	public CatalogDraftOperations(JdbcTemplate jdbc, CatalogDraftModule drafts,
			CatalogObjectStore objects) {
		this.jdbc = jdbc;
		this.drafts = drafts;
		this.objects = objects;
	}

	@PreAuthorize("hasAuthority('CATALOG_DRAFT_WRITE')")
	@Transactional(readOnly = true)
	public DraftSummaryCounts summary(Authentication actor) {
		UUID actorId = accountId(actor);
		boolean isAdministrator = isAdministrator(actor);
		String ownerFilter = isAdministrator ? "" : "AND p.created_by = ? ";
		Object[] args = isAdministrator ? new Object[] {} : new Object[] { actorId };
		String from = "FROM catalog_products p JOIN product_versions v ON v.product_id = p.id "
				+ "WHERE p.archived_at IS NULL AND v.status = 'DRAFT' AND v.version_no = "
				+ "(SELECT MAX(v2.version_no) FROM product_versions v2 WHERE v2.product_id = p.id) "
				+ ownerFilter;
		int total = count("SELECT COUNT(*) " + from, args);
		int withImage = count("SELECT COUNT(*) " + from
				+ "AND EXISTS (SELECT 1 FROM product_images i "
				+ "WHERE i.product_version_id = v.id AND i.is_primary) ", args);
		int top = count("SELECT COUNT(*) " + from + "AND v.category = 'TOP' ", args);
		int bottom = count("SELECT COUNT(*) " + from + "AND v.category = 'BOTTOM' ", args);
		int onePiece = count("SELECT COUNT(*) " + from + "AND v.category = 'ONE_PIECE' ", args);
		return new DraftSummaryCounts(total, withImage, total - withImage, top, bottom, onePiece);
	}

	@PreAuthorize("hasAuthority('CATALOG_DRAFT_WRITE')")
	@Transactional(readOnly = true)
	public VersionList versions(UUID productId, String limitParam, String offsetParam,
			Authentication actor) {
		int limit = parseLimit(limitParam);
		int offset = parseOffset(offsetParam);
		// Owner/admin binding first: denies cross-owner timeline reads.
		drafts.get(productId, actor);
		Integer total = jdbc.queryForObject(
				"SELECT COUNT(*) FROM product_versions WHERE product_id = ?",
				Integer.class, productId);
		List<VersionEntry> rows = jdbc.query(
				"SELECT v.id AS version_id, v.version_no, v.status, v.title, v.category, "
						+ "v.created_at, EXISTS (SELECT 1 FROM product_images i "
						+ "WHERE i.product_version_id = v.id AND i.is_primary) AS has_primary_image "
						+ "FROM product_versions v WHERE v.product_id = ? "
						+ "ORDER BY v.version_no DESC LIMIT ? OFFSET ?",
				(result, row) -> new VersionEntry(
						(UUID) result.getObject("version_id"),
						result.getInt("version_no"),
						result.getString("status"),
						result.getString("title"),
						Category.valueOf(result.getString("category")),
						result.getObject("created_at", OffsetDateTime.class),
						result.getBoolean("has_primary_image")),
				productId, limit + 1, offset);
		boolean hasMore = rows.size() > limit;
		return new VersionList(hasMore ? rows.subList(0, limit) : rows, limit, offset, hasMore,
				total == null ? 0 : total);
	}

	@PreAuthorize("hasAuthority('CATALOG_DRAFT_WRITE')")
	@Transactional(readOnly = true)
	public VersionDetail versionDetail(UUID productId, UUID productVersionId,
			Authentication actor) {
		drafts.get(productId, actor);
		List<VersionDetail> rows = jdbc.query(
				"SELECT v.id AS version_id, v.version_no, v.status, v.title, v.description, "
						+ "v.category, v.created_at, "
						+ "EXISTS (SELECT 1 FROM product_images i "
						+ "WHERE i.product_version_id = v.id AND i.is_primary) AS has_primary_image, "
						+ "(SELECT i.media_type FROM product_images i "
						+ "WHERE i.product_version_id = v.id AND i.is_primary) AS media_type, "
						+ "(SELECT i.byte_size FROM product_images i "
						+ "WHERE i.product_version_id = v.id AND i.is_primary) AS byte_size, "
						+ "(SELECT i.quality_state FROM product_images i "
						+ "WHERE i.product_version_id = v.id AND i.is_primary) AS quality_state "
						+ "FROM product_versions v WHERE v.product_id = ? AND v.id = ?",
				(result, row) -> new VersionDetail(
						(UUID) result.getObject("version_id"),
						result.getInt("version_no"),
						result.getString("status"),
						result.getString("title"),
						result.getString("description"),
						Category.valueOf(result.getString("category")),
						result.getObject("created_at", OffsetDateTime.class),
						result.getBoolean("has_primary_image"),
						result.getString("media_type"),
						(Long) result.getObject("byte_size"),
						result.getString("quality_state")),
				productId, productVersionId);
		if (rows.isEmpty()) {
			throw new CatalogDraftException("VERSION_NOT_FOUND", HttpStatus.NOT_FOUND,
					"Product version does not exist");
		}
		return rows.get(0);
	}

	@PreAuthorize("hasAuthority('CATALOG_DRAFT_WRITE')")
	@Transactional(readOnly = true)
	public ImageBytes versionImage(UUID productId, UUID productVersionId,
			Authentication actor) {
		drafts.get(productId, actor);
		List<ImageRef> images = jdbc.query(
				"SELECT i.storage_uri, i.media_type FROM product_images i "
						+ "JOIN product_versions v ON v.id = i.product_version_id "
						+ "WHERE v.product_id = ? AND v.id = ? AND i.is_primary = TRUE",
				(result, row) -> new ImageRef(result.getString("storage_uri"),
						result.getString("media_type")),
				productId, productVersionId);
		if (images.isEmpty()) {
			throw new CatalogDraftException("IMAGE_NOT_FOUND", HttpStatus.NOT_FOUND,
					"Product version has no primary image");
		}
		ImageRef image = images.get(0);
		byte[] bytes = objects.read(image.storageUri());
		if (bytes == null) {
			throw new CatalogDraftException("IMAGE_NOT_FOUND", HttpStatus.NOT_FOUND,
					"Product image is unavailable");
		}
		return new ImageBytes(bytes, image.mediaType());
	}

	@PreAuthorize("hasAuthority('CATALOG_DRAFT_WRITE')")
	@Transactional(readOnly = true)
	public AuditList audit(UUID productId, String limitParam, String offsetParam,
			Authentication actor) {
		int limit = parseLimit(limitParam);
		int offset = parseOffset(offsetParam);
		drafts.get(productId, actor);
		Integer total = jdbc.queryForObject(
				"SELECT COUNT(*) FROM audit_events "
						+ "WHERE resource_type = 'CATALOG_PRODUCT' AND resource_id = ? "
						+ "AND action IN "
						+ "('CATALOG_DRAFT_CREATED','CATALOG_DRAFT_REVISED','CATALOG_PRIMARY_IMAGE_REPLACED')",
				Integer.class, productId);
		List<AuditEntry> rows = jdbc.query(
				"SELECT e.id AS event_id, e.action, e.created_at, e.resource_id, "
						+ "e.previous_version_id, e.new_version_id, e.trace_id, e.actor_id, "
						+ "pv.version_no AS previous_version_no, nv.version_no AS new_version_no "
						+ "FROM audit_events e "
						+ "LEFT JOIN product_versions pv ON pv.id = e.previous_version_id "
						+ "LEFT JOIN product_versions nv ON nv.id = e.new_version_id "
						+ "WHERE e.resource_type = 'CATALOG_PRODUCT' AND e.resource_id = ? "
						+ "AND e.action IN "
						+ "('CATALOG_DRAFT_CREATED','CATALOG_DRAFT_REVISED','CATALOG_PRIMARY_IMAGE_REPLACED') "
						+ "ORDER BY e.created_at DESC, e.id DESC LIMIT ? OFFSET ?",
				(result, row) -> new AuditEntry(
						(UUID) result.getObject("event_id"),
						result.getString("action"),
						result.getObject("created_at", OffsetDateTime.class),
						(UUID) result.getObject("resource_id"),
						(UUID) result.getObject("previous_version_id"),
						(UUID) result.getObject("new_version_id"),
						(Integer) result.getObject("previous_version_no"),
						(Integer) result.getObject("new_version_no"),
						result.getString("trace_id"),
						(UUID) result.getObject("actor_id")),
				productId, limit + 1, offset);
		boolean hasMore = rows.size() > limit;
		return new AuditList(hasMore ? rows.subList(0, limit) : rows, limit, offset, hasMore,
				total == null ? 0 : total);
	}

	private int count(String sql, Object[] args) {
		Integer value = jdbc.queryForObject(sql, Integer.class, args);
		return value == null ? 0 : value;
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

	private static boolean isAdministrator(Authentication actor) {
		return actor.getAuthorities().stream()
				.anyMatch(authority -> authority.getAuthority().equals("CATALOG_PUBLISH"));
	}

	public record DraftSummaryCounts(
			int total,
			int withPrimaryImage,
			int withoutPrimaryImage,
			int top,
			int bottom,
			int onePiece) {
	}

	public record VersionEntry(
			UUID productVersionId,
			int versionNo,
			String status,
			String title,
			Category category,
			OffsetDateTime createdAt,
			boolean hasPrimaryImage) {
	}

	public record VersionList(
			List<VersionEntry> items,
			int limit,
			int offset,
			boolean hasMore,
			int total) {
	}

	public record VersionDetail(
			UUID productVersionId,
			int versionNo,
			String status,
			String title,
			String description,
			Category category,
			OffsetDateTime createdAt,
			boolean hasPrimaryImage,
			String mediaType,
			Long byteSize,
			String qualityState) {
	}

	public record AuditEntry(
			UUID eventId,
			String action,
			OffsetDateTime createdAt,
			UUID productId,
			UUID previousVersionId,
			UUID newVersionId,
			Integer previousVersionNo,
			Integer newVersionNo,
			String traceId,
			UUID actorId) {
	}

	public record AuditList(
			List<AuditEntry> items,
			int limit,
			int offset,
			boolean hasMore,
			int total) {
	}

	private record ImageRef(String storageUri, String mediaType) {
	}
}
