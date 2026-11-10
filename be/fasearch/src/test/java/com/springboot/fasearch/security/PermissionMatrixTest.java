package com.springboot.fasearch.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;
import org.objenesis.ObjenesisStd;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authorization.AuthorizationResult;
import org.springframework.security.authorization.method.PreAuthorizeAuthorizationManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.util.SimpleMethodInvocation;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Bảng endpoint -> quyền là NGUỒN SỰ THẬT của phân quyền (đồng bộ với READY.md và be_docs/api/api-auth.md).
 *
 * <p>Mỗi endpoint của mọi @RestController phải có trong bảng (endpoint mới chưa phân loại làm test đỏ).
 * Với từng endpoint, biểu thức @PreAuthorize THẬT (method trước, rồi class) được chạy bằng
 * {@link PreAuthorizeAuthorizationManager} như lúc chạy thật, cho: ADMIN (mọi quyền), Quản lý mặc định (seed V27),
 * Quản lý không quyền nào, Quản lý chỉ có đúng quyền cần, Quản lý có mọi quyền trừ quyền cần, khách hàng.
 */
class PermissionMatrixTest {

    enum Kind { PERM_ALL, PERM_ANY, SHARED_ANY, ADMIN_ONLY, CUSTOMER_ONLY, OPEN }

    record Rule(Kind kind, Set<Permission> perms) {
        static Rule all(Permission... p) { return new Rule(Kind.PERM_ALL, EnumSet.copyOf(Arrays.asList(p))); }
        static Rule any(Permission... p) { return new Rule(Kind.PERM_ANY, EnumSet.copyOf(Arrays.asList(p))); }
        static Rule shared(Permission... p) { return new Rule(Kind.SHARED_ANY, EnumSet.copyOf(Arrays.asList(p))); }
        static Rule admin() { return new Rule(Kind.ADMIN_ONLY, EnumSet.noneOf(Permission.class)); }
        static Rule customer() { return new Rule(Kind.CUSTOMER_ONLY, EnumSet.noneOf(Permission.class)); }
        /** Công khai, hoặc chỉ cần đăng nhập (my-info, đổi mật khẩu, lịch sử tìm kiếm...): ngoài phạm vi PERM_*. */
        static Rule open() { return new Rule(Kind.OPEN, EnumSet.noneOf(Permission.class)); }
    }

    static final Map<String, Rule> TABLE = new LinkedHashMap<>();

    private static void put(String key, Rule rule) {
        if (TABLE.put(key, rule) != null) {
            throw new IllegalStateException("trùng khóa " + key);
        }
    }

