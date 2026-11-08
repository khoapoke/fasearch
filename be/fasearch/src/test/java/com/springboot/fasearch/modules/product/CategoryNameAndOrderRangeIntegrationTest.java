package com.springboot.fasearch.modules.product;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
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
