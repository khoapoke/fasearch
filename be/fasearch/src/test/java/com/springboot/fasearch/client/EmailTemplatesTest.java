package com.springboot.fasearch.client;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.springboot.fasearch.client.EmailTemplates.MailMessage;

class EmailTemplatesTest {

    @Test
    void verifyEmailContainsLinkAndBothFormats() {
        MailMessage mail = EmailTemplates.verifyEmail("Nguyen Van A", "http://127.0.0.1:3202/xac-thuc-email?token=abc");

        assertThat(mail.subject()).contains("Xác thực");
        assertThat(mail.textContent()).contains("http://127.0.0.1:3202/xac-thuc-email?token=abc");
        assertThat(mail.htmlContent()).contains("http://127.0.0.1:3202/xac-thuc-email?token=abc");
        assertThat(mail.textContent()).doesNotContain("<p>");
        assertThat(mail.htmlContent()).contains("<html");
    }

    @Test
    void resetPasswordMentionsSingleUseWindow() {
        MailMessage mail = EmailTemplates.resetPassword("A", "http://127.0.0.1:3202/dat-lai-mat-khau?token=xyz");

        assertThat(mail.subject()).contains("Đặt lại mật khẩu");
        assertThat(mail.textContent()).contains("30 phút").contains("chỉ dùng được một lần");
        assertThat(mail.htmlContent()).contains("http://127.0.0.1:3202/dat-lai-mat-khau?token=xyz");
    }

    @Test
    void passwordChangedWarnsAboutOldSessions() {
        MailMessage mail = EmailTemplates.passwordChanged("A");

        assertThat(mail.subject()).contains("thay đổi");
        assertThat(mail.textContent()).contains("hết hiệu lực");
        assertThat(mail.htmlContent()).contains("Quên mật khẩu");
    }

    @Test
    void blankNameFallsBackToGenericGreeting() {
        MailMessage mail = EmailTemplates.verifyEmail("  ", "http://x/y");

        assertThat(mail.textContent()).startsWith("Chào bạn,");
        assertThat(mail.htmlContent()).doesNotContain("<script");
    }

    @Test
    void userNameIsEscapedInHtml() {
        MailMessage mail = EmailTemplates.resetPassword("<b>Alice</b>\"x", "http://x/y?token=1");

        assertThat(mail.htmlContent()).contains("&lt;b&gt;Alice&lt;/b&gt;");
        assertThat(mail.htmlContent()).doesNotContain("<b>Alice</b>");
        assertThat(mail.textContent()).contains("&lt;b&gt;Alice&lt;/b&gt;");
    }

    @Test
    void allTemplatesShareBrandedLayout() {
        MailMessage verify = EmailTemplates.verifyEmail("A", "http://x/verify?token=1");
        MailMessage reset = EmailTemplates.resetPassword("A", "http://x/reset?token=2");
        MailMessage changed = EmailTemplates.passwordChanged("A");

        for (MailMessage mail : new MailMessage[] { verify, reset, changed }) {
            String html = mail.htmlContent();
            assertThat(html).contains("width=\"600\"");
            assertThat(html).contains("background:#d6ef72"); // khoi lime = --st-citron
            assertThat(html).contains("border-top:2px solid #1b1c1a"); // goc TL corner-bracket
            assertThat(html).contains("border-bottom:2px solid #1b1c1a"); // goc BR corner-bracket
            assertThat(html).contains("aria-label"); // mark co alt text
            assertThat(html).doesNotContain("#aa3000");
            assertThat(html).doesNotContain("#ff4d00");
            assertThat(html).doesNotContain("#fff1ea");
            assertThat(html).doesNotContain("fbf7f4");
            assertThat(html).contains("FaSearch");
            assertThat(html).contains("Email tự động, vui lòng không trả lời.");
            assertThat(html).contains("mso-hide:all"); // preheader an
            assertThat(html).contains("color-scheme"); // uu tien light mode
            assertThat(html).contains("<html lang=\"vi\"");
            assertThat(mail.textContent()).contains("FaSearch");
        }
        // Chi template co link moi co nut CTA indigo (--st-brand, nut storefront).
        assertThat(verify.htmlContent()).contains("#3730d8");
        assertThat(reset.htmlContent()).contains("#3730d8");
        assertThat(changed.htmlContent()).doesNotContain("#3730d8");
    }

    @Test
    void linkTemplatesHaveFallbackBoxAndCta() {
        MailMessage mail = EmailTemplates.verifyEmail("A", "http://x/y?token=1");

        assertThat(mail.htmlContent()).contains("monospace");
        assertThat(mail.htmlContent()).contains("break-all");
        assertThat(mail.htmlContent()).contains("roundrect"); // VML cho Outlook
    }

    @Test
    void everyTextElementCarriesInlineSansStack() {
        MailMessage[] mails = new MailMessage[] {
                EmailTemplates.verifyEmail("A", "http://x/verify?token=1"),
                EmailTemplates.resetPassword("A", "http://x/reset?token=2"),
                EmailTemplates.passwordChanged("A") };
        for (MailMessage mail : mails) {
            String html = mail.htmlContent();
            assertThat(html).doesNotContain("Times");
            assertThat(html).doesNotContain("Georgia");
            java.util.regex.Matcher m = java.util.regex.Pattern
                    .compile("<(p|td|a|h1|span)\\b[^>]*>")
                    .matcher(html);
            while (m.find()) {
                assertThat(m.group()).as("thieu font inline: %s", m.group()).contains("font-family");
            }
        }
    }

    @Test
    void passwordChangedHasNoLink() {
        MailMessage mail = EmailTemplates.passwordChanged("A");

        assertThat(mail.textContent()).doesNotContain("http");
        assertThat(mail.htmlContent()).doesNotContain("roundrect");
    }
}
