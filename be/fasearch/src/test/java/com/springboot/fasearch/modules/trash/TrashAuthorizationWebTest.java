package com.springboot.fasearch.modules.trash;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.springboot.fasearch.config.SecurityConfig;
import com.springboot.fasearch.exception.GlobalExceptionHandler;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.trash.controller.TrashController;
import com.springboot.fasearch.modules.trash.service.interfaces.TrashService;
import com.springboot.fasearch.security.CustomAccessDeniedHandler;
import com.springboot.fasearch.security.JwtAuthenticationEntryPoint;
import com.springboot.fasearch.security.JwtAuthenticationFilter;
import com.springboot.fasearch.security.JwtProvider;
import com.springboot.fasearch.security.RolePermissionResolver;
import com.springboot.fasearch.security.TestAuthorities;

/**
 * Thùng rác chỉ dành cho người đăng nhập nội bộ: ADMIN và STAFF xem/khôi phục được,
 * CUSTOMER bị 403, khách chưa đăng nhập bị 401 — không lộ dữ liệu nào.
 */
@WebMvcTest(controllers = TrashController.class)
@Import({ SecurityConfig.class, JwtAuthenticationFilter.class, JwtAuthenticationEntryPoint.class,
        CustomAccessDeniedHandler.class, GlobalExceptionHandler.class })
class TrashAuthorizationWebTest {

    @Autowired private MockMvc mockMvc;

    @MockitoBean private JwtProvider jwtProvider;
    @MockitoBean private AccountRepository accountRepository;
    @MockitoBean private RolePermissionResolver rolePermissionResolver;
    @MockitoBean private TrashService trashService;

    private int status(String method, String url, String role) throws Exception {
        var request = request(HttpMethod.valueOf(method), url).contentType(MediaType.APPLICATION_JSON);
        if (role != null) {
            request = request.with(user("tester").authorities(TestAuthorities.forRole(role)));
        }
        return mockMvc.perform(request).andReturn().getResponse().getStatus();
    }

    @ParameterizedTest(name = "{0} {1}")
    @CsvSource(delimiter = '|', value = {
            "GET|/api/v1/admin/trash/products",
            "GET|/api/v1/admin/trash/variants",
            "GET|/api/v1/admin/trash/categories",
            "GET|/api/v1/admin/trash/customers",
            "GET|/api/v1/admin/trash/employees",
            "POST|/api/v1/admin/trash/products/1/restore",
            "POST|/api/v1/admin/trash/variants/1/restore",
            "POST|/api/v1/admin/trash/categories/1/restore",
            "POST|/api/v1/admin/trash/customers/1/restore",
            "POST|/api/v1/admin/trash/employees/1/restore"
    })
    void staffAndAdminCanUseTheTrash(String method, String url) throws Exception {
        assertNotEquals(403, status(method, url, "ADMIN"));
        assertNotEquals(403, status(method, url, "STAFF"));
        assertNotEquals(401, status(method, url, "STAFF"));
    }

    /** Tab tài khoản là việc quản trị tài khoản: STAFF (Quản lý) bị từ chối, không chỉ ẩn ở giao diện. */
    @ParameterizedTest(name = "{0} {1}")
    @CsvSource(delimiter = '|', value = {
            "GET|/api/v1/admin/trash/accounts",
            "POST|/api/v1/admin/trash/accounts/1/restore"
    })
    void accountTabIsAdminOnly(String method, String url) throws Exception {
        assertNotEquals(403, status(method, url, "ADMIN"));
        assertEquals(403, status(method, url, "STAFF"), "STAFF must be refused on " + url);
        assertEquals(403, status(method, url, "CUSTOMER"), "CUSTOMER must be denied on " + url);
        assertEquals(401, status(method, url, null), "anonymous must be refused on " + url);
    }

    @ParameterizedTest(name = "{0} {1}")
    @CsvSource(delimiter = '|', value = {
            "GET|/api/v1/admin/trash/products",
            "GET|/api/v1/admin/trash/variants",
            "GET|/api/v1/admin/trash/categories",
            "GET|/api/v1/admin/trash/customers",
            "GET|/api/v1/admin/trash/employees",
            "POST|/api/v1/admin/trash/products/1/restore",
            "POST|/api/v1/admin/trash/customers/1/restore",
            "POST|/api/v1/admin/trash/employees/1/restore"
    })
    void customerIsDeniedAndAnonymousIsUnauthenticated(String method, String url) throws Exception {
        assertEquals(403, status(method, url, "CUSTOMER"), "CUSTOMER must be denied on " + url);
        assertEquals(401, status(method, url, null), "anonymous must be refused on " + url);
    }

    /** Deleting business data is STAFF work; accounts stay ADMIN-only (tested in the auth matrix). */
    @Test
    void deleteEndpointsStayStaffAndAdminOnly() throws Exception {
        assertEquals(401, status("DELETE", "/api/v1/products/1", null));
        assertEquals(403, status("DELETE", "/api/v1/products/1", "CUSTOMER"));
        assertEquals(401, status("DELETE", "/api/v1/categories/1", null));
        assertEquals(403, status("DELETE", "/api/v1/categories/1", "CUSTOMER"));
        assertEquals(401, status("DELETE", "/api/v1/users/customers/1", null));
    }
}
