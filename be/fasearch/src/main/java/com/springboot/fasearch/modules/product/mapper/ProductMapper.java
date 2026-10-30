package com.springboot.fasearch.modules.product.mapper;

import java.util.List;

import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;
import org.mapstruct.ReportingPolicy;

import com.springboot.fasearch.modules.product.dto.request.ProductCreateReq;
import com.springboot.fasearch.modules.product.dto.request.ProductUpdateReq;
import com.springboot.fasearch.modules.product.dto.request.VariantCreateReq;
import com.springboot.fasearch.modules.product.dto.request.VariantUpdateReq;
import com.springboot.fasearch.modules.product.dto.response.ProductDetailRes;
import com.springboot.fasearch.modules.product.dto.response.ProductRes;
import com.springboot.fasearch.modules.product.dto.response.VariantRes;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.entity.ProductVariant;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface ProductMapper {

    @Mapping(source = "id", target = "skuId")
    @Mapping(source = "product.id", target = "productId")
    VariantRes toVariantResponse(ProductVariant variant);

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
    ProductRes toProductResponse(Product product);

    @Mapping(source = "category.id", target = "categoryId")
    @Mapping(source = "category.categoryName", target = "categoryName")
    @Mapping(source = "variants", target = "variants")
    ProductDetailRes toProductDetailResponse(Product product);

    @Mapping(target = "category", ignore = true)
    @Mapping(target = "variants", ignore = true)
    Product toProduct(ProductCreateReq req);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "category", ignore = true)
    @Mapping(target = "variants", ignore = true)
    void updateProductFromReq(ProductUpdateReq req, @MappingTarget Product product);
}
