package com.springboot.fasearch.modules.search.dto.response;

import java.math.BigDecimal;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.springboot.fasearch.common.enums.ProductStatus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Một kết quả tìm kiếm AI đã được "làm giàu" từ danh mục sản phẩm đang bán.
 * Chỉ chứa dữ liệu thẻ sản phẩm; không lộ tên tệp dataset, đường dẫn nội bộ hay nhãn kỹ thuật của index AI.
 */
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ProductSearchItemRes {

    /** Mã điểm vector trong index AI (dùng làm khóa ổn định cho UI, không hiển thị). */
    private String id;
    private double score;
    private Long productId;
    private String productName;
    private String brandName;
    private BigDecimal price;
    /** Đường dẫn ảnh chính theo catalog (/api/v1/products/images/...), null nếu chưa có ảnh. */
    private String imageUrl;
    /** Các màu còn hàng (đã loại giá trị placeholder), giữ thứ tự biến thể. */
    private List<String> colors;
    private ProductStatus status;
}
