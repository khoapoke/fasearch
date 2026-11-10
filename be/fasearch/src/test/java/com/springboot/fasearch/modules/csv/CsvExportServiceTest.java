package com.springboot.fasearch.modules.csv;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.function.Function;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor.SpecificationFluentQuery;

import com.springboot.fasearch.common.enums.ProductStatus;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.modules.csv.service.impl.CsvExportServiceImpl;
import com.springboot.fasearch.modules.inventory.entity.Inventory;
import com.springboot.fasearch.modules.inventory.repository.InventoryRepository;
import com.springboot.fasearch.modules.order.repository.OrderRepository;
import com.springboot.fasearch.modules.payment.repository.InvoiceRepository;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.entity.ProductVariant;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.modules.user.repository.MembershipTierRepository;
import com.springboot.fasearch.modules.user.repository.UserRepository;

/**
 * The row cap is checked before streaming, and rows are read one bounded batch at a time:
 * one extra fetch query per batch, never one query per row.
 */
@ExtendWith(MockitoExtension.class)
class CsvExportServiceTest {

    @Mock private ProductVariantRepository productVariantRepository;
    @Mock private InventoryRepository inventoryRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private UserRepository userRepository;
    @Mock private InvoiceRepository invoiceRepository;
    @Mock private MembershipTierRepository membershipTierRepository;
    @InjectMocks private CsvExportServiceImpl service;

    @Test
    void capIsRefusedBeforeAnyRowIsRead() {
        when(inventoryRepository.count(any(Specification.class))).thenReturn(CsvExportServiceImpl.MAX_ROWS + 1);

        AppException error = assertThrows(AppException.class,
                () -> service.prepareStock(null, null, null));

        assertTrue(error.getMessage().contains("50001"));
        assertTrue(error.getMessage().contains("50000"));
        verify(inventoryRepository, times(0)).findBy(any(Specification.class), any());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void oneBatchIsAssembledWithOneFetchQueryNotOneQueryPerRow() throws Exception {
        Inventory first = stock(1L, 11L, "Áo sơ mi", "Đỏ", "M");
        Inventory second = stock(2L, 12L, "Quần jeans", "Xanh", "L");
        when(inventoryRepository.count(any(Specification.class))).thenReturn(2L);

        SpecificationFluentQuery<Inventory> fluent = mock(SpecificationFluentQuery.class);
        when(fluent.sortBy(any(Sort.class))).thenReturn(fluent);
        when(fluent.limit(anyInt())).thenReturn(fluent);
        when(fluent.all()).thenReturn(List.of(first, second));
        when(inventoryRepository.findBy(any(Specification.class), any(Function.class)))
                .thenAnswer(call -> ((Function) call.getArgument(1)).apply(fluent));
        when(inventoryRepository.findExportRowsByIdIn(any())).thenReturn(List.of(first, second));

        CsvExportPlan plan = service.prepareStock(null, null, null);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        plan.content().writeTo(out);

        assertEquals(2, plan.rows());
        assertEquals("ton-kho-" + java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")) + ".csv",
                plan.filename());
        String csv = new String(out.toByteArray(), StandardCharsets.UTF_8);
        assertTrue(csv.startsWith("\uFEFF"));
        assertTrue(csv.contains("Mã SKU"));
        assertTrue(csv.contains("Áo sơ mi"));
        assertTrue(csv.contains("Quần jeans"));
        verify(inventoryRepository, times(1)).findExportRowsByIdIn(any());
        verify(inventoryRepository, times(1)).findBy(any(Specification.class), any(Function.class));
    }

    private static Inventory stock(long id, long skuId, String name, String color, String size) {
        Product product = Product.builder().id(skuId + 100).productName(name).status(ProductStatus.ACTIVE)
                .price(new BigDecimal("350000.00")).build();
        ProductVariant variant = ProductVariant.builder().id(skuId).product(product).color(color).size(size)
                .barcode("893850" + skuId).build();
        return Inventory.builder().id(id).variant(variant).physicalStock(10).reservedStock(2).availableStock(8)
                .minThreshold(5).updatedAt(LocalDateTime.of(2026, 11, 7, 9, 30)).build();
    }
}
