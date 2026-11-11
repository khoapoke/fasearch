package com.springboot.fasearch.client;

/**
 * Mau email tieng Viet (HTML + text) cho 3 loai thong bao giao dich.
 *
 * <p>Dinh danh lay dung tu FaSearch Customer identity (khong che mau moi):
 * <ul>
 *   <li>{@code customer-palette.css} (.hmPalette) — canvas {@code #fbfaf7} (--st-canvas),
 *       chu {@code #1b1c1a} (--st-ink) / {@code #5f655c} (--st-ink-soft),
 *       CTA {@code #3730d8} (--st-brand INDIGO — nut "Thêm vào giỏ"
 *       {@code .cat-button.cat-primary} va "Chỉnh sửa hồ sơ"
 *       {@code .acctPage .auth-button.is-primary} deu dung {@code var(--st-brand)}),
 *       link {@code #3730d8} (--st-brand-text), vien {@code #dedfd7} (--st-line),
 *       nen hop link {@code #f1f0ea} (--st-select),
 *       nen hop luu y {@code #ecedf9} (--st-info-bg, indigo-tinted),
 *       lime {@code #d6ef72} (--st-citron) + vien shirt {@code #20211f}
 *       (FaSearchMark trong {@code customer-header.tsx}).</li>
 *   <li>{@code fe/src/app/globals.css} — bo goc {@code 8px} (--radius),
 *       kieu chu Be Vietnam Pro truoc Helvetica/Arial (--font-sans).</li>
 *   <li>Header storefront ({@code customer-header.tsx}) — mark corner-bracket
 *       (goc TL + BR, vien ink nhu currentColor) boc khoi lime bo goc,
 *       wordmark "FaSearch" dam; dung table/CSS-only (khong anh, khong SVG —
 *       Gmail chan data: URI, khong tai anh tu 127.0.0.1 duoc).</li>
 * </ul>
 * Gmail khong ke thua font: font sans ap inline tren MOI the text
 * (p, td, a, h1) de khong roi ve serif.
 * Tuong thich client mail: table layout, max-width 600px, moi style inline
 * (chi <style> cho media query), nut CTA dang bulletproof (table cell + link,
 * kem VML cho Outlook), preheader an, tuong phan dat chuan, alt text day du,
 * uu tien giao dien sang (meta color-scheme + media query giu palette sang).
 */
public final class EmailTemplates {

    // -- Brand tokens (FaSearch Customer identity, khong che mau moi) --
    private static final String CANVAS = "#fbfaf7";   // customer-palette --st-canvas
    private static final String CARD = "#ffffff";     // customer-palette --st-surface
    private static final String INK = "#1b1c1a";      // customer-palette --st-ink
    private static final String INK_SOFT = "#5f655c"; // customer-palette --st-ink-soft
    private static final String BRAND = "#3730d8";    // customer-palette --st-brand INDIGO (nut storefront)
    private static final String LIME = "#d6ef72";     // customer-palette --st-citron (shirt mark)
    private static final String SHIRT_EDGE = "#20211f"; // vien shirt mark (customer-header.tsx)
    private static final String LINE = "#dedfd7";     // customer-palette --st-line
    private static final String SUBTLE = "#f1f0ea";   // customer-palette --st-select: nen hop link
    private static final String NOTE_BG = "#ecedf9";  // customer-palette --st-info-bg: hop luu y indigo-tinted
    private static final String RADIUS = "8px";       // globals.css --radius
    private static final String FONT =
            "'Be Vietnam Pro',Helvetica,Arial,sans-serif";
    private static final String MONO =
            "Consolas,'Courier New',Courier,monospace";

    private EmailTemplates() {
    }

    public record MailMessage(String subject, String htmlContent, String textContent) {
    }

    public static MailMessage verifyEmail(String name, String link) {
        String hello = "Chào " + safe(name) + ",";
        String subject = "Xác thực địa chỉ email FaSearch";
        String text = hello + "\n\n"
                + "Cảm ơn bạn đã tạo tài khoản FaSearch. Nhấn vào liên kết bên dưới để xác thực địa chỉ email này:\n\n"
                + link + "\n\n"
                + "Liên kết có hiệu lực trong 24 giờ. Nếu bạn không tạo tài khoản, hãy bỏ qua email này.\n\n"
                + footerText();
        return new MailMessage(subject,
                layout(subject,
                        "Xác thực địa chỉ email của bạn — liên kết hiệu lực trong 24 giờ.",
                        "Xác thực địa chỉ email",
                        hello,
                        "<p style=\"" + p() + "\">Cảm ơn bạn đã tạo tài khoản FaSearch. "
                                + "Nhấn vào nút bên dưới để xác thực địa chỉ email này:</p>"
                                + ctaButton(link, "Xác thực email")
                                + linkFallbackBox(link)
                                + metaLine("Liên kết có hiệu lực trong <strong>24 giờ</strong>.")
                                + securityBox(
                                        "Nếu bạn không tạo tài khoản FaSearch, hãy bỏ qua email này — "
                                                + "không cần thực hiện thêm gì cả."),
                        link),
                text);
    }

