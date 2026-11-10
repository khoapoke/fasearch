package com.springboot.fasearch.modules.inventory;

import org.mapstruct.factory.Mappers;
import com.springboot.fasearch.common.enums.ProductStatus;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.entity.ProductVariant;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.modules.inventory.dto.response.StockRes;
import com.springboot.fasearch.modules.inventory.dto.response.StockSummaryRes;
import com.springboot.fasearch.modules.inventory.entity.Inventory;
import com.springboot.fasearch.modules.inventory.mapper.InventoryMapper;
import com.springboot.fasearch.modules.inventory.repository.InventoryRepository;
import com.springboot.fasearch.modules.inventory.service.impl.InventoryServiceImpl;

/**
 * The Overview summary must come from whole-catalog aggregates (never a page slice) and must keep
 * out-of-stock vs low-stock vs healthy distinct, with a bounded, deterministic exception list.
 */
@ExtendWith(MockitoExtension.class)
class StockSummaryTest {

    @Mock private InventoryRepository inventoryRepository;
    @Mock private InventoryMapper inventoryMapper;
    @InjectMocks private InventoryServiceImpl service;

    @Test
    void aggregatesComeFromRepositoryNotPageSize() {
        when(inventoryRepository.countLive()).thenReturn(12001L);
        when(inventoryRepository.countOutOfStock()).thenReturn(6460L);
        when(inventoryRepository.countLowStock()).thenReturn(4808L);
        when(inventoryRepository.countHealthyStock()).thenReturn(733L);
        when(inventoryRepository.sumPhysical()).thenReturn(20000L);
        when(inventoryRepository.sumReserved()).thenReturn(72L);
        when(inventoryRepository.sumAvailable()).thenReturn(13640L);
        when(inventoryRepository.findExceptions(any())).thenReturn(List.of());
        when(inventoryMapper.toStockResponseList(any())).thenReturn(List.of());

        StockSummaryRes summary = service.getStockSummary(20);

        assertEquals(12001L, summary.getTotalSkus());
        assertEquals(6460L, summary.getOutOfStock());
        assertEquals(4808L, summary.getLowStock());
        assertEquals(733L, summary.getHealthyStock());
        // exceptions total is the real out+low sum, independent of the page limit
        assertEquals(6460L + 4808L, summary.getExceptionsTotal());
        assertEquals(20, summary.getLimit());
        assertTrue(summary.getExceptions().isEmpty());
    }

    @Test
    void exceptionListIsBoundedButTotalIsNot() {
        StockRes one = StockRes.builder().skuId(7L).availableStock(0).build();
        when(inventoryRepository.countOutOfStock()).thenReturn(6460L);
        when(inventoryRepository.countLowStock()).thenReturn(0L);
        when(inventoryRepository.findExceptions(any())).thenReturn(List.of(new Inventory()));
        when(inventoryMapper.toStockResponseList(any())).thenReturn(List.of(one));

        StockSummaryRes summary = service.getStockSummary(5);

        assertEquals(6460L, summary.getExceptionsTotal());
        assertEquals(1, summary.getExceptions().size());
        assertEquals(7L, summary.getExceptions().get(0).getSkuId());
    }

    @Test
    void limitIsValidated() {
        assertThrows(AppException.class, () -> service.getStockSummary(0));
        assertThrows(AppException.class, () -> service.getStockSummary(51));
    }


    private final InventoryMapper mapper = Mappers.getMapper(InventoryMapper.class);

    private Inventory row(Long skuId, ProductStatus status) {
        Product product = Product.builder().id(7L).productName("Quần jeans basic").status(status).build();
        ProductVariant variant = ProductVariant.builder().id(skuId).product(product).color("Den").size("M").build();
        return Inventory.builder().id(skuId).variant(variant)
                .physicalStock(5).reservedStock(0).availableStock(5).minThreshold(10).build();
    }

    @Test
    void discontinuedStatusIsMapped() {
        StockRes res = mapper.toStockResponse(row(99L, ProductStatus.DISCONTINUED));
        assertEquals(99L, res.getSkuId());
        assertEquals(ProductStatus.DISCONTINUED, res.getProductStatus());
    }

    @Test
    void activeStatusIsMappedForList() {
        List<StockRes> out = mapper.toStockResponseList(List.of(row(100L, ProductStatus.ACTIVE)));
        assertEquals(1, out.size());
        assertEquals(ProductStatus.ACTIVE, out.get(0).getProductStatus());
    }

}
