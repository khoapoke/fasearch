package com.springboot.fasearch.modules.csv;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.springboot.fasearch.config.SecurityConfig;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.exception.GlobalExceptionHandler;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.csv.controller.CsvExportController;
import com.springboot.fasearch.modules.csv.service.interfaces.CsvExportService;
import com.springboot.fasearch.security.CustomAccessDeniedHandler;
import com.springboot.fasearch.security.JwtAuthenticationEntryPoint;
import com.springboot.fasearch.security.JwtAuthenticationFilter;
import com.springboot.fasearch.security.JwtProvider;
import com.springboot.fasearch.security.RolePermissionResolver;
import com.springboot.fasearch.security.TestAuthorities;

/** ADMIN and STAFF may export; CUSTOMER and anonymous never receive data. */
@WebMvcTest(controllers = CsvExportController.class)
@Import({ SecurityConfig.class, JwtAuthenticationFilter.class, JwtAuthenticationEntryPoint.class,
        CustomAccessDeniedHandler.class, GlobalExceptionHandler.class })
class CsvExportApiWebTest {

    private static final String[] URLS = {
            "/api/v1/admin/csv/products",
            "/api/v1/admin/csv/stock",
            "/api/v1/admin/csv/orders",
            "/api/v1/admin/csv/customers"
    };

    @Autowired private MockMvc mockMvc;

    @MockitoBean private JwtProvider jwtProvider;
    @MockitoBean private AccountRepository accountRepository;
    @MockitoBean private RolePermissionResolver rolePermissionResolver;
    @MockitoBean private CsvExportService csvExportService;

    @BeforeEach
    void stubEmptyExports() {
        CsvExportPlan empty = new CsvExportPlan("x-2026-11-07.csv", 0,
                out -> out.write("A\r\n".getBytes(StandardCharsets.UTF_8)));
        when(csvExportService.prepareProducts(any(), any(), any(), any(), any(), any(), any())).thenReturn(empty);
        when(csvExportService.prepareStock(any(), any(), any())).thenReturn(empty);
        when(csvExportService.prepareOrders(any(), any(), any(), any(), any(), any())).thenReturn(empty);
        when(csvExportService.prepareCustomers(any(), any(), any())).thenReturn(empty);
    }

    private int status(String url, String role) throws Exception {
        var builder = request(HttpMethod.GET, url);
        if (role != null) {
            builder = builder.with(user("tester").authorities(TestAuthorities.forRole(role)));
        }
        return mockMvc.perform(builder).andReturn().getResponse().getStatus();
    }

    @Test
    void staffAndAdminReachEveryExport() throws Exception {
        for (String url : URLS) {
            for (String role : new String[] {"STAFF", "ADMIN"}) {
                int status = mockMvc.perform(get(url).with(user("tester").authorities(TestAuthorities.forRole(role))))
                        .andReturn().getResponse().getStatus();
                assertEquals(200, status, role + " " + url);
            }
        }
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource(value = {
            "/api/v1/admin/csv/products",
            "/api/v1/admin/csv/stock",
            "/api/v1/admin/csv/orders",
            "/api/v1/admin/csv/customers"
    })
    void customerIsDeniedAndAnonymousIsUnauthenticated(String url) throws Exception {
        assertEquals(403, status(url, "CUSTOMER"), "CUSTOMER must be denied on " + url);
        assertEquals(401, status(url, null), "anonymous must be refused on " + url);
    }

    @Test
    void stockExportStreamsCsvWithBomAndFilename() throws Exception {
        when(csvExportService.prepareStock(any(), any(), any())).thenReturn(new CsvExportPlan(
                "ton-kho-2026-11-07.csv", 1, new CsvContent()));

        MvcResult result = mockMvc.perform(get("/api/v1/admin/csv/stock").with(user("tester").authorities(TestAuthorities.forRole("STAFF"))))
                .andReturn();

        assertEquals(200, result.getResponse().getStatus());
        assertEquals("text/csv;charset=UTF-8", result.getResponse().getContentType().replace(" ", ""));
        assertEquals("attachment; filename=\"ton-kho-2026-11-07.csv\"",
                result.getResponse().getHeader("Content-Disposition"));
        assertEquals("nosniff", result.getResponse().getHeader("X-Content-Type-Options"));
        assertEquals("1", result.getResponse().getHeader("X-Export-Rows"));
        byte[] body = result.getResponse().getContentAsByteArray();
        assertEquals((byte) 0xEF, body[0]);
        assertTrue(new String(body, StandardCharsets.UTF_8).contains("Áo sơ mi"));
    }

    @Test
    void listFiltersAreForwardedToTheExport() throws Exception {
        mockMvc.perform(get("/api/v1/admin/csv/orders")
                .param("status", "SHIPPING")
                .param("keyword", "DH-1")
                .param("startDate", "2026-11-01")
                .with(user("tester").authorities(TestAuthorities.forRole("STAFF"))));
        verify(csvExportService).prepareOrders(eq(com.springboot.fasearch.common.enums.OrderStatus.SHIPPING),
                isNull(), isNull(), eq(LocalDate.of(2026, 11, 1)), isNull(), eq("DH-1"));

        mockMvc.perform(get("/api/v1/admin/csv/products")
                .param("keyword", "áo")
                .param("categoryId", "3")
                .param("status", "ACTIVE")
                .with(user("tester").authorities(TestAuthorities.forRole("STAFF"))));
        verify(csvExportService).prepareProducts(eq("áo"), eq(3L), isNull(), isNull(),
                eq(com.springboot.fasearch.common.enums.ProductStatus.ACTIVE), isNull(), isNull());
    }

    @Test
    void capRefusalIsAClearApiErrorNotATruncatedFile() throws Exception {
        when(csvExportService.prepareCustomers(any(), any(), any())).thenThrow(new AppException(
                ErrorCode.INVALID_REQUEST,
                "Tập dữ liệu có 50001 dòng, vượt giới hạn xuất 50000 dòng. Hãy thu hẹp bộ lọc rồi thử lại."));

        MvcResult result = mockMvc.perform(get("/api/v1/admin/csv/customers").with(user("tester").authorities(TestAuthorities.forRole("ADMIN"))))
                .andReturn();

        assertEquals(400, result.getResponse().getStatus());
        assertTrue(result.getResponse().getContentAsString(StandardCharsets.UTF_8)
                .contains("vượt giới hạn xuất 50000 dòng"));
        assertTrue(result.getResponse().getContentType().contains("application/json"));
    }

    private static final class CsvContent implements CsvExportPlan.Content {
        @Override
        public void writeTo(OutputStream out) throws java.io.IOException {
            out.write(new byte[] {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF});
            out.write("Mã SKU,Tên sản phẩm\r\n1,Áo sơ mi\r\n".getBytes(StandardCharsets.UTF_8));
        }
    }
}
