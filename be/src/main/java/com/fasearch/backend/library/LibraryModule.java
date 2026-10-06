package com.fasearch.backend.library;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import com.fasearch.backend.search.application.PublicCatalogSnapshotProvider;

@Service
public class LibraryModule {

	static final Pattern PRODUCT_ID = Pattern.compile("^[A-Za-z0-9_.-]{1,128}$");

	static final int MAX_HISTORY_PER_ACCOUNT = 200;
	static final Duration HISTORY_RETENTION = Duration.ofDays(30);
	static final int MAX_QUERY_TEXT_CODE_POINTS = 1024;
	static final int MAX_RESULT_REFS = 100;
	private static final Set<String> HISTORY_MODES = Set.of("IMAGE", "TEXT", "COMPOSED");
	private static final Set<String> PREFERENCE_FIELDS = Set.of("record_history");

	private static final Logger log = LoggerFactory.getLogger(LibraryModule.class);

	private final JdbcTemplate jdbc;
	private final PublicCatalogSnapshotProvider snapshots;
	private final Clock clock;
	private final JsonMapper json;

	public LibraryModule(JdbcTemplate jdbc, PublicCatalogSnapshotProvider snapshots,
			Clock libraryClock, JsonMapper json) {
		this.jdbc = jdbc;
		this.snapshots = snapshots;
		this.clock = libraryClock;
		this.json = json;
	}

	@Transactional
	public void saveProduct(Authentication actor, String productId) {
		UUID accountId = accountId(actor);
		String canonical = validatedProductId(productId);
		var entry = snapshots.snapshot().findByProductId(canonical);
		if (entry == null) {
			throw new LibraryException("PRODUCT_NOT_FOUND", HttpStatus.NOT_FOUND,
					"Product is not in the current public catalog");
		}
		jdbc.update(
				"INSERT INTO saved_products (account_id, product_id, product_version_id) "
						+ "VALUES (?, ?, ?) ON CONFLICT (account_id, product_id) DO NOTHING",
				accountId, canonical, entry.productVersionId());
	}

	@Transactional
	public void removeProduct(Authentication actor, String productId) {
		UUID accountId = accountId(actor);
		String canonical = validatedProductId(productId);
		jdbc.update("DELETE FROM saved_products WHERE account_id = ? AND product_id = ?",
				accountId, canonical);
	}

	@Transactional(readOnly = true)
	public SavedPage listSaved(Authentication actor, int page, int size) {
		UUID accountId = accountId(actor);
		ValidatedPage paging = validatedPage(page, size);
		int total = jdbc.queryForObject(
				"SELECT COUNT(*) FROM saved_products WHERE account_id = ?",
				Integer.class, accountId);
		var rows = jdbc.query(
				"SELECT product_id, product_version_id, saved_at FROM saved_products "
						+ "WHERE account_id = ? ORDER BY saved_at DESC, product_id ASC LIMIT ? OFFSET ?",
				(result, row) -> new SavedRow(
						result.getString("product_id"),
						result.getString("product_version_id"),
						result.getTimestamp("saved_at").toInstant().toString()),
				accountId, paging.size(), (paging.page() - 1) * paging.size());
		var snapshot = snapshots.snapshot();
		return new SavedPage(total, paging.page(), paging.size(),
				rows.stream().map(row -> {
					var current = snapshot.findByProductId(row.productId());
					if (current == null) {
						return new SavedItem(row.productId(), row.savedAt(), false, null);
					}
					return new SavedItem(row.productId(), row.savedAt(), true, new SavedProduct(
							current.productId(), current.productVersionId(), current.title(),
							current.category(), current.imageUrl()));
				}).toList());
	}

	@Transactional(readOnly = true)
	public Preferences getPreferences(Authentication actor) {
		return new Preferences(readPreference(accountId(actor)));
	}

