package com.springboot.fasearch.modules.inventory;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;

import com.springboot.fasearch.common.enums.ProductStatus;
import com.springboot.fasearch.modules.inventory.dto.response.StockRes;
import com.springboot.fasearch.modules.inventory.entity.Inventory;
import com.springboot.fasearch.modules.inventory.mapper.InventoryMapper;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.entity.ProductVariant;

/** Stock responses carry the owner's product status so pickers can label discontinued SKUs. */
class StockProductStatusTest {

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
