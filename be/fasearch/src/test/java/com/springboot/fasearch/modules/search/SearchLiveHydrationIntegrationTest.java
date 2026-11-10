package com.springboot.fasearch.modules.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.springboot.fasearch.common.enums.ProductStatus;
import com.springboot.fasearch.modules.inventory.entity.Inventory;
import com.springboot.fasearch.modules.inventory.repository.InventoryRepository;
import com.springboot.fasearch.modules.product.entity.Category;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.entity.ProductVariant;
import com.springboot.fasearch.modules.product.repository.CategoryRepository;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.modules.publish.entity.PublicationStatus;
import com.springboot.fasearch.modules.search.client.FashionAiClient;
import com.springboot.fasearch.modules.search.dto.ai.AiApiResponse;
import com.springboot.fasearch.modules.search.dto.ai.AiSearchData;
import com.springboot.fasearch.modules.search.dto.ai.AiSearchResultItem;
import com.springboot.fasearch.modules.search.dto.request.TextSearchReq;
import com.springboot.fasearch.modules.search.dto.response.AiSearchRes;
import com.springboot.fasearch.modules.search.service.interfaces.SearchService;

/**
 * Tìm kiếm AI phải trả sản phẩm đang bán thật: lọc PUBLISHED/ACTIVE/chưa xóa/còn hàng, gộp trùng, lấy dư từ AI.
 * AI service được mock; DB là cơ sở dữ liệu cô lập (PROMOTION_TEST_DB_NAME).
 */
