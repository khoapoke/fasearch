package com.springboot.fasearch.modules.product;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.springboot.fasearch.common.softdelete.SoftDeleteRecorder;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.inventory.dto.response.StockRes;
import com.springboot.fasearch.modules.inventory.entity.Inventory;
import com.springboot.fasearch.modules.inventory.repository.InventoryRepository;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.entity.ProductVariant;
import com.springboot.fasearch.modules.product.mapper.ProductMapper;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.modules.product.service.impl.ProductVariantServiceImpl;
import com.springboot.fasearch.modules.product.service.interfaces.BarcodeService;
import com.springboot.fasearch.modules.trash.service.impl.DeleteGuards;

/** Scanner lookup: exact barcode first, then SKU id; a SKU without a stock row reads as 0; unknown or blank is refused. */
class ScanLookupTest {

    private final ProductVariantRepository variants = mock(ProductVariantRepository.class);
    private final InventoryRepository inventories = mock(InventoryRepository.class);
    private final ProductVariantServiceImpl service = new ProductVariantServiceImpl(
            mock(ProductRepository.class), variants, mock(ProductMapper.class), mock(BarcodeService.class),
            mock(DeleteGuards.class), mock(SoftDeleteRecorder.class), inventories);

    private ProductVariant variant(long id, String barcode) {
        Product p = new Product();
        p.setId(7L);
        p.setProductName("Áo thử");
        ProductVariant v = new ProductVariant();
        v.setId(id);
        v.setProduct(p);
        v.setColor("Đen");
        v.setSize("M");
        v.setBarcode(barcode);
        return v;
    }

    @Test
    void exactBarcodeBeatsSkuId() {
        ProductVariant byCode = variant(11L, "4006381333931");
        when(variants.findByBarcodeIgnoreCase("4006381333931")).thenReturn(Optional.of(byCode));
        Inventory inv = new Inventory();
        inv.setPhysicalStock(5); inv.setReservedStock(2); inv.setAvailableStock(3);
        when(inventories.findByVariantId(11L)).thenReturn(Optional.of(inv));
        StockRes r = service.scanLookup("  4006381333931 ");
        assertEquals(11L, r.getSkuId());
        assertEquals(3, r.getAvailableStock());
        assertEquals(5, r.getPhysicalStock());
        verify(variants, never()).findById(anyLong());
    }

    @Test
    void fallsBackToSkuIdAndMissingStockRowIsZero() {
        when(variants.findByBarcodeIgnoreCase("21715")).thenReturn(Optional.empty());
        when(variants.findById(21715L)).thenReturn(Optional.of(variant(21715L, "X")));
        when(inventories.findByVariantId(21715L)).thenReturn(Optional.empty());
        StockRes r = service.scanLookup("21715");
        assertEquals(21715L, r.getSkuId());
        assertEquals(0, r.getAvailableStock());
        assertEquals(0, r.getPhysicalStock());
    }

    @Test
    void unknownCodeIsNotFoundAndNonNumericNeverTriesSkuId() {
        when(variants.findByBarcodeIgnoreCase("NOPE")).thenReturn(Optional.empty());
        AppException e = assertThrows(AppException.class, () -> service.scanLookup("NOPE"));
        assertEquals(ErrorCode.VARIANT_NOT_FOUND, e.getErrorCode());
        verify(variants, never()).findById(anyLong());
    }

    @Test
    void blankIsRejected() {
        assertThrows(AppException.class, () -> service.scanLookup("   "));
        assertThrows(AppException.class, () -> service.scanLookup(null));
    }
}
