package com.springboot.fasearch.modules.inventory;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Method;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;

import com.springboot.fasearch.modules.inventory.repository.InventoryRepository;

/**
 * Tổng hợp tồn kho phải loại dòng của SKU/sản phẩm đã xóa mềm, nếu không Overview và
 * stock-summary sẽ cao hơn danh sách nhìn thấy được. Kiểm tra thẳng JPQL của từng câu
 * tổng hợp (không có test DB riêng để dựng dữ liệu thật trong lane này).
 */
class StockTotalsSoftDeleteTest {

    private static String queryOf(String methodName, Class<?>... parameters) throws Exception {
        Method method = InventoryRepository.class.getMethod(methodName, parameters);
        Query query = method.getAnnotation(Query.class);
        assertTrue(query != null, methodName + " must declare @Query");
        return query.value();
    }

    @Test
    void everyAggregateExcludesSoftDeletedVariantsAndProducts() throws Exception {
        List<String> aggregates = List.of("countLive", "countOutOfStock", "countLowStock", "countHealthyStock",
                "sumPhysical", "sumReserved", "sumAvailable");
        for (String name : aggregates) {
            String jpql = queryOf(name);
            assertTrue(jpql.contains("i.isDeleted = false"), name + " must keep live stock rows only: " + jpql);
            assertTrue(jpql.contains("i.variant.isDeleted = false"),
                    name + " must exclude soft-deleted SKUs: " + jpql);
            assertTrue(jpql.contains("i.variant.product.isDeleted = false"),
                    name + " must exclude SKUs of soft-deleted products: " + jpql);
        }
    }

    @Test
    void exceptionListUsesTheSameLiveRowFilterAsTheTotals() throws Exception {
        String jpql = queryOf("findExceptions", org.springframework.data.domain.Pageable.class);
        assertTrue(jpql.contains("i.variant.isDeleted = false"), jpql);
        assertTrue(jpql.contains("i.variant.product.isDeleted = false"), jpql);
    }
}