@SpringBootTest
class SearchLiveHydrationIntegrationTest {

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        String database = System.getenv("PROMOTION_TEST_DB_NAME");
        if (database == null || database.isBlank()) {
            throw new IllegalStateException("Set PROMOTION_TEST_DB_NAME to the isolated candidate database before running API tests");
        }
        registry.add("spring.datasource.url", () -> "jdbc:postgresql://"
                + env("PROMOTION_TEST_DB_HOST", "127.0.0.1") + ":"
                + env("PROMOTION_TEST_DB_PORT", "55440") + "/" + database);
        registry.add("spring.datasource.username", () -> env("PROMOTION_TEST_DB_USER", "fasearch"));
        registry.add("spring.datasource.password", () -> env("PROMOTION_TEST_DB_PASSWORD", ""));
    }

    private static String env(String key, String fallback) {
        String value = System.getenv(key);
        return value == null || value.isBlank() ? fallback : value;
    }

    @MockitoBean private FashionAiClient fashionAiClient;

    @Autowired private SearchService searchService;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private ProductVariantRepository variantRepository;
    @Autowired private InventoryRepository inventoryRepository;

    private Product product(Category cat, String name, ProductStatus status, PublicationStatus pub, boolean deleted) {
        return productRepository.saveAndFlush(Product.builder()
                .productName(name).category(cat).price(new BigDecimal("199000.00"))
                .status(status).publicationStatus(pub).isDeleted(deleted).build());
    }

    private void variant(Product p, String color, int available) {
        ProductVariant v = variantRepository.saveAndFlush(ProductVariant.builder()
                .product(p).color(color).size("M").barcode("LIVE-" + UUID.randomUUID()).isDeleted(false).build());
        inventoryRepository.saveAndFlush(Inventory.builder().variant(v)
                .physicalStock(available).reservedStock(0).availableStock(available).minThreshold(1).isDeleted(false).build());
    }

    private static AiSearchResultItem hit(String pointId, Object productId, double score) {
        return AiSearchResultItem.builder().id(pointId).score(score).productId(productId == null ? null : String.valueOf(productId))
                .fileName("seed-" + pointId + ".jpg").catalog("dataset").build();
    }

    private void aiReturns(AiSearchResultItem... hits) {
        AiSearchData data = new AiSearchData();
        data.setResults(List.of(hits));
        data.setTotal(hits.length);
        AiApiResponse<AiSearchData> resp = new AiApiResponse<>();
        resp.setData(data);
        when(fashionAiClient.searchByText(eq("ao thun trang"), anyInt())).thenReturn(resp);
    }

    @Test
    void textSearch_returnsOnlyLiveInStockProducts_dedupedAndOverfetched() {
        String u = UUID.randomUUID().toString().substring(0, 8);
        Category cat = categoryRepository.saveAndFlush(Category.builder().categoryName("Live Cat " + u).isDeleted(false).build());
        Product live = product(cat, "Live " + u, ProductStatus.ACTIVE, PublicationStatus.PUBLISHED, false);
        variant(live, "Đỏ", 5);
        variant(live, "Default Title", 3);
        variant(live, "Xanh", 0);
        Product liveSecond = product(cat, "Live2 " + u, ProductStatus.ACTIVE, PublicationStatus.PUBLISHED, false);
        variant(liveSecond, "Đen", 2);
        Product unpublished = product(cat, "Unpub " + u, ProductStatus.ACTIVE, PublicationStatus.UNPUBLISHED, false);
        variant(unpublished, "Đỏ", 5);
        Product outOfStock = product(cat, "OOS " + u, ProductStatus.ACTIVE, PublicationStatus.PUBLISHED, false);
        variant(outOfStock, "Đỏ", 0);
        Product discontinued = product(cat, "Disc " + u, ProductStatus.DISCONTINUED, PublicationStatus.PUBLISHED, false);
        variant(discontinued, "Đỏ", 5);
        Product deleted = product(cat, "Del " + u, ProductStatus.ACTIVE, PublicationStatus.PUBLISHED, true);
        variant(deleted, "Đỏ", 5);

        aiReturns(
                hit("p1", unpublished.getId(), 0.99),
                hit("p2", outOfStock.getId(), 0.95),
                hit("p3", live.getId(), 0.90),
                hit("p4", discontinued.getId(), 0.88),
                hit("p5", deleted.getId(), 0.85),
                hit("p6", live.getId(), 0.80),       // trùng productId, điểm thấp hơn
                hit("p7", null, 0.79),                // không có product_id
                hit("p8", "abc", 0.78),               // product_id sai định dạng
                hit("p9", 999999999L, 0.77),          // không tồn tại
                hit("p10", liveSecond.getId(), 0.70));

        TextSearchReq req = new TextSearchReq();
        req.setQuery("ao thun trang");
        req.setLimit(5);
        AiSearchRes res = searchService.searchByText(req);

        verify(fashionAiClient).searchByText("ao thun trang", 15); // lấy dư 3x
        assertThat(res.getItems()).extracting(i -> i.getProductId()).containsExactly(live.getId(), liveSecond.getId());
        assertThat(res.getTotal()).isEqualTo(2);
        var first = res.getItems().get(0);
        assertThat(first.getId()).isEqualTo("p3");             // giữ điểm cao nhất
        assertThat(first.getScore()).isEqualTo(0.90);
        assertThat(first.getProductName()).isEqualTo("Live " + u);
        assertThat(first.getPrice()).isEqualByComparingTo("199000.00");
        assertThat(first.getColors()).containsExactly("Đỏ");   // bỏ placeholder và biến thể hết hàng
        assertThat(first.getStatus()).isEqualTo(ProductStatus.ACTIVE);
    }

    @Test
    void textSearch_truncatesToRequestedLimit() {
        String u = UUID.randomUUID().toString().substring(0, 8);
        Category cat = categoryRepository.saveAndFlush(Category.builder().categoryName("Live Cat " + u).isDeleted(false).build());
        Product a = product(cat, "A " + u, ProductStatus.ACTIVE, PublicationStatus.PUBLISHED, false);
        Product b = product(cat, "B " + u, ProductStatus.ACTIVE, PublicationStatus.PUBLISHED, false);
        Product c = product(cat, "C " + u, ProductStatus.ACTIVE, PublicationStatus.PUBLISHED, false);
        variant(a, "Đỏ", 1);
        variant(b, "Đỏ", 1);
        variant(c, "Đỏ", 1);
        aiReturns(hit("a", a.getId(), 0.9), hit("b", b.getId(), 0.8), hit("c", c.getId(), 0.7));

        TextSearchReq req = new TextSearchReq();
        req.setQuery("ao thun trang");
        req.setLimit(2);
        AiSearchRes res = searchService.searchByText(req);

        assertThat(res.getItems()).extracting(i -> i.getProductId()).containsExactly(a.getId(), b.getId());
    }

    @Test
    void textSearch_defaultLimit12_overfetchCappedAtAiMax24() {
        aiReturns();
        TextSearchReq req = new TextSearchReq();
        req.setQuery("ao thun trang");
        AiSearchRes res = searchService.searchByText(req);

        verify(fashionAiClient).searchByText("ao thun trang", 24); // 3 x 12 = 36, trần AI = 24
        assertThat(res.getItems()).isEmpty();
    }
}
