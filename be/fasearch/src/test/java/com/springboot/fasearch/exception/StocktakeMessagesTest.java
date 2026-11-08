package com.springboot.fasearch.exception;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

/** Stocktake errors reach admins verbatim, so they must be Vietnamese. */
class StocktakeMessagesTest {

    @Test
    void stocktakeNotFoundIsVietnamese() {
        assertEquals("Không tìm thấy phiếu kiểm kê", ErrorCode.STOCKTAKE_NOT_FOUND.getMessage());
        assertEquals(404, ErrorCode.STOCKTAKE_NOT_FOUND.getCode());
    }

    @Test
    void invalidStocktakeRecordIsVietnamese() {
        assertEquals("Phiếu kiểm kê cần có ít nhất một dòng hợp lệ", ErrorCode.INVALID_STOCKTAKE_RECORD.getMessage());
    }
}