    public static MailMessage resetPassword(String name, String link) {
        String hello = "Chào " + safe(name) + ",";
        String subject = "Đặt lại mật khẩu FaSearch";
        String text = hello + "\n\n"
                + "Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Nhấn vào liên kết bên dưới để tạo mật khẩu mới:\n\n"
                + link + "\n\n"
                + "Liên kết có hiệu lực trong 30 phút và chỉ dùng được một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu của bạn vẫn an toàn.\n\n"
                + footerText();
        return new MailMessage(subject,
                layout(subject,
                        "Đặt lại mật khẩu FaSearch — liên kết hiệu lực 30 phút, dùng một lần.",
                        "Đặt lại mật khẩu",
                        hello,
                        "<p style=\"" + p() + "\">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. "
                                + "Nhấn vào nút bên dưới để tạo mật khẩu mới:</p>"
                                + ctaButton(link, "Đặt lại mật khẩu")
                                + linkFallbackBox(link)
                                + metaLine(
                                        "Liên kết có hiệu lực trong <strong>30 phút</strong> và <strong>chỉ dùng được một lần</strong>.")
                                + securityBox(
                                        "Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này — "
                                                + "mật khẩu của bạn vẫn an toàn."),
                        link),
                text);
    }

    public static MailMessage passwordChanged(String name) {
        String hello = "Chào " + safe(name) + ",";
        String subject = "Mật khẩu FaSearch vừa được thay đổi";
        String text = hello + "\n\n"
                + "Mật khẩu tài khoản FaSearch của bạn vừa được thay đổi. Mọi phiên đăng nhập cũ (kể cả trên thiết bị này) đã hết hiệu lực — hãy đăng nhập lại bằng mật khẩu mới.\n\n"
                + "Nếu không phải bạn thực hiện, hãy dùng chức năng \"Quên mật khẩu\" ngay để đặt lại.\n\n"
                + footerText();
        return new MailMessage(subject,
                layout(subject,
                        "Mật khẩu FaSearch của bạn vừa được thay đổi.",
                        "Mật khẩu đã được thay đổi",
                        hello,
                        "<p style=\"" + p() + "\">Mật khẩu tài khoản FaSearch của bạn vừa được thay đổi. "
                                + "Mọi phiên đăng nhập cũ (kể cả trên thiết bị này) đã hết hiệu lực — "
                                + "hãy đăng nhập lại bằng mật khẩu mới.</p>"
                                + securityBox(
                                        "Nếu không phải bạn thực hiện, hãy dùng chức năng "
                                                + "&ldquo;Quên mật khẩu&rdquo; trên trang đăng nhập ngay để đặt lại mật khẩu."),
                        null),
                text);
    }

    // -- Khung layout dung chung --

    private static String footerText() {
        return "FaSearch — Tìm mọi outfit bằng AI.\nEmail tự động, vui lòng không trả lời.";
    }

    private static String p() {
        return "margin:0 0 16px 0;font-family:" + FONT + ";font-size:15px;line-height:1.6;color:" + INK + ";";
    }

    /** Dong thong tin phu (hieu luc link). */
    private static String metaLine(String inner) {
        return "<p style=\"margin:0 0 16px 0;font-family:" + FONT + ";font-size:14px;line-height:1.6;color:" + INK_SOFT + ";\">"
                + inner + "</p>";
    }

    /** Hop luu y bao mat (nen indigo-tinted --st-info-bg, vien --st-line). */
    private static String securityBox(String inner) {
        return "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\">"
                + "<tr><td class=\"fs-note\" style=\"background:" + NOTE_BG + ";border:1px solid " + LINE + ";border-radius:" + RADIUS
                + ";padding:12px 16px;font-family:" + FONT + ";font-size:13.5px;line-height:1.6;color:" + INK + ";\">"
                + "<strong>Lưu ý bảo mật:</strong> " + inner
                + "</td></tr></table>";
    }