    static {
        // ---- Đơn hàng / POS / thanh toán
        put("GET /api/v1/orders", Rule.shared(Permission.ORDER_VIEW));
        put("GET /api/v1/orders/{id}", Rule.shared(Permission.ORDER_VIEW));
        put("PATCH /api/v1/orders/{id}/status", Rule.all(Permission.ORDER_UPDATE_STATUS));
        put("POST /api/v1/orders/{id}/cancel", Rule.shared(Permission.ORDER_CANCEL));
        put("POST /api/v1/orders/pos/draft", Rule.all(Permission.POS_USE));
        put("POST /api/v1/orders/pos/{orderId}/quote", Rule.all(Permission.POS_USE));
        put("GET /api/v1/orders/pos/drafts", Rule.all(Permission.POS_USE));
        put("GET /api/v1/products/pos-lookup", Rule.all(Permission.POS_USE));
        put("GET /api/v1/products/pos-search", Rule.all(Permission.POS_USE));
        // Service tách thêm: đơn POS cần POS_USE, đơn khác cần ORDER_COLLECT_CASH (PaymentServiceImpl).
        put("POST /api/v1/payments/calculate", Rule.shared(Permission.POS_USE, Permission.ORDER_COLLECT_CASH));
        put("POST /api/v1/payments/process", Rule.shared(Permission.POS_USE, Permission.ORDER_COLLECT_CASH));
        put("POST /api/v1/orders/checkout", Rule.customer());
        put("POST /api/v1/orders/calculate-shipping-fee", Rule.customer());

        put("GET /api/v1/returns/orders/{orderId}", Rule.customer());
        put("POST /api/v1/returns", Rule.customer());
        put("GET /api/v1/returns/{id}", Rule.customer());
        put("GET /api/v1/returns/{id}/photos/{position}", Rule.customer());
        put("GET /api/v1/admin/returns", Rule.all(Permission.RETURN_VIEW));
        put("GET /api/v1/admin/returns/{id}", Rule.all(Permission.RETURN_VIEW));
        put("GET /api/v1/admin/returns/{id}/photos/{position}", Rule.all(Permission.RETURN_VIEW));
        put("POST /api/v1/admin/returns/{id}/decision", Rule.all(Permission.RETURN_PROCESS));
        put("POST /api/v1/admin/returns/{id}/receive", Rule.all(Permission.RETURN_PROCESS));
        put("POST /api/v1/admin/returns/{id}/refund", Rule.all(Permission.RETURN_REFUND));

        put("GET /api/v1/notifications/preferences", Rule.customer());
        put("PUT /api/v1/notifications/preferences", Rule.customer());
        put("GET /api/v1/notifications/favorites", Rule.customer());
        put("PUT /api/v1/notifications/favorites/{productId}", Rule.customer());
        put("GET /api/v1/admin/notifications", Rule.any(Permission.ORDER_VIEW, Permission.RETURN_VIEW, Permission.INVENTORY_VIEW));
        put("POST /api/v1/admin/notifications/{id}/read", Rule.any(Permission.ORDER_VIEW, Permission.RETURN_VIEW, Permission.INVENTORY_VIEW));

        put("GET /api/v1/admin/audit", Rule.all(Permission.AUDIT_VIEW));
        put("GET /api/v1/admin/audit/{id}", Rule.all(Permission.AUDIT_VIEW));
        put("GET /api/v1/admin/audit/export", Rule.all(Permission.AUDIT_VIEW, Permission.DATA_EXPORT));

        // ---- Khách hàng
        put("GET /api/v1/users/customers", Rule.all(Permission.CUSTOMER_VIEW));
        put("GET /api/v1/users/customers/{id}", Rule.shared(Permission.CUSTOMER_VIEW));
        put("POST /api/v1/users/customers", Rule.all(Permission.CUSTOMER_CREATE));
        put("PATCH/PUT /api/v1/users/customers/{id}", Rule.shared(Permission.CUSTOMER_EDIT));
        put("DELETE /api/v1/users/customers/{id}", Rule.all(Permission.CUSTOMER_DELETE));
        put("GET /api/v1/thanh-vien/khach-hang/{customerId}", Rule.all(Permission.CUSTOMER_VIEW));

        // ---- Nhân sự
        put("GET /api/v1/users/employees", Rule.all(Permission.EMPLOYEE_VIEW));
        put("GET /api/v1/users/employees/{id}", Rule.all(Permission.EMPLOYEE_VIEW));
        put("POST /api/v1/users/employees", Rule.all(Permission.EMPLOYEE_CREATE));
        put("PATCH/PUT /api/v1/users/employees/{id}", Rule.all(Permission.EMPLOYEE_EDIT));
        put("DELETE /api/v1/users/employees/{id}", Rule.all(Permission.EMPLOYEE_DELETE));

        // ---- Sản phẩm
        put("POST /api/v1/products", Rule.all(Permission.PRODUCT_EDIT));
        put("PATCH/PUT /api/v1/products/{id}", Rule.all(Permission.PRODUCT_EDIT));
        put("DELETE /api/v1/products/{id}", Rule.all(Permission.PRODUCT_DELETE));
        put("POST /api/v1/products/{productId}/variants", Rule.all(Permission.PRODUCT_EDIT));
        put("PATCH/PUT /api/v1/products/variants/{variantId}", Rule.all(Permission.PRODUCT_EDIT));
        put("DELETE /api/v1/products/variants/{variantId}", Rule.all(Permission.PRODUCT_DELETE));
        put("GET /api/v1/products/variants/{skuId}/barcode", Rule.all(Permission.PRODUCT_VIEW));
        put("GET /api/v1/products/variants/{skuId}/barcode/image", Rule.all(Permission.PRODUCT_VIEW));
        put("POST /api/v1/products/{id}/image", Rule.all(Permission.PRODUCT_EDIT));
        put("DELETE /api/v1/products/{id}/image", Rule.all(Permission.PRODUCT_EDIT));
        put("POST /api/v1/admin/products/drafts", Rule.all(Permission.PRODUCT_EDIT));
        put("PUT /api/v1/admin/products/drafts/{draftId}", Rule.all(Permission.PRODUCT_EDIT));
        put("DELETE /api/v1/admin/products/drafts/{draftId}", Rule.all(Permission.PRODUCT_EDIT));
        put("POST /api/v1/admin/products/drafts/{draftId}/images", Rule.all(Permission.PRODUCT_EDIT));
        put("GET /api/v1/admin/products/drafts", Rule.all(Permission.PRODUCT_VIEW));
        put("GET /api/v1/admin/products/drafts/{draftId}", Rule.all(Permission.PRODUCT_VIEW));
        put("GET /api/v1/admin/products/drafts/{draftId}/images/{fileName}", Rule.all(Permission.PRODUCT_VIEW));
        put("GET /api/v1/admin/products/{productId}/ai-sync", Rule.all(Permission.PRODUCT_VIEW));
        put("POST /api/v1/admin/products/drafts/{draftId}/publish", Rule.all(Permission.PRODUCT_PUBLISH));
        put("POST /api/v1/admin/products/{productId}/unpublish", Rule.all(Permission.PRODUCT_PUBLISH));
        put("POST /api/v1/admin/products/{productId}/ai-sync/retry", Rule.all(Permission.PRODUCT_PUBLISH));
        put("POST /api/v1/admin/products/import-url", Rule.all(Permission.PRODUCT_IMPORT));
        put("POST /api/v1/admin/csv/products/import", Rule.all(Permission.PRODUCT_IMPORT));
        put("GET /api/v1/admin/csv/products/template", Rule.all(Permission.PRODUCT_IMPORT));
        put("POST /api/v1/categories", Rule.all(Permission.CATEGORY_MANAGE));
        put("PATCH/PUT /api/v1/categories/{id}", Rule.all(Permission.CATEGORY_MANAGE));
        put("DELETE /api/v1/categories/{id}", Rule.all(Permission.CATEGORY_MANAGE));
        put("GET /api/v1/admin/reviews", Rule.all(Permission.REVIEW_MODERATE));
        put("PATCH /api/v1/admin/reviews/{reviewId}/visibility", Rule.all(Permission.REVIEW_MODERATE));

        // ---- Kho
        for (String p : List.of("/stock", "/stock-summary", "/stock/{skuId}", "/import-receipts", "/import-receipts/{id}",
                "/export-receipts", "/export-receipts/{id}", "/stocktakes", "/stocktakes/{id}")) {
            put("GET /api/v1/inventory" + p, Rule.all(Permission.INVENTORY_VIEW));
        }
        put("POST /api/v1/inventory/import-receipts", Rule.all(Permission.INVENTORY_RECEIPT_CREATE));
        put("POST /api/v1/inventory/export-receipts", Rule.all(Permission.INVENTORY_RECEIPT_CREATE));
        put("POST /api/v1/inventory/stocktakes", Rule.all(Permission.STOCKTAKE_CREATE));
        // Lane S2: quét Barcode trong phiếu nhập/xuất/kiểm kê trả về tồn kho của SKU.
        put("GET /api/v1/products/variants/scan-lookup", Rule.all(Permission.INVENTORY_VIEW));

        // ---- Khuyến mãi
        put("GET /api/v1/khuyen-mai", Rule.all(Permission.PROMOTION_VIEW));
        put("GET /api/v1/khuyen-mai/{id}", Rule.all(Permission.PROMOTION_VIEW));
        put("POST /api/v1/khuyen-mai", Rule.all(Permission.PROMOTION_MANAGE));
        put("PUT /api/v1/khuyen-mai/{id}", Rule.all(Permission.PROMOTION_MANAGE));
        put("POST /api/v1/khuyen-mai/{id}/codes", Rule.all(Permission.PROMOTION_MANAGE));

        // ---- Điểm
        put("GET /api/v1/thanh-vien/chinh-sach", Rule.all(Permission.LOYALTY_POLICY_VIEW));
        put("GET /api/v1/thanh-vien/chinh-sach/hang", Rule.all(Permission.LOYALTY_POLICY_VIEW));
        put("POST /api/v1/thanh-vien/chinh-sach", Rule.all(Permission.LOYALTY_POLICY_MANAGE));
        put("PUT /api/v1/thanh-vien/chinh-sach/{policyId}", Rule.all(Permission.LOYALTY_POLICY_MANAGE));
        put("PUT /api/v1/thanh-vien/chinh-sach/hang/{tierId}", Rule.all(Permission.LOYALTY_POLICY_MANAGE));
        put("POST /api/v1/quan-tri/thanh-vien/mo-dau", Rule.admin());
        put("GET /api/v1/quan-tri/thanh-vien/khach-hang/{customerId}/lich-su", Rule.all(Permission.CUSTOMER_VIEW));
        put("POST /api/v1/quan-tri/thanh-vien/khach-hang/{customerId}/dieu-chinh", Rule.all(Permission.LOYALTY_ADJUST));
        put("GET /api/v1/quan-tri/thanh-vien/don-hang/{orderId}/tinh-lai-diem", Rule.all(Permission.LOYALTY_ADJUST));
        put("POST /api/v1/quan-tri/thanh-vien/don-hang/{orderId}/tinh-lai-diem", Rule.all(Permission.LOYALTY_ADJUST));
        put("GET /api/v1/thanh-vien", Rule.customer());
        put("GET /api/v1/thanh-vien/chinh-sach-cua-toi", Rule.customer());
        put("GET /api/v1/thanh-vien/lich-su", Rule.customer());

        // ---- Report / Export CSV (Export cần thêm quyền xem dữ liệu được xuất)
        put("GET /api/v1/analytics/revenue", Rule.all(Permission.REPORT_VIEW));
        put("GET /api/v1/analytics/top-products", Rule.all(Permission.REPORT_VIEW));
        put("GET /api/v1/analytics/inventory-movement", Rule.all(Permission.REPORT_VIEW));
        put("GET /api/v1/analytics/overview", Rule.all(Permission.REPORT_VIEW));
        put("GET /api/v1/admin/csv/products", Rule.all(Permission.DATA_EXPORT, Permission.PRODUCT_VIEW));
        put("GET /api/v1/admin/csv/stock", Rule.all(Permission.DATA_EXPORT, Permission.INVENTORY_VIEW));
        put("GET /api/v1/admin/csv/orders", Rule.all(Permission.DATA_EXPORT, Permission.ORDER_VIEW));
        put("GET /api/v1/admin/csv/customers", Rule.all(Permission.DATA_EXPORT, Permission.CUSTOMER_VIEW));

        // ---- Thùng rác
        for (String k : List.of("products", "variants", "categories", "customers", "employees")) {
            put("GET /api/v1/admin/trash/" + k, Rule.all(Permission.TRASH_VIEW));
            put("POST /api/v1/admin/trash/" + k + "/{id}/restore", Rule.all(Permission.TRASH_RESTORE));
        }
        put("GET /api/v1/admin/trash/accounts", Rule.admin());
        put("POST /api/v1/admin/trash/accounts/{id}/restore", Rule.admin());

        // ---- Tài khoản, vai trò, phân quyền: chỉ ADMIN, không bật/tắt được
        put("GET /api/v1/auth/accounts", Rule.admin());
        put("POST /api/v1/auth/accounts", Rule.admin());
        put("PATCH/PUT /api/v1/auth/accounts/{id}", Rule.admin());
        put("DELETE /api/v1/auth/accounts/{id}", Rule.admin());
        put("GET /api/v1/auth/roles/{role}/permissions", Rule.admin());
        put("PUT /api/v1/auth/roles/{role}/permissions", Rule.admin());
        put("GET /api/v1/auth/roles/{role}/permissions/audit", Rule.admin());

        // ---- Khách hàng (cửa hàng)
        for (String k : List.of("GET /api/v1/cart", "POST /api/v1/cart/quote", "POST /api/v1/cart/items",
                "PUT /api/v1/cart/items/{skuId}", "DELETE /api/v1/cart/items/{skuId}", "DELETE /api/v1/cart",
                "GET /api/v1/shipping/maps/autocomplete", "GET /api/v1/shipping/maps/geocode",
                "POST /api/v1/payments/attempts", "GET /api/v1/payments/attempts/{id}",
                "POST /api/v1/payments/stripe/checkout", "POST /api/v1/payments/vnpay/checkout",
                "GET /api/v1/reviews/products/{productId}/me", "POST /api/v1/reviews/products/{productId}",
                "PUT /api/v1/reviews/products/{productId}", "DELETE /api/v1/reviews/products/{productId}")) {
            put(k, Rule.customer());
        }

        // ---- Công khai / chỉ cần đăng nhập
        for (String k : List.of("GET /api/v1/products", "GET /api/v1/products/{id}", "GET /api/v1/products/{id}/related",
                "GET /api/v1/products/images/{fileName}", "GET /api/v1/products/{productId}/variants",
                "GET /api/v1/products/variants/{variantId}", "GET /api/v1/categories", "GET /api/v1/categories/{id}",
                "GET /api/v1/categories/with-counts", "GET /api/v1/brands", "GET /api/v1/brands/{slug}/logo",
                "GET /api/v1/promotions", "GET /api/v1/payments/methods", "POST /api/v1/payments/stripe/webhook",
                "GET /api/v1/payments/vnpay/return", "GET /api/v1/payments/vnpay/ipn",
                "GET /api/v1/reviews/products/{productId}", "GET /api/v1/reviews/products/{productId}/summary",
                "GET /api/v1/search/images/{fileName}", "POST /api/v1/search/text", "POST /api/v1/search/image",
                "POST /api/v1/search/multimodal",
                "POST /api/v1/account/search-history", "GET /api/v1/account/search-history",
                "DELETE /api/v1/account/search-history/{id}", "POST /api/v1/account/favorites",
                "DELETE /api/v1/account/favorites/{productId}", "GET /api/v1/account/favorites",
                "POST /api/v1/auth/login", "POST /api/v1/auth/register", "GET /api/v1/auth/my-info",
                "POST /api/v1/auth/change-password", "POST /api/v1/auth/password/forgot",
                "POST /api/v1/auth/password/reset", "POST /api/v1/auth/email/verification-request",
                "POST /api/v1/auth/email/verify")) {
            put(k, Rule.open());
        }
    }

