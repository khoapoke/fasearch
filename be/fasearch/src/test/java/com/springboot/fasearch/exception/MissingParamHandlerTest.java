package com.springboot.fasearch.exception;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MissingServletRequestParameterException;

import com.springboot.fasearch.shared.ApiResponse;

/** Missing required query params must be 400 with the parameter named — never 401. */
class MissingParamHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void missingYearIs400WithName() throws Exception {
        MissingServletRequestParameterException ex =
                new MissingServletRequestParameterException("year", "int");
        ResponseEntity<ApiResponse<Void>> res = handler.handleMissingServletRequestParameter(ex);
        assertEquals(400, res.getStatusCode().value());
        assertTrue(res.getBody().getMessage().contains("year"));
    }

    @Test
    void missingStartDateIs400WithName() throws Exception {
        MissingServletRequestParameterException ex =
                new MissingServletRequestParameterException("startDate", "LocalDate");
        ResponseEntity<ApiResponse<Void>> res = handler.handleMissingServletRequestParameter(ex);
        assertEquals(400, res.getStatusCode().value());
        assertTrue(res.getBody().getMessage().contains("startDate"));
    }
}
