package com.springboot.fasearch.modules.csv;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import java.nio.charset.StandardCharsets;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.springboot.fasearch.config.SecurityConfig;
import com.springboot.fasearch.exception.GlobalExceptionHandler;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.csv.controller.CsvProductImportController;
import com.springboot.fasearch.modules.csv.dto.response.CsvImportDraftRes;
import com.springboot.fasearch.modules.csv.dto.response.CsvImportRes;
import com.springboot.fasearch.modules.csv.service.interfaces.CsvProductImportService;
import com.springboot.fasearch.security.CustomAccessDeniedHandler;
import com.springboot.fasearch.security.JwtAuthenticationEntryPoint;
import com.springboot.fasearch.security.JwtAuthenticationFilter;
import com.springboot.fasearch.security.JwtProvider;
import com.springboot.fasearch.security.RolePermissionResolver;
import com.springboot.fasearch.security.TestAuthorities;

/** ADMIN and STAFF may use the import; CUSTOMER and anonymous never receive the CSV template. */
@WebMvcTest(controllers = CsvProductImportController.class)
@Import({ SecurityConfig.class, JwtAuthenticationFilter.class, JwtAuthenticationEntryPoint.class,
        CustomAccessDeniedHandler.class, GlobalExceptionHandler.class })
class CsvProductImportApiWebTest {

    private static final String IMPORT_URL = "/api/v1/admin/csv/products/import";
    private static final String TEMPLATE_URL = "/api/v1/admin/csv/products/template";
    private static final MockMultipartFile FILE = new MockMultipartFile("file", "san-pham.csv",
            "text/csv", "Tên sản phẩm\r\nÁo thơm\r\n".getBytes(StandardCharsets.UTF_8));

    @Autowired private MockMvc mockMvc;

    @MockitoBean private JwtProvider jwtProvider;
    @MockitoBean private AccountRepository accountRepository;
    @MockitoBean private RolePermissionResolver rolePermissionResolver;
    @MockitoBean private CsvProductImportService csvProductImportService;

    @BeforeEach
    void stubService() {
        CsvImportRes dry = new CsvImportRes("a".repeat(64), 3, 2, 1, 1, false,
                List.of(new CsvImportRowError(4, "Giá bán", "INVALID_NUMBER",
                        "Giá bán phải là số không âm.")), List.of());
        CsvImportRes applied = new CsvImportRes("a".repeat(64), 3, 3, 1, 0, false, List.of(),
                List.of(new CsvImportDraftRes(77L, "Áo thơm", 3)));
        when(csvProductImportService.dryRun(any())).thenReturn(dry);
        when(csvProductImportService.apply(any(), any())).thenReturn(applied);
        when(csvProductImportService.template()).thenReturn(new CsvProductImportService.CsvTemplate(
                "mau-nhap-san-pham.csv",
                ("\uFEFF" + String.join(",", CsvProductImportValidator.HEADERS) + "\r\n")
                        .getBytes(StandardCharsets.UTF_8)));
    }

    private int status(String url, String role, boolean post) throws Exception {
        var builder = post ? multipart(url).file(FILE).param("dryRun", "true") : get(url);
        if (role != null) {
            builder = builder.with(user("tester").authorities(TestAuthorities.forRole(role)));
        }
        return mockMvc.perform(builder).andReturn().getResponse().getStatus();
    }

    @Test
    void adminAndStaffReachTheImportAndTemplate() throws Exception {
        for (String role : new String[] {"ADMIN", "STAFF"}) {
            assertEquals(200, status(IMPORT_URL, role, true), role + " import");
            assertEquals(200, status(TEMPLATE_URL, role, false), role + " template");
        }
    }

    @Test
    void customerIsDeniedAndAnonymousIsUnauthenticated() throws Exception {
        assertEquals(403, status(IMPORT_URL, "CUSTOMER", true));
        assertEquals(401, status(IMPORT_URL, null, true));
        assertEquals(403, status(TEMPLATE_URL, "CUSTOMER", false));
        assertEquals(401, status(TEMPLATE_URL, null, false));
    }

    @Test
    void dryRunReturnsCountsAndEveryRowError() throws Exception {
        MvcResult result = mockMvc.perform(multipart(IMPORT_URL).file(FILE).param("dryRun", "true")
                        .with(user("tester").authorities(TestAuthorities.forRole("STAFF"))))
                .andReturn();

        assertEquals(200, result.getResponse().getStatus());
        String json = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertTrue(json.contains("\"checksum\":\"aaaaaaaa"));
        assertTrue(json.contains("\"totalRows\":3"));
        assertTrue(json.contains("\"validRows\":2"));
        assertTrue(json.contains("\"errorCount\":1"));
        assertTrue(json.contains("\"row\":4"));
        assertTrue(json.contains("\"column\":\"Giá bán\""));
        assertTrue(json.contains("Giá bán phải là số không âm."));
        verify(csvProductImportService).dryRun(any());
    }

    @Test
    void applyForwardsTheDryRunChecksumAndReturnsDraftLinks() throws Exception {
        String checksum = "b".repeat(64);
        MvcResult result = mockMvc.perform(multipart(IMPORT_URL).file(FILE)
                        .param("checksum", checksum)
                        .with(user("tester").authorities(TestAuthorities.forRole("ADMIN"))))
                .andReturn();

        assertEquals(200, result.getResponse().getStatus());
        String json = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertTrue(json.contains("\"draftId\":77"));
        assertTrue(json.contains("\"skuCount\":3"));
        verify(csvProductImportService).apply(any(), eq(checksum));
    }

    @Test
    void templateIsACsvDownloadWithTheVietnameseHeaderAndBom() throws Exception {
        MvcResult result = mockMvc.perform(get(TEMPLATE_URL).with(user("tester").authorities(TestAuthorities.forRole("STAFF"))))
                .andReturn();

        assertEquals(200, result.getResponse().getStatus());
        assertEquals("text/csv;charset=UTF-8",
                result.getResponse().getContentType().replace(" ", ""));
        assertEquals("attachment; filename=\"mau-nhap-san-pham.csv\"",
                result.getResponse().getHeader("Content-Disposition"));
        assertEquals("nosniff", result.getResponse().getHeader("X-Content-Type-Options"));
        byte[] body = result.getResponse().getContentAsByteArray();
        assertEquals((byte) 0xEF, body[0]);
        String text = new String(body, StandardCharsets.UTF_8);
        for (String header : CsvProductImportValidator.HEADERS) {
            assertTrue(text.contains(header), header);
        }
    }
}
