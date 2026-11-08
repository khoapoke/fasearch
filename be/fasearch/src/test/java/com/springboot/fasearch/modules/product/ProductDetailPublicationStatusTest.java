package com.springboot.fasearch.modules.product;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.brand.repository.BrandRepository;
import com.springboot.fasearch.modules.inventory.repository.InventoryRepository;
import com.springboot.fasearch.modules.product.dto.request.ProductUpdateReq;
import com.springboot.fasearch.modules.product.dto.response.ProductDetailRes;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.mapper.ProductMapper;
import com.springboot.fasearch.modules.product.repository.CategoryRepository;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;
import com.springboot.fasearch.modules.product.service.impl.ProductServiceImpl;
import com.springboot.fasearch.modules.publish.entity.PublicationStatus;

/** Admin detail must expose publicationStatus, and a published product refuses edits in Vietnamese. */
class ProductDetailPublicationStatusTest {

    @Test
    void detailResponseCarriesPublicationStatus() {
        ProductMapper mapper = Mappers.getMapper(ProductMapper.class);
        Product product = new Product();
        product.setPublicationStatus(PublicationStatus.UNPUBLISHED);
        ProductDetailRes res = mapper.toProductDetailResponse(product);
        assertEquals(PublicationStatus.UNPUBLISHED, res.getPublicationStatus());
    }

    @Test
    void editingPublishedProductGivesVietnameseConflict() {
        ProductRepository repo = mock(ProductRepository.class);
        Product product = new Product();
        product.setPublicationStatus(PublicationStatus.PUBLISHED);
        when(repo.findById(5L)).thenReturn(Optional.of(product));
        ProductServiceImpl service = new ProductServiceImpl(repo, mock(ProductVariantRepository.class),
                mock(InventoryRepository.class), mock(CategoryRepository.class),
                mock(BrandRepository.class), mock(ProductMapper.class),
                mock(com.springboot.fasearch.modules.trash.service.impl.DeleteGuards.class),
                new com.springboot.fasearch.common.softdelete.SoftDeleteRecorder(mock(com.springboot.fasearch.modules.auth.repository.AccountRepository.class)));
        AppException error = assertThrows(AppException.class, () -> service.updateProduct(5L, new ProductUpdateReq()));
        assertEquals(ErrorCode.DATA_CONFLICT, error.getErrorCode());
        assertTrue(error.getMessage().startsWith("Sản phẩm đang xuất bản"));
    }
}
