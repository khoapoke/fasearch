package com.springboot.fasearch.modules.product.mapper;

import java.util.List;

import org.mapstruct.AfterMapping;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.Named;
import org.mapstruct.NullValuePropertyMappingStrategy;
import org.mapstruct.ReportingPolicy;

import com.springboot.fasearch.modules.product.dto.request.ProductCreateReq;
import com.springboot.fasearch.modules.product.dto.request.ProductUpdateReq;
import com.springboot.fasearch.modules.product.dto.request.VariantCreateReq;
import com.springboot.fasearch.modules.product.dto.request.VariantUpdateReq;
import com.springboot.fasearch.modules.product.dto.response.ProductDetailRes;
import com.springboot.fasearch.modules.product.dto.response.ProductRes;
import com.springboot.fasearch.modules.product.dto.response.VariantRes;
import com.springboot.fasearch.modules.brand.entity.Brand;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.entity.ProductVariant;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface ProductMapper {

    @Named("brandLogoUrl")
    default String brandLogoUrl(Brand brand) {
        return brand == null || brand.getLogoFileName() == null || brand.getLogoFileName().isBlank()
                ? null : "/api/v1/brands/" + brand.getSlug() + "/logo";
    }


    /** Provider placeholder color: Shopify default option title leaking into the color slot. */
    String SENTINEL_COLOR = "Default Title";

    /** Provider placeholder size: importer UNKNOWN marker for missing size dimension. */
    String SENTINEL_SIZE = "Không xác định";

    @Mapping(source = "id", target = "skuId")
    @Mapping(source = "product.id", target = "productId")
    VariantRes toVariantResponse(ProductVariant variant);

    @AfterMapping
    default void markOptionSentinels(ProductVariant variant, @MappingTarget VariantRes res) {
        res.setColorIsSentinel(SENTINEL_COLOR.equals(variant.getColor()));
        res.setSizeIsSentinel(SENTINEL_SIZE.equals(variant.getSize()));
    }

    List<VariantRes> toVariantResponseList(List<ProductVariant> variants);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "product", ignore = true)
    @Mapping(target = "isDeleted", ignore = true)
    ProductVariant toVariant(VariantCreateReq req);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "product", ignore = true)
    @Mapping(target = "isDeleted", ignore = true)
    void updateVariantFromReq(VariantUpdateReq req, @MappingTarget ProductVariant variant);

    @Mapping(source = "category.id", target = "categoryId")
    @Mapping(source = "category.categoryName", target = "categoryName")
    @Mapping(source = "brand.id", target = "brandId")
    @Mapping(source = "brand.name", target = "brandName")
    @Mapping(source = "brand.slug", target = "brandSlug")
    @Mapping(source = "brand", target = "brandLogoUrl", qualifiedByName = "brandLogoUrl")
    ProductRes toProductResponse(Product product);

    @Mapping(source = "category.id", target = "categoryId")
    @Mapping(source = "category.categoryName", target = "categoryName")
    @Mapping(source = "brand.id", target = "brandId")
    @Mapping(source = "brand.name", target = "brandName")
    @Mapping(source = "brand.slug", target = "brandSlug")
    @Mapping(source = "brand", target = "brandLogoUrl", qualifiedByName = "brandLogoUrl")
    @Mapping(source = "variants", target = "variants")
    ProductDetailRes toProductDetailResponse(Product product);

    @Mapping(target = "category", ignore = true)
    @Mapping(target = "brand", ignore = true)
    @Mapping(target = "variants", ignore = true)
    Product toProduct(ProductCreateReq req);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "category", ignore = true)
    @Mapping(target = "brand", ignore = true)
    @Mapping(target = "variants", ignore = true)
    void updateProductFromReq(ProductUpdateReq req, @MappingTarget Product product);
}
