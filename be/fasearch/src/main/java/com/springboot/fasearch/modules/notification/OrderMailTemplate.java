package com.springboot.fasearch.modules.notification;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;

/** Renders untrusted order data as escaped HTML for transactional email. */
public final class OrderMailTemplate {
    private OrderMailTemplate() {}

    public record Item(String name, int quantity) {}
    public record Content(String subject, String html, String text) {}

    public static Content render(String orderCode, String update, String reason,
                                 List<Item> items, BigDecimal total, String orderUrl) {
        String amount = money(total);
        String subject = "FaSearch - Cập nhật đơn hàng " + orderCode;
        StringBuilder html = new StringBuilder("<div style=\"font-family:Arial,sans-serif;color:#1c1c1c;max-width:600px;margin:auto\">")
                .append("<h1 style=\"color:#222\">FaSearch</h1><h2>Cập nhật đơn hàng ")
                .append(escape(orderCode)).append("</h2><p>").append(escape(update)).append("</p>");
        StringBuilder text = new StringBuilder("FaSearch\nĐơn hàng ").append(orderCode)
                .append("\n").append(update).append('\n');
        if (reason != null && !reason.isBlank()) {
            html.append("<p>Lý do: ").append(escape(reason)).append("</p>");
            text.append("Lý do: ").append(reason).append('\n');
        }
        html.append("<ul>");
        for (Item item : items) {
            html.append("<li>").append(escape(item.name())).append(" × ").append(item.quantity()).append("</li>");
            text.append("- ").append(item.name()).append(" × ").append(item.quantity()).append('\n');
        }
        html.append("</ul><p><strong>Tổng cộng: ").append(escape(amount))
                .append("</strong></p><p><a href=\"").append(escape(orderUrl))
                .append("\">Xem đơn hàng</a></p></div>");
        text.append("Tổng cộng: ").append(amount).append("\nXem đơn hàng: ").append(orderUrl);
        return new Content(subject, html.toString(), text.toString());
    }

    public static Content favorite(String name, String update, BigDecimal price, String productUrl) {
        Content content = render(name, update, null, List.of(), price, productUrl);
        return new Content("FaSearch - Thông báo sản phẩm yêu thích", content.html()
                .replace("Cập nhật đơn hàng ", "Sản phẩm yêu thích: ").replace("Xem đơn hàng", "Xem sản phẩm").replace("Tổng cộng:", "Giá hiện tại:"),
                content.text().replace("Đơn hàng ", "Sản phẩm ").replace("Xem đơn hàng", "Xem sản phẩm").replace("Tổng cộng:", "Giá hiện tại:"));
    }

    public static String money(BigDecimal amount) {
        return NumberFormat.getNumberInstance(Locale.forLanguageTag("vi-VN")).format(amount) + " ₫";
    }

    private static String escape(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }
}