    record Endpoint(String key, Class<?> controller, Method method) {
    }

    static List<Endpoint> endpoints;
    static final PreAuthorizeAuthorizationManager MANAGER = new PreAuthorizeAuthorizationManager();
    static final ObjenesisStd OBJENESIS = new ObjenesisStd();

    @BeforeAll
    static void scan() throws Exception {
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));
        endpoints = new ArrayList<>();
        for (var bd : scanner.findCandidateComponents("com.springboot.fasearch")) {
            Class<?> type = Class.forName(bd.getBeanClassName());
            RequestMapping base = AnnotatedElementUtils.findMergedAnnotation(type, RequestMapping.class);
            String prefix = base == null || base.path().length == 0 ? "" : base.path()[0];
            for (Method m : type.getDeclaredMethods()) {
                RequestMapping rm = AnnotatedElementUtils.findMergedAnnotation(m, RequestMapping.class);
                if (rm == null) {
                    continue;
                }
                String sub = rm.path().length == 0 ? "" : rm.path()[0];
                String verbs = Arrays.stream(rm.method()).map(Enum::name).collect(Collectors.joining("/"));
                endpoints.add(new Endpoint(verbs + " " + prefix + sub, type, m));
            }
        }
    }

    private static boolean granted(Endpoint e, Collection<? extends GrantedAuthority> authorities) {
        Authentication auth = UsernamePasswordAuthenticationToken.authenticated("tester", null, authorities);
        Object target = OBJENESIS.newInstance(e.controller());
        AuthorizationResult result = MANAGER.authorize(() -> auth, new SimpleMethodInvocation(target, e.method()));
        // Không có @PreAuthorize nào (method hoặc class): không chặn ở tầng method.
        return result == null || result.isGranted();
    }

    @Test
    void everyEndpointIsClassifiedAndEveryRowExists() {
        Set<String> found = endpoints.stream().map(Endpoint::key).collect(Collectors.toCollection(TreeSet::new));
        Set<String> unknown = new TreeSet<>(found);
        unknown.removeAll(TABLE.keySet());
        Set<String> stale = new TreeSet<>(TABLE.keySet());
        stale.removeAll(found);
        assertTrue(unknown.isEmpty(), "Endpoint chưa có trong bảng quyền: " + unknown);
        assertTrue(stale.isEmpty(), "Dòng trong bảng quyền không còn endpoint: " + stale);
        assertEquals(found.size(), endpoints.size(), "trùng endpoint");
    }

    @Test
    void everyCatalogPermissionGuardsAtLeastOneEndpoint() {
        Set<Permission> used = EnumSet.noneOf(Permission.class);
        TABLE.values().forEach(r -> used.addAll(r.perms()));
        Set<Permission> unused = EnumSet.allOf(Permission.class);
        unused.removeAll(used);
        assertTrue(unused.isEmpty(), "Quyền không bảo vệ endpoint nào: " + unused);
    }

    @TestFactory
    Stream<DynamicTest> matrix() {
        return endpoints.stream().filter(e -> TABLE.containsKey(e.key())).map(e -> DynamicTest.dynamicTest(e.key(), () -> {
            Rule rule = TABLE.get(e.key());
            switch (rule.kind()) {
                case PERM_ALL, PERM_ANY, SHARED_ANY -> {
                    assertTrue(granted(e, TestAuthorities.admin()), "ADMIN");
                    assertFalse(granted(e, TestAuthorities.staff(Set.of())), "Quản lý không quyền nào");
                    boolean defaultsCover = Permission.staffDefaults().containsAll(rule.perms())
                            || (rule.kind() != Kind.PERM_ALL
                                    && rule.perms().stream().anyMatch(Permission.staffDefaults()::contains));
                    assertEquals(defaultsCover, granted(e, TestAuthorities.staffDefaults()), "Quản lý mặc định (V27)");
                    if (rule.kind() == Kind.PERM_ALL) {
                        assertTrue(granted(e, TestAuthorities.staff(rule.perms())), "Quản lý có đúng quyền cần");
                        for (Permission p : rule.perms()) {
                            assertFalse(granted(e, TestAuthorities.staffAllExcept(p)), "Quản lý thiếu " + p);
                        }
                        assertFalse(granted(e, TestAuthorities.customer()), "khách hàng");
                    } else {
                        for (Permission p : rule.perms()) {
                            assertTrue(granted(e, TestAuthorities.staff(Set.of(p))), "Quản lý chỉ có " + p);
                        }
                        assertFalse(granted(e, TestAuthorities.staffAllExcept(rule.perms().toArray(Permission[]::new))),
                                "Quản lý thiếu mọi quyền " + rule.perms());
                        assertEquals(rule.kind() == Kind.SHARED_ANY, granted(e, TestAuthorities.customer()), "khách hàng chỉ dùng endpoint dùng chung");
                    }
                }
                case ADMIN_ONLY -> {
                    assertTrue(granted(e, TestAuthorities.admin()), "ADMIN");
                    assertFalse(granted(e, TestAuthorities.staffAllExcept()), "Quản lý có MỌI quyền vẫn bị từ chối");
                    assertFalse(granted(e, TestAuthorities.customer()), "khách hàng");
                }
                case CUSTOMER_ONLY -> {
                    assertTrue(granted(e, TestAuthorities.customer()), "khách hàng");
                    assertFalse(granted(e, TestAuthorities.staffAllExcept()), "Quản lý");
                }
                case OPEN -> {
                    // Không thuộc phân quyền nội bộ: quyền PERM_* không được làm đổi kết quả.
                    assertEquals(granted(e, TestAuthorities.staff(Set.of())), granted(e, TestAuthorities.staffAllExcept()),
                            "endpoint mở không được phụ thuộc PERM_*");
                }
                default -> fail("loại quy tắc lạ");
            }
        }));
    }

    /** Seed V27 phải khớp đúng Permission.staffDefaults(): Quản lý giữ nguyên phạm vi cũ, quyền mới mặc định tắt. */
    @Test
    void v27SeedMatchesStaffDefaults() throws Exception {
        String sql = Files.readString(Path.of("src/main/resources/db/migration/V27__role_permissions.sql"))
                + Files.readString(Path.of("src/main/resources/db/migration/V28__order_returns.sql"));
        Matcher m = Pattern.compile("\\('([A-Z_]+)'\\)").matcher(sql);
        Set<String> seeded = new TreeSet<>();
        while (m.find()) {
            seeded.add(m.group(1));
        }
        Set<String> expected = Permission.staffDefaults().stream().map(Enum::name).collect(Collectors.toCollection(TreeSet::new));
        assertEquals(expected, seeded);
        assertFalse(seeded.contains(Permission.LOYALTY_ADJUST.name()));
        assertFalse(seeded.contains(Permission.RETURN_REFUND.name()));
    }
}
