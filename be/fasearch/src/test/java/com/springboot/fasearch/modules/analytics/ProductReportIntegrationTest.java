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
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.modules.analytics.dto.response.TopProductRes;
import com.springboot.fasearch.modules.analytics.service.interfaces.AnalyticsService;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@Transactional // Roll back fixtures: other report tests query this same historical date range.
class ProductReportIntegrationTest {

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        String host = env("DEMO_TEST_DB_HOST", "127.0.0.1");
        String port = env("DEMO_TEST_DB_PORT", "55440");
        String name = env("DEMO_TEST_DB_NAME", "");
        if (name.isBlank()) throw new IllegalStateException("DEMO_TEST_DB_NAME must explicitly name a throwaway test database");
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

    private void sale(long sku, int quantity, String at) {
        long order = id("insert into don_hang(ngay_dat,trang_thai,tong_tien) values (cast(? as timestamp),'COMPLETED',1000) returning ma_don_hang", at);
        jdbc.update("insert into ct_don_hang(ma_don_hang,ma_sku,so_luong,don_gia,tien_giam,points_discount_amount) values (?,?,?,100,10,5)", order, sku, quantity);
        jdbc.update("insert into hoa_don(ma_don_hang,ngay_lap,tong_tien_thuc_tra,trang_thai) values (?,cast(? as timestamp),1000,'PAID')", order, at);
    }

    @Test
    void aggregatesLiveSkusBeforeRankingAndSlowMovingFilter() {
        long product = id("insert into san_pham(ten_sp,gia_ban) values ('Two live SKUs',100) returning ma_sp");
        long a = id("insert into bien_the_sp(ma_sp) values (?) returning ma_sku", product);
        long b = id("insert into bien_the_sp(ma_sp) values (?) returning ma_sku", product);
        long deleted = id("insert into bien_the_sp(ma_sp,da_xoa) values (?,true) returning ma_sku", product);
        for (long sku : new long[]{a,b,deleted}) {
            jdbc.update("insert into ton_kho(ma_sku,so_luong_vat_ly,so_luong_kha_dung,so_luong_tam_giu) values (?,7,7,0)", sku);
        }
        sale(a, 3, "2001-03-01 10:00:00");
        sale(a, 2, "2001-03-02 10:00:00"); // stock must not multiply by order count
        sale(b, 9, "2001-03-04 00:00:00"); // exclusive end
        sale(deleted, 99, "2001-03-02 10:00:00");
        long order = id("select ma_don_hang from ct_don_hang where ma_sku=? order by ma_don_hang limit 1",a);
        long ret = id("insert into order_return(order_id,request_key,fingerprint,status,reason,merchandise_amount,shipping_amount,refund_amount) values (?,gen_random_uuid(),'test','REFUNDED','OTHER',100,0,100) returning id",order);
        jdbc.update("insert into order_return_line(return_id,sku_id,product_name,variant_name,quantity,gross_amount,voucher_discount,points_discount,refund_amount) values (?,?,'Two live SKUs','A',1,100,0,0,100)",ret,a);
        LocalDate start = LocalDate.of(2001,3,1), end = LocalDate.of(2001,3,3);
        var best = analytics.topProducts("BEST_SELLER",100,start,end);
        assertThat(best).filteredOn(r -> r.getProductId().equals(product)).singleElement().satisfies(r -> {
            assertThat(r.getTotalQuantitySold()).isEqualTo(4);
            assertThat(r.getTotalRevenue()).isEqualByComparingTo("370");
            assertThat(r.getCurrentInventory()).isEqualTo(14);
        });
        assertThat(analytics.topProducts("SLOW_MOVING",100,start,end))
                .extracting(TopProductRes::getProductId).doesNotContain(product);
        // Now both live SKUs sell: still one row, with summed quantity/revenue and unchanged stock.
        sale(b,2,"2001-03-03 10:00:00");
        assertThat(analytics.topProducts("BEST_SELLER",100,start,end))
                .filteredOn(r -> r.getProductId().equals(product)).singleElement().satisfies(r -> {
                    assertThat(r.getTotalQuantitySold()).isEqualTo(6);
                    assertThat(r.getTotalRevenue()).isEqualByComparingTo("555");
                    assertThat(r.getCurrentInventory()).isEqualTo(14);
                });
        assertThat(analytics.topProducts("SLOW_MOVING",100,LocalDate.of(2001,5,1),LocalDate.of(2001,5,2)))
                .extracting(TopProductRes::getProductId).contains(product);
        // Inventory movement remains per SKU.
        assertThat(analytics.inventoryMovement(2001,3,a,0,10).getContent()).singleElement()
                .satisfies(r -> assertThat(r.getSkuId()).isEqualTo(a));
    }
}