    /**
     * Nut CTA dang bulletproof: o table + link (Gmail/Apple Mail) kem VML
     * cho Outlook desktop. Mau CTA indigo cua nut storefront (--st-brand).
     */
    private static String ctaButton(String link, String label) {
        String url = escapeAttr(link);
        String vml = "<!--[if mso]>"
                + "<v:roundrect xmlns:v=\"urn:schemas-microsoft-com:vml\" href=\"" + url
                + "\" style=\"width:240px;height:48px;\" arcsize=\"21%\" fillcolor=\"" + BRAND + "\" stroke=\"f\">"
                + "<w:anchorlock/>"
                + "<center style=\"color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;\">"
                + escape(label) + "</center>"
                + "</v:roundrect>"
                + "<![endif]-->";
        String htmlButton = "<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" align=\"center\" "
                + "style=\"margin:8px auto 20px auto;\">"
                + "<tr><td align=\"center\" bgcolor=\"" + BRAND
                + "\" style=\"border-radius:10px;background:" + BRAND + ";font-family:" + FONT + ";\">"
                + "<a href=\"" + url + "\" target=\"_blank\" "
                + "style=\"display:inline-block;padding:14px 36px;font-family:" + FONT
                + ";font-size:16px;font-weight:700;line-height:20px;color:#ffffff;"
                + "text-decoration:none;border-radius:10px;\">"
                + escape(label) + "</a>"
                + "</td></tr></table>";
        return "<div style=\"text-align:center;\">" + vml
                + "<!--[if !mso]><!-->" + htmlButton + "<!--<![endif]-->"
                + "</div>";
    }

    /** Hop link du phong dang monospace, tu xuong dong (client chan nut). */
    private static String linkFallbackBox(String link) {
        String url = escapeAttr(link);
        return "<p style=\"margin:0 0 16px 0;font-family:" + FONT + ";font-size:13.5px;line-height:1.6;color:" + INK_SOFT + ";\">"
                + "Nếu nút không hoạt động, sao chép liên kết này vào trình duyệt:</p>"
                + "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\">"
                + "<tr><td class=\"fs-box\" style=\"background:" + SUBTLE + ";border:1px solid " + LINE + ";border-radius:" + RADIUS
                + ";padding:12px 14px;font-family:" + MONO + ";font-size:12.5px;line-height:1.6;color:" + INK
                + ";word-break:break-all;overflow-wrap:anywhere;\">"
                + "<a href=\"" + url + "\" target=\"_blank\" style=\"font-family:" + MONO + ";color:" + BRAND
                + ";text-decoration:underline;word-break:break-all;overflow-wrap:anywhere;\">" + url + "</a>"
                + "</td></tr></table>";
    }

    /**
     * Khung email 600px: preheader an, header logo + wordmark, the trang,
     * tieu de, loi chao, noi dung, footer. Tat ca style inline; <style> chi
     * chua media query (mobile + giu palette sang o dark mode).
     */
    private static String layout(String subject, String preheader, String title, String hello, String bodyHtml,
            String linkForAlt) {
        String altAttr = linkForAlt == null ? "FaSearch" : "FaSearch — " + escapeAttr(title);
        return "<!DOCTYPE html>"
                + "<html lang=\"vi\">"
                + "<head>"
                + "<meta charset=\"utf-8\">"
                + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
                + "<meta name=\"color-scheme\" content=\"light\">"
                + "<meta name=\"supported-color-schemes\" content=\"light\">"
                + "<title>" + escape(subject) + "</title>"
                + "<style>"
                + "@media only screen and (max-width:620px){"
                + ".fs-wrap{width:100% !important;}"
                + ".fs-card{width:100% !important;border-radius:0 !important;border-left:none !important;border-right:none !important;}"
                + ".fs-pad{padding-left:20px !important;padding-right:20px !important;}"
                + ".fs-cta a{display:block !important;}"
                + "}"
                + "@media (prefers-color-scheme:dark){"
                + ".fs-body{background:" + CANVAS + " !important;}"
                + ".fs-card{background:" + CARD + " !important;}"
                + ".fs-ink{color:" + INK + " !important;}"
                + ".fs-soft{color:" + INK_SOFT + " !important;}"
                + ".fs-box{background:" + SUBTLE + " !important;}"
                + ".fs-note{background:" + NOTE_BG + " !important;}"
                + "}"
                + "</style>"
                + "</head>"
                + "<body class=\"fs-body\" style=\"margin:0;padding:0;background:" + CANVAS + ";"
                + "-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;\">"
                // Preheader an (hien thi o dong xem truoc, khong hien trong mail).
                + "<div style=\"display:none;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;font-family:" + FONT + ";\" "
                + "aria-hidden=\"true\">" + escape(preheader) + "</div>"
                + "<div style=\"display:none;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;font-family:" + FONT + ";\" "
                + "aria-hidden=\"true\">&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>"
                + "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" "
                + "style=\"background:" + CANVAS + ";\">"
                + "<tr><td align=\"center\" style=\"padding:28px 12px;font-family:" + FONT + ";\">"
                + "<table role=\"presentation\" width=\"600\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" "
                + "class=\"fs-wrap\" style=\"width:600px;max-width:600px;\">"
                // Header: mark corner-bracket + lime + wordmark FaSearch.
                + "<tr><td align=\"left\" style=\"padding:0 4px 16px 4px;font-family:" + FONT + ";\">"
                + "<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\"><tr>"
                + "<td valign=\"middle\" style=\"padding-right:12px;font-family:" + FONT + ";\">"
                + logoMark(altAttr)
                + "</td>"
                + "<td valign=\"middle\" style=\"padding-left:10px;font-family:" + FONT + ";font-size:22px;"
                + "font-weight:700;letter-spacing:-0.5px;color:" + INK + ";\">FaSearch</td>"
                + "</tr></table>"
                + "</td></tr>"
                // The noi dung.
                + "<tr><td class=\"fs-card\" "
                + "style=\"background:" + CARD + ";border:1px solid " + LINE + ";border-radius:" + RADIUS + ";font-family:" + FONT + ";\">"
                + "<div class=\"fs-pad\" style=\"padding:28px 32px 8px 32px;\">"
                + "<h1 class=\"fs-ink\" style=\"margin:0 0 12px 0;font-family:" + FONT + ";font-size:20px;"
                + "line-height:1.4;font-weight:700;color:" + INK + ";\">" + escape(title) + "</h1>"
                + "<p class=\"fs-ink\" style=\"" + p() + "\">" + hello + "</p>"
                + bodyHtml
                + "<div style=\"height:16px;line-height:16px;\">&nbsp;</div>"
                + "</div>"
                + "</td></tr>"
                // Footer: ten, tagline AI fashion search, ghi chu auto-mail.
                + "<tr><td align=\"center\" class=\"fs-soft\" "
                + "style=\"padding:20px 16px 0 16px;font-family:" + FONT + ";font-size:12.5px;line-height:1.7;"
                + "color:" + INK_SOFT + ";\">"
                + "<p style=\"margin:0 0 4px 0;font-family:" + FONT + ";\"><strong>FaSearch</strong> — Tìm mọi outfit bằng AI.</p>"
                + "<p style=\"margin:0;font-family:" + FONT + ";\">Email tự động, vui lòng không trả lời.</p>"
                + "</td></tr>"
                + "</table>"
                + "</td></tr></table>"
                + "</body></html>";
    }

