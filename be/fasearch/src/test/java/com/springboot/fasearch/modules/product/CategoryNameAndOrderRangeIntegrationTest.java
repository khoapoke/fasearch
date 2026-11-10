package com.springboot.fasearch.modules.product;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ClassPathResource;
import org.springframework.transaction.annotation.Transactional;
import com.springboot.fasearch.modules.trash.service.interfaces.TrashService;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.exception.GlobalExceptionHandler;
import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.order.repository.OrderRepository;
import com.springboot.fasearch.modules.order.repository.OrderSpecifications;
import com.springboot.fasearch.modules.product.dto.request.CategoryReq;
import com.springboot.fasearch.modules.product.service.interfaces.CategoryService;

/**
 * Round 2 lane F5 on a throwaway PostgreSQL (DEMO_TEST_DB_*): category names are unique ignoring case and
 * surrounding spaces (diacritics significant, deleted ones ignored), and the order list date filter covers
 * whole days with a half-open end.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class CategoryNameAndOrderRangeIntegrationTest {

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        String host = env("DEMO_TEST_DB_HOST", "127.0.0.1");
        String port = env("DEMO_TEST_DB_PORT", "55440");
        String name = env("DEMO_TEST_DB_NAME", "fasearch_demo_integrated_20261030");
        registry.add("spring.datasource.url", () -> "jdbc:postgresql://" + host + ":" + port + "/" + name);
        registry.add("spring.datasource.username", () -> env("DEMO_TEST_DB_USER", "fasearch"));
        registry.add("spring.datasource.password", () -> env("DEMO_TEST_DB_PASSWORD", ""));
    }

    private static String env(String key, String fallback) {
        String value = System.getenv(key);
        return value == null || value.isBlank() ? fallback : value;
    }

    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private CategoryService categories;
    @Autowired
    private OrderRepository orders;
    @Autowired
    private TrashService trash;

    private CategoryReq req(String name) {
        CategoryReq r = new CategoryReq();
        r.setCategoryName(name);
        return r;
    }

    private void assertDuplicate(Runnable call) {
        assertThatThrownBy(call::run).isInstanceOfSatisfying(AppException.class,
                e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.CATEGORY_NAME_ALREADY_EXISTS));
    }

    @Test
    void categoryNamesAreUniqueIgnoringCaseAndSpaces() {
        Long ao = categories.createCategory(req("Áo Khoác F5")).getId();
        assertDuplicate(() -> categories.createCategory(req("áo khoác f5")));
        assertDuplicate(() -> categories.createCategory(req("  ÁO KHOÁC F5  ")));
        // Diacritics are significant: a different word, not a duplicate.
        Long plain = categories.createCategory(req("Ao Khoac F5")).getId();
        assertThat(plain).isNotEqualTo(ao);

        // Rename: own name with another case is fine; another category's name is not.
        categories.updateCategory(ao, req("ÁO KHOÁC F5"));
        assertDuplicate(() -> categories.updateCategory(plain, req("áo khoác f5")));
        assertDuplicate(() -> categories.updateCategory(plain, req("  Áo Khoác F5 ")));

        // A soft-deleted category does not block its name.
        jdbc.update("update danh_muc set da_xoa = true where ma_danh_muc = ?", ao);
        Long again = categories.createCategory(req("áo khoác f5")).getId();
        assertThat(again).isNotEqualTo(ao);
    }

    @Test
    @Transactional
    void migrationMergesReferencesAndRestoreRejectsNormalizedConflict() throws Exception {
        jdbc.execute("drop index uq_danh_muc_active_name");
        long winner = jdbc.queryForObject("insert into danh_muc(ten_danh_muc) values ('MERGE TEST') returning ma_danh_muc", Long.class);
        long duplicate = jdbc.queryForObject("insert into danh_muc(ten_danh_muc) values ('merge   test') returning ma_danh_muc", Long.class);
        jdbc.update("insert into san_pham(ten_sp, gia_ban, ma_danh_muc) values ('winner', 1, ?)", winner);
        jdbc.update("insert into san_pham(ten_sp, gia_ban, ma_danh_muc, da_xoa) values ('deleted', 1, ?, true)", duplicate);
        jdbc.update("insert into product_draft(ma_danh_muc) values (?)", duplicate);
        String migration = new ClassPathResource("db/migration/V34__merge_duplicate_categories.sql")
                .getContentAsString(StandardCharsets.UTF_8);
        jdbc.execute(migration);
        assertThat(jdbc.queryForObject("select ten_danh_muc from danh_muc where ma_danh_muc = ?", String.class, winner)).isEqualTo("Merge test");
        assertThat(jdbc.queryForObject("select count(*) from san_pham where ma_danh_muc = ?", Long.class, winner)).isEqualTo(2);
        assertThat(jdbc.queryForObject("select count(*) from product_draft where ma_danh_muc = ?", Long.class, winner)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select ly_do_xoa from danh_muc where ma_danh_muc = ? and da_xoa and ngay_xoa is not null", String.class, duplicate)).isEqualTo("Gộp trùng tên vào #" + winner);
        assertThatThrownBy(() -> trash.restoreCategory(duplicate)).isInstanceOfSatisfying(AppException.class,
                e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.RESTORE_CONFLICT));
        // A second execution has no duplicates and must be safe.
        jdbc.execute(migration);
        assertThat(jdbc.queryForObject("select count(*) from pg_indexes where indexname = 'uq_danh_muc_active_name'", Long.class)).isEqualTo(1);
    }

    @Test
    void uniqueIndexViolationMapsToCategoryError() {
        jdbc.update("insert into danh_muc(ten_danh_muc) values ('index conflict fixture')");
        try {
            jdbc.update("insert into danh_muc(ten_danh_muc) values ('INDEX CONFLICT FIXTURE')");
            throw new AssertionError("Expected unique index violation");
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            var response = new GlobalExceptionHandler().handleRuntimeException(e);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
            assertThat(response.getBody().getMessage()).isEqualTo(ErrorCode.CATEGORY_NAME_ALREADY_EXISTS.getMessage());
        }
    }

    @Test
    void orderDateRangeIsWholeDaysWithHalfOpenEnd() {
        long customer = jdbc.queryForObject(
                "insert into khach_hang(ten_kh, ho_kh) values ('F5', 'Range') returning ma_kh", Long.class);
        String[] at = { "2002-05-09 23:59:59.999999", "2002-05-10 00:00:00", "2002-05-11 23:59:59.999999",
                "2002-05-12 00:00:00" };
        for (String t : at) {
            jdbc.update("insert into don_hang(ma_kh, ngay_dat, trang_thai, tong_tien, da_xoa) "
                    + "values (?, cast(? as timestamp), 'PENDING', 1, false)", customer, t);
        }
        List<Order> found = orders.findAll(OrderSpecifications.list(null, null, null, null,
                LocalDate.of(2002, 5, 10), LocalDate.of(2002, 5, 11), null));
        assertThat(found).extracting(o -> o.getOrderDate().toString())
                .containsExactlyInAnyOrder("2002-05-10T00:00", "2002-05-11T23:59:59.999999");
        // A later start, an end-only filter and a single day.
        assertThat(orders.count(OrderSpecifications.list(null, null, null, null, LocalDate.of(2002, 5, 11), LocalDate.of(2002, 5, 30), null)))
                .isEqualTo(2);
        assertThat(orders.count(OrderSpecifications.list(null, null, null, null, null, LocalDate.of(2002, 5, 9), null)))
                .isEqualTo(1);
        assertThat(orders.count(OrderSpecifications.list(null, null, null, null,
                LocalDate.of(2002, 5, 10), LocalDate.of(2002, 5, 10), null))).isEqualTo(1);
    }
}
