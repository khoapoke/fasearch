package com.springboot.fasearch.modules.notification;

import static org.junit.jupiter.api.Assertions.*;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class OrderMailTemplateTest {
    @Test void favoriteUsesVietnamesePriceAndAProductLink() {
        var result=OrderMailTemplate.favorite("Áo", "Đã có hàng", new BigDecimal("650000.00"), "https://shop.example/san-pham/1");
        assertTrue(result.html().contains("Giá hiện tại: 650.000 ₫"));
        assertTrue(result.html().contains("Xem sản phẩm"));
        assertEquals("650.000 ₫",OrderMailTemplate.money(new BigDecimal("650000.00")));
    }

    @Test
    void rendersOrderAndEscapesUntrustedHtml() {
        var result = OrderMailTemplate.render("DH-1", "Đã hủy", "<script>x</script>",
                List.of(new OrderMailTemplate.Item("Áo & quần", 2)),
                new BigDecimal("120000"), "https://shop.example/don-hang/1?a=1&b=2");
        assertTrue(result.html().contains("&lt;script&gt;x&lt;/script&gt;"));
        assertTrue(result.html().contains("Áo &amp; quần × 2"));
        assertTrue(result.html().contains("a=1&amp;b=2"));
        assertTrue(result.text().contains("Lý do: <script>x</script>"));
        assertTrue(result.subject().contains("DH-1"));
    }
}