    /**
     * Mark FaSearch bang table/CSS-only (khong anh, khong SVG):
     * khung corner-bracket (goc TL + BR, vien INK nhu currentColor o header)
     * boc khoi lime bo goc (--st-citron, vien SHIRT_EDGE),
     * phong theo FaSearchMark trong customer-header.tsx.
     */
    private static String logoMark(String altAttr) {
        String corner = "width:12px;height:12px;font-size:0;line-height:12px;font-family:" + FONT + ";";
        String gap = "width:12px;font-size:0;line-height:0;font-family:" + FONT + ";";
        String mid = "width:16px;font-size:0;line-height:0;font-family:" + FONT + ";";
        return "<table role=\"presentation\" width=\"40\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" "
                + "role=\"img\" aria-label=\"" + altAttr + "\" style=\"width:40px;\">"
                + "<tr>"
                + "<td width=\"12\" height=\"12\" style=\"" + corner
                + "border-top:2px solid " + INK + ";border-left:2px solid " + INK + ";\">&nbsp;</td>"
                + "<td width=\"16\" style=\"" + mid + "\">&nbsp;</td>"
                + "<td width=\"12\" height=\"12\" style=\"" + gap + "height:12px;\">&nbsp;</td>"
                + "</tr>"
                + "<tr>"
                + "<td width=\"12\" style=\"" + gap + "\">&nbsp;</td>"
                + "<td width=\"16\" height=\"16\" align=\"center\" valign=\"middle\" style=\"" + mid
                + "height:16px;background:" + LIME + ";border:1px solid " + SHIRT_EDGE + ";border-radius:4px;\">&nbsp;</td>"
                + "<td width=\"12\" style=\"" + gap + "\">&nbsp;</td>"
                + "</tr>"
                + "<tr>"
                + "<td width=\"12\" height=\"12\" style=\"" + gap + "height:12px;\">&nbsp;</td>"
                + "<td width=\"16\" style=\"" + mid + "\">&nbsp;</td>"
                + "<td width=\"12\" height=\"12\" style=\"" + corner
                + "border-bottom:2px solid " + INK + ";border-right:2px solid " + INK + ";\">&nbsp;</td>"
                + "</tr>"
                + "</table>";
    }

    private static String safe(String name) {
        if (name == null || name.isBlank()) {
            return "bạn";
        }
        return escape(name.trim());
    }

    private static String escape(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String escapeAttr(String value) {
        return escape(value).replace("\"", "&quot;");
    }
}
