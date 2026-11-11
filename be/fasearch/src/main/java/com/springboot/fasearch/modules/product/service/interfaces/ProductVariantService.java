package com.springboot.fasearch.modules.product.service.interfaces;

import java.util.List;

import com.springboot.fasearch.modules.inventory.dto.response.StockRes;
import com.springboot.fasearch.modules.product.dto.request.VariantCreateReq;
import com.springboot.fasearch.modules.product.dto.request.VariantUpdateReq;
import com.springboot.fasearch.modules.product.dto.response.BarcodeRes;
import com.springboot.fasearch.modules.product.dto.response.PosProductRes;
import com.springboot.fasearch.modules.product.dto.response.VariantRes;

public interface ProductVariantService {

    List<VariantRes> getVariantsByProductId(Long productId);

    VariantRes getVariantById(Long variantId);

    VariantRes addVariant(Long productId, VariantCreateReq req);

    VariantRes updateVariant(Long variantId, VariantUpdateReq req);

    void deleteVariant(Long variantId, String reason);

    BarcodeRes getBarcodeInfo(Long skuId);

    byte[] getBarcodeImageBytes(Long skuId);

    PosProductRes posLookup(String barcode);

    /** Quét mã vạch trong phiếu kho: khớp chính xác mã vạch (không phân biệt hoa thường), rồi mã SKU. Chưa có dòng tồn kho thì số lượng là 0. */
    StockRes scanLookup(String code);

    List<PosProductRes> posSearch(String keyword);
}
