package com.springboot.fasearch.modules.analytics;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import com.springboot.fasearch.modules.analytics.dto.response.AnalyticsOverviewRes;
import com.springboot.fasearch.modules.analytics.service.interfaces.AnalyticsService;

/**
 * "Tổng hợp" report on a small known dataset (throwaway PostgreSQL, DEMO_TEST_DB_*). Range is 2001-03-01..03-03
 * (half-open to 03-04 00:00); rows just outside, cancelled, draft, soft-deleted and unpaid orders must not leak in.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class AnalyticsOverviewIntegrationTest {

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
    private AnalyticsService analytics;

    private long id(String sql, Object... args) {
        return jdbc.queryForObject(sql, Long.class, args);
    }

    private long order(Long customer, String at, String status, boolean deleted) {
        return id("insert into don_hang(ma_kh, ngay_dat, trang_thai, tong_tien, da_xoa) "
                + "values (?, cast(? as timestamp), ?, 1, ?) returning ma_don_hang", customer, at, status, deleted);
    }

    private void invoice(long order, String at, String amount, String method, boolean deleted) {
        jdbc.update("insert into hoa_don(ma_don_hang, ngay_lap, tong_tien_thuc_tra, trang_thai, payment_method_code, da_xoa) "
                + "values (?, cast(? as timestamp), ?, 'PAID', ?, ?)", order, at, new BigDecimal(amount), method, deleted);
    }

    private void line(long order, long sku, int qty, String price, String discount) {
        jdbc.update("insert into ct_don_hang(ma_don_hang, ma_sku, so_luong, don_gia, tien_giam) values (?,?,?,?,?)",
                order, sku, qty, new BigDecimal(price), new BigDecimal(discount));
    }

    @Test
    void overviewMatchesKnownDataset() {
        long catA = id("insert into danh_muc(ten_danh_muc) values ('Ao') returning ma_danh_muc");
        long catB = id("insert into danh_muc(ten_danh_muc) values ('Quan') returning ma_danh_muc");
        long pA = id("insert into san_pham(ten_sp, gia_ban, ma_danh_muc) values ('SP A', 100000, ?) returning ma_sp", catA);
        long pB = id("insert into san_pham(ten_sp, gia_ban, ma_danh_muc) values ('SP B', 100000, ?) returning ma_sp", catB);
        long sA = id("insert into bien_the_sp(ma_sp) values (?) returning ma_sku", pA);
        long sB = id("insert into bien_the_sp(ma_sp) values (?) returning ma_sku", pB);
        long c1 = id("insert into khach_hang(ten_kh, ho_kh) values ('An', 'Nguyen') returning ma_kh");
        long c2 = id("insert into khach_hang(ten_kh, ho_kh) values ('Binh', 'Tran') returning ma_kh");
        long c3 = id("insert into khach_hang(ten_kh, ho_kh) values ('Cuong', 'Le') returning ma_kh");

        long o1 = order(c1, "2001-03-01 10:00:00", "COMPLETED", false);
        line(o1, sA, 2, "100000", "0");
        line(o1, sB, 1, "100000", "0");
        invoice(o1, "2001-03-01 10:05:00", "300000", "CASH", false);

        long o2 = order(c1, "2001-03-03 23:30:00", "PENDING", false); // paid but not completed: still revenue
        line(o2, sA, 1, "100000", "0");
        invoice(o2, "2001-03-03 23:35:00", "100000", "STRIPE", false);
        invoice(o2, "2001-03-03 23:36:00", "11111", "CASH", true); // soft-deleted invoice ignored

        long o3 = order(c2, "2001-03-02 12:00:00", "COMPLETED", false);
        line(o3, sB, 2, "100000", "10000");
        invoice(o3, "2001-03-02 12:01:00", "190000", "VNPAY_QR", false);

        long o10 = order(c2, "2001-03-03 09:00:00", "COMPLETED", false);
        line(o10, sA, 1, "50000", "0");
        invoice(o10, "2001-03-03 09:01:00", "50000", null, false); // no method code -> OTHER

        long o4 = order(c2, "2001-03-04 00:00:00", "COMPLETED", false); // exactly the exclusive end
        line(o4, sA, 5, "100000", "0");
        invoice(o4, "2001-03-04 00:00:00", "500000", "CASH", false);

        long o5 = order(c2, "2001-03-02 08:00:00", "CANCELLED", false);
        invoice(o5, "2001-03-02 08:01:00", "999000", "CASH", false);

        long o6 = order(c3, "2001-02-28 23:59:00", "COMPLETED", false);
        line(o6, sA, 7, "100000", "0");
        invoice(o6, "2001-02-28 23:59:30", "777000", "CASH", false);
        order(c3, "2001-03-02 15:00:00", "PENDING", false); // unpaid: status count only; c3 not new
        order(c3, "2001-03-02 16:00:00", "DRAFT", false);
        order(c3, "2001-03-02 17:00:00", "COMPLETED", true);

        long o7 = order(c1, "2001-03-02 11:00:00", "COMPLETED", true); // soft-deleted order with a PAID invoice: excluded everywhere
        line(o7, sA, 9, "100000", "0");
        invoice(o7, "2001-03-02 11:05:00", "900000", "CASH", false);

        AnalyticsOverviewRes res = analytics.overview(LocalDate.of(2001, 3, 1), LocalDate.of(2001, 3, 3));

        assertThat(res.kpi().revenue()).isEqualByComparingTo("640000");
        assertThat(res.kpi().orders()).isEqualTo(4);
        assertThat(res.kpi().averageOrderValue()).isEqualByComparingTo("160000");
        assertThat(res.kpi().newCustomers()).as("c1 and c2 first order in range, c3 earlier").isEqualTo(2);

        assertThat(res.byCategory()).hasSize(2);
        assertThat(res.byCategory().get(0).categoryName()).isEqualTo("Ao");
        assertThat(res.byCategory().get(0).revenue()).isEqualByComparingTo("350000");
        assertThat(res.byCategory().get(0).quantity()).isEqualTo(4);
        assertThat(res.byCategory().get(1).categoryName()).isEqualTo("Quan");
        assertThat(res.byCategory().get(1).revenue()).isEqualByComparingTo("290000");
        assertThat(res.byCategory().get(1).quantity()).isEqualTo(3);

        assertThat(res.byStatus()).extracting(s -> s.status() + ":" + s.orders())
                .containsExactlyInAnyOrder("COMPLETED:3", "PENDING:2", "CANCELLED:1");

        assertThat(res.byPayment()).extracting(p -> p.method() + ":" + p.invoices() + ":" + p.revenue().intValue())
                .containsExactly("CASH:1:300000", "VNPAY_QR:1:190000", "STRIPE:1:100000", "OTHER:1:50000");

        assertThat(res.topCustomers()).hasSize(2);
        assertThat(res.topCustomers().get(0).name()).isEqualTo("Nguyen An");
        assertThat(res.topCustomers().get(0).orders()).isEqualTo(2);
        assertThat(res.topCustomers().get(0).revenue()).isEqualByComparingTo("400000");
        assertThat(res.topCustomers().get(0).lastOrderAt()).isEqualTo(java.time.LocalDateTime.of(2001, 3, 3, 23, 35));
        assertThat(res.topCustomers().get(1).name()).isEqualTo("Tran Binh");
        assertThat(res.topCustomers().get(1).revenue()).isEqualByComparingTo("240000");

        // Empty range: zeros, no division by zero, empty lists.
        AnalyticsOverviewRes empty = analytics.overview(LocalDate.of(2001, 5, 1), LocalDate.of(2001, 5, 2));
        assertThat(empty.kpi().orders()).isZero();
        assertThat(empty.kpi().averageOrderValue()).isEqualByComparingTo("0");
        assertThat(empty.byCategory()).isEmpty();
        assertThat(empty.topCustomers()).isEmpty();
    }
}
