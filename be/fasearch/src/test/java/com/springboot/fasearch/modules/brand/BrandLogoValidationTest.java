package com.springboot.fasearch.modules.brand;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.modules.brand.service.impl.BrandServiceImpl;

class BrandLogoValidationTest {
    @Test
    void safeSvgIsAccepted() {
        String svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M0 0h1v1z\"/></svg>";
        assertEquals("image/svg+xml", BrandServiceImpl.validatedContentType("nike.svg", svg.getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void activeSvgIsRejected() {
        String svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>";
        assertThrows(AppException.class, () -> BrandServiceImpl.validatedContentType("bad.svg", svg.getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void mismatchedPngIsRejected() {
        assertThrows(AppException.class, () -> BrandServiceImpl.validatedContentType("logo.png", "not-png".getBytes(StandardCharsets.UTF_8)));
    }
}
