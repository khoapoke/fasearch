package com.springboot.fasearch.shared.history;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.springboot.fasearch.modules.product.repository.ProductVariantRepository;

import lombok.RequiredArgsConstructor;

/**
 * Tên hiển thị cho chứng từ đã lập (đơn hàng, phiếu nhập/xuất, phiếu kiểm kê).
 *
 * <p>Không đọc qua quan hệ JPA: {@code @SQLRestriction("da_xoa = false")} trên biến thể và sản phẩm
 * có thể làm proxy không nạp được khi SKU/sản phẩm đã xóa mềm (lỗi 500 khi mở chứng từ cũ).
 * Thay vào đó đọc thẳng bảng bằng SQL gốc, nên chứng từ cũ luôn còn tên dùng được.
 */
@Component
@RequiredArgsConstructor
public class HistoryNameLookup {

    /** Nhãn dùng khi dòng gốc không còn trong CSDL (hiếm: chỉ khi bị xóa vật lý ngoài ứng dụng). */
    public static final String UNKNOWN = "Không rõ";

    private final ProductVariantRepository productVariantRepository;

    public record HistoryName(Long skuId, String productName, String color, String size, String barcode,
            String imageUrl) {
    }

    public Map<Long, HistoryName> bySkuIds(Collection<Long> skuIds) {
        Map<Long, HistoryName> result = new HashMap<>();
        if (skuIds == null || skuIds.isEmpty()) {
            return result;
        }
        for (Object[] row : productVariantRepository.findHistorySnapshots(skuIds)) {
            Long skuId = row[0] instanceof Number number ? number.longValue() : null;
            if (skuId == null) {
                continue;
            }
            String productName = text(row[1]);
            result.put(skuId, new HistoryName(
                    skuId,
                    productName == null ? UNKNOWN : productName,
                    text(row[2]),
                    text(row[3]),
                    text(row[4]),
                    text(row[5])));
        }
        return result;
    }

    public HistoryName of(Map<Long, HistoryName> snapshots, Long skuId) {
        HistoryName found = skuId == null ? null : snapshots.get(skuId);
        return found != null ? found : new HistoryName(skuId, UNKNOWN, null, null, null, null);
    }

    private static String text(Object value) {
        return value == null ? null : value.toString();
    }
}