	@Transactional
	public Preferences updatePreferences(Authentication actor, JsonNode body) {
		UUID accountId = accountId(actor);
		if (body == null || !body.isObject()) {
			throw new LibraryException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
					"Request body must be a JSON object");
		}
		for (String field : body.propertyNames()) {
			if (!PREFERENCE_FIELDS.contains(field)) {
				throw new LibraryException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
						"Unknown or protected field: " + field);
			}
		}
		JsonNode value = body.get("record_history");
		if (value == null || !value.isBoolean()) {
			throw new LibraryException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
					"record_history must be a boolean");
		}
		boolean record = value.asBoolean();
		jdbc.update(
				"INSERT INTO library_preferences (account_id, record_history, updated_at) "
						+ "VALUES (?, ?, CURRENT_TIMESTAMP) "
						+ "ON CONFLICT (account_id) DO UPDATE SET record_history = ?, "
						+ "updated_at = CURRENT_TIMESTAMP",
				accountId, record, record);
		return new Preferences(record);
	}

	private boolean readPreference(UUID accountId) {
		List<Boolean> rows = jdbc.query(
				"SELECT record_history FROM library_preferences WHERE account_id = ?",
				(result, row) -> result.getBoolean("record_history"), accountId);
		return !rows.isEmpty() && rows.get(0);
	}

	public enum HistoryStatus {
		RECORDED, NOT_RECORDED
	}

	@Transactional
	public HistoryStatus recordAfterSuccess(
			Authentication actor,
			String mode,
			String queryTextOrNull,
			String catalogSnapshotId,
			String modelVersion,
			String indexVersion,
			List<ProductRef> refs,
			int resultCount,
			String traceId) {
		try {
			if (actor == null || !actor.isAuthenticated()
					|| actor instanceof AnonymousAuthenticationToken) {
				return HistoryStatus.NOT_RECORDED;
			}
			UUID accountId = accountId(actor);
			if (!readPreference(accountId)) {
				return HistoryStatus.NOT_RECORDED;
			}
			String storedText = boundedText(queryTextOrNull);
			String refsJson = refsJson(refs);
			jdbc.update(
					"INSERT INTO search_history (id, account_id, mode, query_text, result_count, "
							+ "catalog_snapshot_id, model_version, index_version, result_refs, trace_id) "
							+ "VALUES (?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?) "
							+ "ON CONFLICT (account_id, trace_id) DO NOTHING",
					UUID.randomUUID(), accountId, mode, storedText, resultCount,
					catalogSnapshotId, modelVersion, indexVersion, refsJson, traceId);
			prune(accountId);
		return HistoryStatus.RECORDED;
		}
		catch (LibraryException missing) {
			// Unknown account mid-request: search already succeeded; nothing stored.
			return HistoryStatus.NOT_RECORDED;
		}
		catch (RuntimeException failure) {
			// Capture must never fail a genuine successful search.
			log.warn("Search history capture failed; search result preserved", failure);
			return HistoryStatus.NOT_RECORDED;
		}
	}

	private void prune(UUID accountId) {
		Instant cutoff = clock.instant().minus(HISTORY_RETENTION);
		jdbc.update("DELETE FROM search_history WHERE account_id = ? AND created_at < ?",
				accountId, java.sql.Timestamp.from(cutoff));
		jdbc.update("DELETE FROM search_history WHERE account_id = ? AND id NOT IN ("
					+ "SELECT id FROM search_history WHERE account_id = ? "
					+ "ORDER BY created_at DESC, id DESC LIMIT ?)",
				accountId, accountId, MAX_HISTORY_PER_ACCOUNT);
	}

	void purgeExpired() {
		Instant cutoff = clock.instant().minus(HISTORY_RETENTION);
		jdbc.update("DELETE FROM search_history WHERE created_at < ?",
				java.sql.Timestamp.from(cutoff));
	}

	@Transactional(readOnly = true)
	public HistoryPage listHistory(Authentication actor, String mode, int page, int size) {
		UUID accountId = accountId(actor);
		ValidatedPage paging = validatedPage(page, size);
		String filter = validatedHistoryMode(mode);
		int total;
		if (filter == null) {
			total = jdbc.queryForObject(
					"SELECT COUNT(*) FROM search_history WHERE account_id = ?", Integer.class, accountId);
		}
		else {
			total = jdbc.queryForObject(
					"SELECT COUNT(*) FROM search_history WHERE account_id = ? AND mode = ?",
					Integer.class, accountId, filter);
		}
		var rows = filter == null
				? jdbc.query(
						"SELECT id, mode, query_text, result_count, catalog_snapshot_id, model_version, "
								+ "index_version, result_refs::text AS refs, trace_id, created_at "
								+ "FROM search_history WHERE account_id = ? "
								+ "ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
						(result, row) -> HistoryItem.from(result, row, json), accountId, paging.size(),
						(paging.page() - 1) * paging.size())
				: jdbc.query(
						"SELECT id, mode, query_text, result_count, catalog_snapshot_id, model_version, "
								+ "index_version, result_refs::text AS refs, trace_id, created_at "
								+ "FROM search_history WHERE account_id = ? AND mode = ? "
								+ "ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
						(result, row) -> HistoryItem.from(result, row, json), accountId, filter,
						paging.size(), (paging.page() - 1) * paging.size());
		return new HistoryPage(total, paging.page(), paging.size(), rows);
	}

	@Transactional
	public void deleteHistoryEntry(Authentication actor, String entryId) {
		UUID accountId = accountId(actor);
		UUID id;
		try {
			id = UUID.fromString(entryId);
		}
		catch (IllegalArgumentException invalid) {
			throw new LibraryException("INVALID_REQUEST", HttpStatus.BAD_REQUEST,
					"History entry id is invalid");
		}
		int removed = jdbc.update(
				"DELETE FROM search_history WHERE account_id = ? AND id = ?", accountId, id);
		if (removed == 0) {
			// Generic: missing and foreign-owner entries are indistinguishable.
			throw new LibraryException("HISTORY_NOT_FOUND", HttpStatus.NOT_FOUND,
					"History entry does not exist");
		}
	}

	@Transactional
	public void clearHistory(Authentication actor) {
		UUID accountId = accountId(actor);
		jdbc.update("DELETE FROM search_history WHERE account_id = ?", accountId);
	}

	static String validatedHistoryMode(String mode) {
		if (mode == null || mode.isBlank()) {
			return null;
		}
		if (!HISTORY_MODES.contains(mode)) {
			throw new LibraryException("INVALID_REQUEST", HttpStatus.BAD_REQUEST,
					"Unknown history mode");
		}
		return mode;
	}

	static String boundedText(String raw) {
		if (raw == null) {
			return null;
		}
		int length = raw.length();
		int codePoints = raw.codePointCount(0, length);
		if (codePoints <= MAX_QUERY_TEXT_CODE_POINTS) {
			return raw;
		}
		return raw.substring(0, raw.offsetByCodePoints(0, MAX_QUERY_TEXT_CODE_POINTS));
	}

	String refsJson(List<ProductRef> refs) {
		List<ProductRef> bounded = refs == null ? List.of()
				: refs.stream().limit(MAX_RESULT_REFS).toList();
		var array = json.createArrayNode();
		for (ProductRef ref : bounded) {
			var node = json.createObjectNode();
			node.put("product_id", ref.productId());
			node.put("product_version_id", ref.productVersionId());
			node.put("rank", ref.rank());
			array.add(node);
		}
		return array.toString();
	}

	public record Preferences(boolean recordHistory) {
	}

	public record ProductRef(String productId, String productVersionId, int rank) {
	}

	public record HistoryItem(
			UUID id,
			String mode,
			String queryText,
			int resultCount,
			String catalogSnapshotId,
			String modelVersion,
			String indexVersion,
			JsonNode resultRefs,
			String traceId,
			String createdAt) {
		static HistoryItem from(java.sql.ResultSet result, int row, JsonMapper json)
				throws java.sql.SQLException {
			String text = result.getString("query_text");
			JsonNode refs;
			try {
				refs = json.readTree(result.getString("refs"));
			}
			catch (RuntimeException invalid) {
				refs = json.createArrayNode();
			}
			return new HistoryItem(
					(UUID) result.getObject("id"),
					result.getString("mode"),
					text,
					result.getInt("result_count"),
					result.getString("catalog_snapshot_id"),
					result.getString("model_version"),
					result.getString("index_version"),
					refs,
					result.getString("trace_id"),
					result.getTimestamp("created_at").toInstant().toString());
		}
	}

	public record HistoryPage(int total, int page, int size, List<HistoryItem> items) {
	}

	private UUID accountId(Authentication actor) {
		if (actor == null || !actor.isAuthenticated()) {
			throw new LibraryException("UNAUTHENTICATED", HttpStatus.UNAUTHORIZED,
					"Authentication is required");
		}
		UUID id = jdbc.queryForObject(
				"SELECT id FROM user_accounts WHERE LOWER(username) = ?",
				UUID.class,
				actor.getName().toLowerCase(Locale.ROOT));
		if (id == null) {
			throw new LibraryException("UNAUTHENTICATED", HttpStatus.UNAUTHORIZED,
					"Account does not exist");
		}
		return id;
	}

	static String validatedProductId(String raw) {
		if (raw == null || !PRODUCT_ID.matcher(raw).matches()) {
			throw new LibraryException("INVALID_REQUEST", HttpStatus.BAD_REQUEST,
					"Product id is invalid");
		}
		return raw;
	}

	static ValidatedPage validatedPage(int page, int size) {
		if (page < 1 || size < 1 || size > 100) {
			throw new LibraryException("INVALID_REQUEST", HttpStatus.BAD_REQUEST,
					"Page must be >= 1 and size 1-100");
		}
		return new ValidatedPage(page, size);
	}

	public record ValidatedPage(int page, int size) {
	}

	public record SavedRow(String productId, String productVersionId, String savedAt) {
	}

	public record SavedProduct(
			String productId,
			String productVersionId,
			String title,
			String category,
			String imageUrl) {
	}

	public record SavedItem(String productId, String savedAt, boolean available, SavedProduct product) {
	}

	public record SavedPage(int total, int page, int size, java.util.List<SavedItem> items) {
	}
}
