package com.springboot.fasearch.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * O1 end-to-end on a throwaway PostgreSQL (DEMO_TEST_DB_*, migrated from V1 through V27 by Flyway):
 * real JWT filter, real permission table, real controllers and services over HTTP.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class RolePermissionPostgresIntegrationTest {

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> "jdbc:postgresql://" + env("DEMO_TEST_DB_HOST", "127.0.0.1") + ":"
                + env("DEMO_TEST_DB_PORT", "55440") + "/" + env("DEMO_TEST_DB_NAME", "fasearch_demo_integrated_20261030"));
        registry.add("spring.datasource.username", () -> env("DEMO_TEST_DB_USER", "fasearch"));
        registry.add("spring.datasource.password", () -> env("DEMO_TEST_DB_PASSWORD", ""));
        registry.add("spring.datasource.hikari.maximum-pool-size", () -> "3");
    }

    private static String env(String key, String fallback) {
        String value = System.getenv(key);
        return value == null || value.isBlank() ? fallback : value;
    }

    @LocalServerPort private int port;
    @Autowired private JwtProvider jwtProvider;
    @Autowired private JdbcTemplate jdbc;

    private final HttpClient http = HttpClient.newHttpClient();
    private final ObjectMapper json = new ObjectMapper();
    private Long staffRoleId;
    private String admin;
    private String staff;
    private String customer;
    private Long customerId;

    private record Resp(int status, String body) {
    }

    @BeforeEach
    void setUp() {
        staffRoleId = jdbc.queryForObject("select ma_vai_tro from vai_tro where ten_vai_tro = 'STAFF'", Long.class);
        admin = token("admin", "ADMIN");
        staff = token("nhanvien1", "STAFF");
        customer = token("khachhang1", "CUSTOMER");
        customerId = jdbc.queryForObject("select k.ma_kh from khach_hang k join tai_khoan t on t.ma_tk = k.ma_tk"
                + " where t.ten_dang_nhap = 'khachhang1'", Long.class);
    }

    @AfterEach
    void restoreDefaults() {
        setStaff(Permission.staffDefaults());
    }

    private String token(String username, String role) {
        Map<String, Object> row = jdbc.queryForMap("select ma_tk, coalesce(token_version, 0) v from tai_khoan where ten_dang_nhap = ?", username);
        jdbc.update("update tai_khoan set trang_thai = 'ACTIVE', da_xoa = false where ten_dang_nhap = ?", username);
        return jwtProvider.generateToken(username, role, ((Number) row.get("ma_tk")).longValue(), ((Number) row.get("v")).longValue());
    }

    private void setStaff(Set<Permission> permissions) {
        jdbc.update("delete from quyen_vai_tro where ma_vai_tro = ?", staffRoleId);
        for (Permission p : permissions) {
            jdbc.update("insert into quyen_vai_tro (ma_vai_tro, ma_quyen) values (?, ?)", staffRoleId, p.name());
        }
    }

    private static Set<Permission> allExcept(Permission... removed) {
        Set<Permission> set = EnumSet.allOf(Permission.class);
        for (Permission p : removed) {
            set.remove(p);
        }
        return set;
    }

    private Resp call(String token, String method, String path, String body) {
        try {
            HttpRequest.Builder b = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
                    .header("Content-Type", "application/json").header("Authorization", "Bearer " + token);
            b.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
            HttpResponse<String> r = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
            return new Resp(r.statusCode(), r.body());
        } catch (Exception e) {
            throw new IllegalStateException(method + " " + path, e);
        }
    }

    private Set<String> myPermissions(String token) throws Exception {
        Resp r = call(token, "GET", "/api/v1/auth/my-info", null);
        assertThat(r.status()).as(r.body()).isEqualTo(200);
        Set<String> out = new TreeSet<>();
        json.readTree(r.body()).path("result").path("permissions").forEach(n -> out.add(n.asText()));
        return out;
    }

    @Test
    void v27SeedKeepsTodaysStaffAccessAndLoyaltyAdjustIsOff() {
        // Fresh DB from Flyway is checked before any test writes: rebuild expectation from the migration itself.
        List<String> seeded = jdbc.queryForList("select ma_quyen from quyen_vai_tro where ma_vai_tro = ?", String.class, staffRoleId);
        assertThat(new TreeSet<>(seeded)).isEqualTo(Permission.staffDefaults().stream().map(Enum::name)
                .collect(Collectors.toCollection(TreeSet::new)));
        assertThat(seeded).doesNotContain("LOYALTY_ADJUST");
        assertThat(jdbc.queryForObject("select count(*) from quyen_vai_tro q join vai_tro v on v.ma_vai_tro = q.ma_vai_tro"
                + " where v.ten_vai_tro <> 'STAFF'", Long.class)).isZero();
    }

    /** One readable GET per VIEW-type permission: refused without it, served with only it. */
    @Test
    void everyReadPermissionIsEnforcedOverHttp() {
        Map<Permission, String> reads = new java.util.LinkedHashMap<>();
        reads.put(Permission.ORDER_VIEW, "/api/v1/orders?page=0&size=1");
        reads.put(Permission.CUSTOMER_VIEW, "/api/v1/users/customers?page=0&size=1");
        reads.put(Permission.EMPLOYEE_VIEW, "/api/v1/users/employees?page=0&size=1");
        reads.put(Permission.PRODUCT_VIEW, "/api/v1/admin/products/drafts?page=0&size=1");
        reads.put(Permission.REVIEW_MODERATE, "/api/v1/admin/reviews?page=0&size=1");
        reads.put(Permission.INVENTORY_VIEW, "/api/v1/inventory/stock?page=0&size=1");
        reads.put(Permission.PROMOTION_VIEW, "/api/v1/khuyen-mai?page=0&size=1");
        reads.put(Permission.LOYALTY_POLICY_VIEW, "/api/v1/thanh-vien/chinh-sach/hang");
        reads.put(Permission.REPORT_VIEW, "/api/v1/analytics/revenue?startDate=2026-01-01&endDate=2026-01-31");
        reads.put(Permission.TRASH_VIEW, "/api/v1/admin/trash/products?page=0&size=1");
        reads.put(Permission.POS_USE, "/api/v1/orders/pos/drafts");
        reads.put(Permission.PRODUCT_IMPORT, "/api/v1/admin/csv/products/template");
        List<String> problems = new ArrayList<>();
        for (var e : reads.entrySet()) {
            setStaff(allExcept(e.getKey()));
            int off = call(staff, "GET", e.getValue(), null).status();
            setStaff(EnumSet.of(e.getKey()));
            int on = call(staff, "GET", e.getValue(), null).status();
            int asAdmin = call(admin, "GET", e.getValue(), null).status();
            if (off != 403 || on != 200 || asAdmin != 200) {
                problems.add(e.getKey() + " off=" + off + " on=" + on + " admin=" + asAdmin);
            }
        }
        // Export needs DATA_EXPORT and the matching view.
        setStaff(EnumSet.of(Permission.DATA_EXPORT));
        int exportOnly = call(staff, "GET", "/api/v1/admin/csv/products", null).status();
        setStaff(EnumSet.of(Permission.PRODUCT_VIEW));
        int viewOnly = call(staff, "GET", "/api/v1/admin/csv/products", null).status();
        setStaff(EnumSet.of(Permission.DATA_EXPORT, Permission.PRODUCT_VIEW));
        int both = call(staff, "GET", "/api/v1/admin/csv/products", null).status();
        if (exportOnly != 403 || viewOnly != 403 || both != 200) {
            problems.add("DATA_EXPORT export=" + exportOnly + " view=" + viewOnly + " both=" + both);
        }
        assertThat(problems).isEmpty();
    }

    /** Writes with a harmless target: refused (403) without the permission, reaches the service (non-403) with it. */
    @Test
    void writePermissionsAreEnforcedOverHttp() {
        record W(Permission p, String method, String path, String body) {
        }
        List<W> writes = List.of(
                new W(Permission.CATEGORY_MANAGE, "POST", "/api/v1/categories", "{\"categoryName\":\"O1 IT %s\"}"),
                new W(Permission.CUSTOMER_DELETE, "DELETE", "/api/v1/users/customers/987654", null),
                new W(Permission.EMPLOYEE_DELETE, "DELETE", "/api/v1/users/employees/987654", null),
                new W(Permission.PRODUCT_DELETE, "DELETE", "/api/v1/products/987654", null),
                new W(Permission.TRASH_RESTORE, "POST", "/api/v1/admin/trash/products/987654/restore", null),
                new W(Permission.ORDER_UPDATE_STATUS, "PATCH", "/api/v1/orders/987654/status", "{\"status\":\"CONFIRMED\"}"),
                new W(Permission.ORDER_CANCEL, "POST", "/api/v1/orders/987654/cancel", "{\"reason\":\"o1\"}"),
                new W(Permission.LOYALTY_ADJUST, "POST", "/api/v1/quan-tri/thanh-vien/don-hang/987654/tinh-lai-diem", null),
                new W(Permission.INVENTORY_RECEIPT_CREATE, "POST", "/api/v1/inventory/import-receipts",
                        "{\"supplierName\":\"O1\",\"items\":[{\"skuId\":987654,\"quantity\":1,\"importPrice\":1000}]}"));
        List<String> problems = new ArrayList<>();
        int n = 0;
        for (W w : writes) {
            String body = w.body() == null ? null : w.body().formatted("off" + (n++) + System.nanoTime());
            setStaff(allExcept(w.p()));
            int off = call(staff, w.method(), w.path(), body).status();
            setStaff(EnumSet.of(w.p()));
            String body2 = w.body() == null ? null : w.body().formatted("on" + (n++) + System.nanoTime());
            int on = call(staff, w.method(), w.path(), body2).status();
            if (off != 403 || on == 403 || on == 401) {
                problems.add(w.p() + " off=" + off + " on=" + on);
            }
        }
        assertThat(problems).isEmpty();
    }

    /** The cash/POS split happens in PaymentServiceImpl: a non-POS order needs ORDER_COLLECT_CASH, POS_USE is not enough. */
    @Test
    void collectingCashOnAWebOrderNeedsCollectCashNotPos() {
        Long webOrder = jdbc.queryForObject("select min(ma_don_hang) from don_hang where ma_don is null or ma_don not like 'POS-%'", Long.class);
        String body = "{\"orderId\":" + webOrder + ",\"paymentMethodCode\":\"CASH\",\"amountPaid\":1}";
        setStaff(EnumSet.of(Permission.POS_USE));
        assertThat(call(staff, "POST", "/api/v1/payments/process", body).status()).isEqualTo(403);
        setStaff(EnumSet.of(Permission.ORDER_COLLECT_CASH));
        assertThat(call(staff, "POST", "/api/v1/payments/process", body).status()).isNotIn(401, 403);
        setStaff(EnumSet.noneOf(Permission.class));
        assertThat(call(staff, "POST", "/api/v1/payments/calculate", "{\"orderId\":" + webOrder + "}").status()).isEqualTo(403);
        // calculate follows the same split as process
        String calc = "{\"orderId\":" + webOrder + "}";
        setStaff(EnumSet.of(Permission.POS_USE));
        assertThat(call(staff, "POST", "/api/v1/payments/calculate", calc).status()).isEqualTo(403);
        setStaff(EnumSet.of(Permission.ORDER_COLLECT_CASH));
        assertThat(call(staff, "POST", "/api/v1/payments/calculate", calc).status()).isNotIn(401, 403);
        Long posOrder = jdbc.queryForObject("select min(ma_don_hang) from don_hang where ma_don like 'POS-%'", Long.class);
        if (posOrder != null) {
            String posCalc = "{\"orderId\":" + posOrder + "}";
            setStaff(EnumSet.of(Permission.ORDER_COLLECT_CASH));
            assertThat(call(staff, "POST", "/api/v1/payments/calculate", posCalc).status()).isEqualTo(403);
            setStaff(EnumSet.of(Permission.POS_USE));
            assertThat(call(staff, "POST", "/api/v1/payments/calculate", posCalc).status()).isNotIn(401, 403);
        }
    }

    /** Admin saves through the real API; the same staff token changes behaviour on its next request; audit row written. */
    @Test
    void toggleAppliesOnNextRequestAndIsAudited() throws Exception {
        setStaff(Permission.staffDefaults());
        assertThat(call(staff, "GET", "/api/v1/inventory/stock-summary", null).status()).isEqualTo(200);
        long auditBefore = jdbc.queryForObject("select count(*) from nhat_ky_phan_quyen", Long.class);

        List<String> without = Permission.staffDefaults().stream().filter(p -> p != Permission.INVENTORY_VIEW).map(Enum::name).toList();
        Resp saved = call(admin, "PUT", "/api/v1/auth/roles/STAFF/permissions", json.writeValueAsString(Map.of("permissions", without)));
        assertThat(saved.status()).as(saved.body()).isEqualTo(200);

        assertThat(call(staff, "GET", "/api/v1/inventory/stock-summary", null).status()).isEqualTo(403);
        assertThat(myPermissions(staff)).doesNotContain("INVENTORY_VIEW").contains("ORDER_VIEW");
        assertThat(jdbc.queryForObject("select count(*) from nhat_ky_phan_quyen", Long.class)).isEqualTo(auditBefore + 1);
        Map<String, Object> row = jdbc.queryForMap("select n.quyen_truoc, n.quyen_sau, t.ten_dang_nhap from nhat_ky_phan_quyen n"
                + " join tai_khoan t on t.ma_tk = n.ma_tai_khoan_thuc_hien order by n.id desc limit 1");
        assertThat((String) row.get("quyen_truoc")).contains("INVENTORY_VIEW");
        assertThat((String) row.get("quyen_sau")).doesNotContain("INVENTORY_VIEW");
        assertThat(row.get("ten_dang_nhap")).isEqualTo("admin");
        JsonNode audit = json.readTree(call(admin, "GET", "/api/v1/auth/roles/STAFF/permissions/audit", null).body()).path("result");
        assertThat(audit.get(0).path("removed").toString()).contains("INVENTORY_VIEW");

        List<String> with = Permission.staffDefaults().stream().map(Enum::name).toList();
        assertThat(call(admin, "PUT", "/api/v1/auth/roles/STAFF/permissions", json.writeValueAsString(Map.of("permissions", with))).status()).isEqualTo(200);
        assertThat(call(staff, "GET", "/api/v1/inventory/stock-summary", null).status()).isEqualTo(200);

        // Unknown codes refused, nothing written; ADMIN role not editable; STAFF and CUSTOMER cannot touch the editor.
        long auditNow = jdbc.queryForObject("select count(*) from nhat_ky_phan_quyen", Long.class);
        assertThat(call(admin, "PUT", "/api/v1/auth/roles/STAFF/permissions", "{\"permissions\":[\"ORDER_VIEW\",\"GOD_MODE\"]}").status()).isEqualTo(400);
        assertThat(call(admin, "PUT", "/api/v1/auth/roles/ADMIN/permissions", "{\"permissions\":[]}").status()).isEqualTo(400);
        assertThat(jdbc.queryForObject("select count(*) from nhat_ky_phan_quyen", Long.class)).isEqualTo(auditNow);
        setStaff(EnumSet.allOf(Permission.class));
        assertThat(call(staff, "GET", "/api/v1/auth/roles/STAFF/permissions", null).status()).isEqualTo(403);
        assertThat(call(staff, "PUT", "/api/v1/auth/roles/STAFF/permissions", "{\"permissions\":[]}").status()).isEqualTo(403);
        assertThat(call(customer, "GET", "/api/v1/auth/roles/STAFF/permissions", null).status()).isEqualTo(403);
    }

    @Test
    void myInfoPermissionsPerRole() throws Exception {
        setStaff(EnumSet.of(Permission.ORDER_VIEW, Permission.TRASH_VIEW));
        assertThat(myPermissions(staff)).containsExactlyInAnyOrder("ORDER_VIEW", "TRASH_VIEW");
        assertThat(myPermissions(admin)).hasSize(Permission.values().length);
        assertThat(myPermissions(customer)).isEmpty();
    }

    /** With every Quản lý permission off, customer flows on the shared endpoints still work and stay owner-scoped. */
    @Test
    void customerFlowsUnchangedWithAllStaffPermissionsOff() throws Exception {
        setStaff(EnumSet.noneOf(Permission.class));
        assertThat(call(customer, "GET", "/api/v1/orders?page=0&size=5", null).status()).isEqualTo(200);
        Long ownOrder = jdbc.queryForObject("select min(ma_don_hang) from don_hang where ma_kh = ?", Long.class, customerId);
        if (ownOrder != null) {
            assertThat(call(customer, "GET", "/api/v1/orders/" + ownOrder, null).status()).isEqualTo(200);
            assertThat(call(customer, "POST", "/api/v1/payments/calculate", "{\"orderId\":" + ownOrder + "}").status()).isNotIn(401, 403);
            // Cancelling a delivered order is a business refusal (400/409), never an authorization one.
            assertThat(call(customer, "POST", "/api/v1/orders/" + ownOrder + "/cancel", "{\"reason\":\"o1\"}").status()).isNotIn(401, 403);
        }
        Long othersOrder = jdbc.queryForObject("select min(ma_don_hang) from don_hang where ma_kh is distinct from ?", Long.class, customerId);
        if (othersOrder != null) {
            assertThat(call(customer, "GET", "/api/v1/orders/" + othersOrder, null).status()).isIn(403, 404);
        }
        assertThat(call(customer, "GET", "/api/v1/users/customers/" + customerId, null).status()).isEqualTo(200);
        Resp patch = call(customer, "PATCH", "/api/v1/users/customers/" + customerId, "{\"address\":\"12 O1 Test\"}");
        assertThat(patch.status()).as(patch.body()).isEqualTo(200);
        assertThat(call(customer, "GET", "/api/v1/users/employees", null).status()).isEqualTo(403);
        assertThat(call(customer, "GET", "/api/v1/analytics/revenue?startDate=2026-01-01&endDate=2026-01-02", null).status()).isEqualTo(403);
        // and the staff token with nothing on is refused on the same shared endpoints
        assertThat(call(staff, "GET", "/api/v1/orders?page=0&size=1", null).status()).isEqualTo(403);
        assertThat(call(staff, "GET", "/api/v1/users/customers/" + customerId, null).status()).isEqualTo(403);
    }

    @Test
    void adminCannotChangeOwnRoleOrStatusInTheBackend() {
        Long adminId = jdbc.queryForObject("select ma_tk from tai_khoan where ten_dang_nhap = 'admin'", Long.class);
        assertThat(call(admin, "PATCH", "/api/v1/auth/accounts/" + adminId, "{\"role\":\"STAFF\"}").status()).isEqualTo(403);
        assertThat(call(admin, "PATCH", "/api/v1/auth/accounts/" + adminId, "{\"status\":\"LOCKED\"}").status()).isEqualTo(403);
        assertThat(jdbc.queryForObject("select v.ten_vai_tro from tai_khoan t join vai_tro v on v.ma_vai_tro = t.ma_vai_tro where t.ma_tk = ?",
                String.class, adminId)).isEqualTo("ADMIN");
        assertThat(call(admin, "GET", "/api/v1/auth/my-info", null).status()).isEqualTo(200);
    }

    @Test
    void staffCannotRestoreAdminLinkedEmployeeProfile() {
        Long adminRole = jdbc.queryForObject("select ma_vai_tro from vai_tro where ten_vai_tro = 'ADMIN'", Long.class);
        String uniq = Long.toString(System.nanoTime(), 36);
        Long accountId = jdbc.queryForObject("insert into tai_khoan (ten_dang_nhap, mat_khau, email, trang_thai, ma_vai_tro, da_xoa)"
                + " values (?, 'x', ?, 'LOCKED', ?, false) returning ma_tk", Long.class, "o1adm" + uniq, "o1" + uniq + "@t.vn", adminRole);
        String digits = String.valueOf(Math.abs(uniq.hashCode())) + "000000000000";
        Long employeeId = jdbc.queryForObject("insert into nhan_vien (ho_nv, ten_nv, sdt, cccd, ma_tk, da_xoa) values ('O1', 'Admin', ?, ?, ?, true) returning ma_nv",
                Long.class, "09" + digits.substring(0, 8), digits.substring(0, 12), accountId);
        setStaff(EnumSet.allOf(Permission.class));
        assertThat(call(staff, "POST", "/api/v1/admin/trash/employees/" + employeeId + "/restore", null).status()).isEqualTo(403);
        assertThat(jdbc.queryForObject("select da_xoa from nhan_vien where ma_nv = ?", Boolean.class, employeeId)).isTrue();
        assertThat(call(admin, "POST", "/api/v1/admin/trash/employees/" + employeeId + "/restore", null).status()).isEqualTo(200);
        assertThat(jdbc.queryForObject("select da_xoa from nhan_vien where ma_nv = ?", Boolean.class, employeeId)).isFalse();
    }
}
