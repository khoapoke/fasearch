package com.springboot.fasearch.modules.search.dto.request;

import com.springboot.fasearch.common.enums.SearchMode;
import com.springboot.fasearch.common.enums.SearchStatus;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SearchHistoryReq {

    @NotNull(message = "Chế độ tìm kiếm không được để trống")
    private SearchMode mode;

    @Size(max = 500, message = "Truy vấn không được vượt quá 500 ký tự")
    private String query;

    private Integer resultCount;

    @Size(max = 4096, message = "Tham chiếu kết quả không được vượt quá 4096 ký tự")
    private String resultRefs;

    @NotNull(message = "Trạng thái tìm kiếm không được để trống")
    private SearchStatus status;
}