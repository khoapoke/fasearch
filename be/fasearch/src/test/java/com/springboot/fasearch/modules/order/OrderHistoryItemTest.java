package com.springboot.fasearch.modules.order;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.springboot.fasearch.common.enums.ProductStatus;
import com.springboot.fasearch.modules.order.dto.response.OrderItemRes;
import com.springboot.fasearch.modules.order.entity.OrderDetail;
import com.springboot.fasearch.modules.order.service.impl.OrderItemHistoryBuilder;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.entity.ProductVariant;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.shared.history.HistoryNameLookup;

/**
 * Chứng từ đơn hàng của SKU/sản phẩm đã xóa mềm vẫn hiển thị tên dùng được: tên đọc từ ảnh chụp
 * SQL gốc theo mã SKU, không đọc qua quan hệ JPA (nơi @SQLRestriction có thể làm trang đơn cũ lỗi 500).
 */
@ExtendWith(MockitoExtension.class)
class OrderHistoryItemTest {

    @Mock private ProductVariantRepository productVariantRepository;

    private OrderItemHistoryBuilder builder() {
        return new OrderItemHistoryBuilder(new HistoryNameLookup(productVariantRepository));
    }

    private static OrderDetail detail(Long skuId, int quantity, String price) {
        Product product = Product.builder().id(7L).productName("Áo đã xóa").status(ProductStatus.DISCONTINUED)
                .isDeleted(true).build();
        ProductVariant variant = ProductVariant.builder().id(skuId).product(product).color("Đen").size("L")
                .barcode("SP-7").isDeleted(true).build();
        return OrderDetail.builder()
                .variant(variant)
                .quantity(quantity)
                .unitPrice(new BigDecimal(price))
                .discountAmount(BigDecimal.ZERO)
                .pointsDiscountAmount(BigDecimal.ZERO)
                .build();
    }

    @Test
    void softDeletedSkuStillShowsItsNameFromTheNativeSnapshot() {
        // Ảnh chụp gốc vẫn trả về dòng của SKU/sản phẩm đã xóa mềm (SQL gốc không bị @SQLRestriction lọc).
        when(productVariantRepository.findHistorySnapshots(any())).thenReturn(List.<Object[]>of(
                new Object[] { 101L, "Áo đã xóa", "Đen", "L", "SP-7", "/images/a.jpg" }));

        List<OrderItemRes> items = builder().build(List.of(detail(101L, 2, "150000")));

        assertEquals(1, items.size());
        assertEquals(101L, items.get(0).getSkuId());
        assertEquals("Áo đã xóa", items.get(0).getProductName());
        assertEquals("Đen", items.get(0).getColor());
        assertEquals("L", items.get(0).getSize());
        assertEquals("/images/a.jpg", items.get(0).getImageUrl());
        assertEquals(new BigDecimal("300000"), items.get(0).getTotalPrice());
    }

    @Test
    void missingSnapshotFallsBackToAnUnknownLabelInsteadOfFailing() {
        when(productVariantRepository.findHistorySnapshots(any())).thenReturn(List.of());

        List<OrderItemRes> items = builder().build(List.of(detail(999L, 1, "10000")));

        assertEquals(HistoryNameLookup.UNKNOWN, items.get(0).getProductName());
        assertEquals(new BigDecimal("10000"), items.get(0).getTotalPrice());
    }

    @Test
    void emptyOrderLinesProduceAnEmptyListWithoutQuerying() {
        assertEquals(0, builder().build(List.of()).size());
        verify(productVariantRepository, never()).findHistorySnapshots(any());
    }
}
