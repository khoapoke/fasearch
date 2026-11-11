package com.springboot.fasearch.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.springboot.fasearch.config.SecurityConfig;
import com.springboot.fasearch.exception.GlobalExceptionHandler;
import com.springboot.fasearch.modules.analytics.controller.AdminAnalyticsController;
import com.springboot.fasearch.modules.analytics.service.interfaces.AnalyticsService;
import com.springboot.fasearch.modules.auth.controller.AccountController;
import com.springboot.fasearch.modules.auth.controller.RolePermissionController;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.auth.service.interfaces.AuthService;
import com.springboot.fasearch.modules.auth.service.interfaces.RolePermissionService;
import com.springboot.fasearch.modules.inventory.controller.InventoryController;
import com.springboot.fasearch.modules.inventory.service.interfaces.InventoryService;
import com.springboot.fasearch.modules.khuyenmai.controller.AdminCampaignController;
import com.springboot.fasearch.modules.khuyenmai.service.interfaces.KhuyenMaiService;
import com.springboot.fasearch.modules.loyalty.controller.AdminLoyaltyController;
import com.springboot.fasearch.modules.loyalty.controller.LoyaltyController;
import com.springboot.fasearch.modules.loyalty.service.interfaces.LoyaltyService;
import com.springboot.fasearch.modules.product.controller.CategoryController;
import com.springboot.fasearch.modules.product.controller.ProductController;
import com.springboot.fasearch.modules.product.controller.ProductImageController;
import com.springboot.fasearch.modules.product.controller.ProductVariantController;
import com.springboot.fasearch.modules.product.service.interfaces.CategoryService;
import com.springboot.fasearch.modules.product.service.interfaces.ProductImageService;
import com.springboot.fasearch.modules.product.service.interfaces.ProductService;
import com.springboot.fasearch.modules.product.service.interfaces.ProductVariantService;
import com.springboot.fasearch.modules.publish.controller.AdminProductPublishController;
import com.springboot.fasearch.modules.publish.service.interfaces.PublishService;
import com.springboot.fasearch.modules.user.controller.EmployeeController;
import com.springboot.fasearch.modules.user.controller.UserController;
import com.springboot.fasearch.modules.user.service.interfaces.EmployeeService;
import com.springboot.fasearch.modules.user.service.interfaces.UserService;

/**
 * Role matrix (URL gates + method security wiring) for the Quản lý (STAFF) rollout. STAFF here carries the
 * default permission set seeded by V27 ({@link TestAuthorities#staffDefaults()}); the per-permission matrix is
 * {@link PermissionMatrixTest}. Exercised through the real {@link SecurityConfig}
 * filter chain AND method security (no database): ADMIN = Quản trị viên hệ thống, STAFF = Quản lý,
 * CUSTOMER = Khách hàng. "Allowed" means the request was not rejected by authorization (any non-403
 * status, e.g. 200/400 from mocked services or validation); "denied" must be exactly 403.
 * See live/be/AUTHZ-MATRIX.md in the task packet.
 */
@WebMvcTest(controllers = {
        AccountController.class, CategoryController.class, ProductController.class, ProductVariantController.class,
        ProductImageController.class, InventoryController.class, AdminCampaignController.class,
        LoyaltyController.class, AdminLoyaltyController.class, AdminAnalyticsController.class,
        AdminProductPublishController.class, EmployeeController.class, UserController.class,
        RolePermissionController.class })
@Import({ SecurityConfig.class, JwtAuthenticationFilter.class, JwtAuthenticationEntryPoint.class,
        CustomAccessDeniedHandler.class, GlobalExceptionHandler.class })
class RoleAuthorizationWebTest {

    @Autowired private MockMvc mockMvc;

    @MockitoBean private JwtProvider jwtProvider;
    @MockitoBean private AccountRepository accountRepository;
    @MockitoBean private RolePermissionResolver rolePermissionResolver;
    @MockitoBean private AuthService authService;
    @MockitoBean private CategoryService categoryService;
    @MockitoBean private ProductService productService;
    @MockitoBean private ProductVariantService productVariantService;
    @MockitoBean private ProductImageService productImageService;
    @MockitoBean private InventoryService inventoryService;
    @MockitoBean private KhuyenMaiService khuyenMaiService;
    @MockitoBean private LoyaltyService loyaltyService;
    @MockitoBean private AnalyticsService analyticsService;
    @MockitoBean private PublishService publishService;
    @MockitoBean private EmployeeService employeeService;
    @MockitoBean private UserService userService;
    @MockitoBean private RolePermissionService rolePermissionService;

    private int status(String method, String url, String role) throws Exception {
        return mockMvc.perform(request(HttpMethod.valueOf(method), url)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"customerId\":1}") // valid for the one @Valid body guarded only at method level
                        .with(user("tester").authorities(TestAuthorities.forRole(role))))
                .andReturn().getResponse().getStatus();
    }

    private void assertAllowed(String method, String url, String role) throws Exception {
        assertNotEquals(403, status(method, url, role), role + " must be allowed on " + method + " " + url);
        assertNotEquals(401, status(method, url, role), role + " must be authenticated on " + method + " " + url);
    }

    private void assertDenied(String method, String url, String role) throws Exception {
        assertEquals(403, status(method, url, role), role + " must be denied on " + method + " " + url);
    }

    /** Business endpoints that Quản lý (STAFF) can now use, one or more per module. ADMIN unchanged. */
    @ParameterizedTest(name = "{0} {1}")
    @CsvSource(delimiter = '|', value = {
            "POST|/api/v1/categories",
            "PUT|/api/v1/categories/1",
            "DELETE|/api/v1/categories/1",
            "POST|/api/v1/products",
            "PATCH|/api/v1/products/1",
            "DELETE|/api/v1/products/1",
            "POST|/api/v1/products/1/variants",
            "PUT|/api/v1/products/variants/1",
            "POST|/api/v1/products/1/image",
            "POST|/api/v1/admin/products/drafts",
            "GET|/api/v1/admin/products/drafts",
            "POST|/api/v1/admin/products/1/ai-sync/retry",
            "POST|/api/v1/inventory/import-receipts",
            "POST|/api/v1/inventory/export-receipts",
            "POST|/api/v1/inventory/stocktakes",
            "GET|/api/v1/inventory/stock-summary",
            "POST|/api/v1/khuyen-mai",
            "PUT|/api/v1/khuyen-mai/1",
            "POST|/api/v1/khuyen-mai/1/codes",
            "GET|/api/v1/khuyen-mai",
            "GET|/api/v1/analytics/revenue?startDate=2026-01-01&endDate=2026-01-02",
            "GET|/api/v1/analytics/top-products?startDate=2026-01-01&endDate=2026-01-02",
            "GET|/api/v1/analytics/inventory-movement?year=2026&month=1",
            "GET|/api/v1/thanh-vien/chinh-sach",
            "GET|/api/v1/thanh-vien/chinh-sach/hang",
            "GET|/api/v1/users/customers",
            "DELETE|/api/v1/users/customers/1",
            "GET|/api/v1/users/employees",
            "GET|/api/v1/users/employees/1"
    })
    void adminAndStaffAllowedCustomerDenied(String method, String url) throws Exception {
        assertAllowed(method, url, "ADMIN");
        assertAllowed(method, url, "STAFF");
        // CUSTOMER is blocked either by the URL matcher or @PreAuthorize (the latter only after argument
        // binding, so endpoints reachable at URL level get a request that binds cleanly).
        if (!url.startsWith("/api/v1/users/")) {
            assertDenied(method, url, "CUSTOMER");
        }
    }

    /** Login accounts and role assignment stay ADMIN-only: STAFF (Quản lý) gets 403 on every verb. */
    @ParameterizedTest(name = "{0} {1}")
    @CsvSource(delimiter = '|', value = {
            "GET|/api/v1/auth/accounts",
            "POST|/api/v1/auth/accounts",
            "PATCH|/api/v1/auth/accounts/1",
            "PUT|/api/v1/auth/accounts/1",
            "DELETE|/api/v1/auth/accounts/1",
            "POST|/api/v1/quan-tri/thanh-vien/mo-dau",
            "GET|/api/v1/auth/roles/STAFF/permissions",
            "PUT|/api/v1/auth/roles/STAFF/permissions",
            "GET|/api/v1/auth/roles/STAFF/permissions/audit"
    })
    void accountAndRoleAdministrationStaysAdminOnly(String method, String url) throws Exception {
        assertDenied(method, url, "STAFF");
        assertDenied(method, url, "CUSTOMER");
        assertNotEquals(403, status(method, url, "ADMIN"));
    }

    /** Employee/manager profile records are open to STAFF; the account-link/lock guard is in the service. */
    @Test
    void staffCanReachEmployeeProfileEndpoints() throws Exception {
        assertAllowed("POST", "/api/v1/users/employees", "STAFF");
        assertAllowed("PATCH", "/api/v1/users/employees/1", "STAFF");
        assertAllowed("DELETE", "/api/v1/users/employees/1", "STAFF");
        assertDenied("GET", "/api/v1/users/employees", "CUSTOMER");
        assertDenied("DELETE", "/api/v1/users/employees/1", "CUSTOMER");
    }

    /** URL gates added with permissions: customers never reach staff-only prefixes, even before method security. */
    @ParameterizedTest(name = "{0} {1}")
    @CsvSource(delimiter = '|', value = {
            "POST|/api/v1/users/employees",
            "PATCH|/api/v1/users/employees/1",
            "GET|/api/v1/analytics/revenue?startDate=2026-01-01&endDate=2026-01-02",
            "GET|/api/v1/quan-tri/thanh-vien/anything",
            "GET|/api/v1/auth/roles/STAFF/permissions"
    })
    void customerStoppedAtUrlLevel(String method, String url) throws Exception {
        assertDenied(method, url, "CUSTOMER");
    }

    /** A STAFF token with the permission switched off is refused (403), with it switched on allowed. */
    @Test
    void staffPermissionToggleIsEnforcedOverHttp() throws Exception {
        int off = mockMvc.perform(request(HttpMethod.GET, "/api/v1/inventory/stock-summary")
                        .with(user("tester").authorities(TestAuthorities.staffAllExcept(Permission.INVENTORY_VIEW))))
                .andReturn().getResponse().getStatus();
        int on = mockMvc.perform(request(HttpMethod.GET, "/api/v1/inventory/stock-summary")
                        .with(user("tester").authorities(TestAuthorities.staff(java.util.Set.of(Permission.INVENTORY_VIEW)))))
                .andReturn().getResponse().getStatus();
        assertEquals(403, off);
        assertEquals(200, on);
    }
}
