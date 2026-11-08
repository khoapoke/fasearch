package com.springboot.fasearch.modules.csv.controller;

import java.io.IOException;

import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.springboot.fasearch.modules.csv.dto.response.CsvImportRes;
import com.springboot.fasearch.modules.csv.service.interfaces.CsvProductImportService;
import com.springboot.fasearch.shared.ApiResponse;

import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

/**
 * Product CSV import: a dry run that only validates, an apply that writes drafts atomically, and
 * the Vietnamese template. Only ADMIN and STAFF may call it.
 */
@RestController
@RequestMapping("/api/v1/admin/csv/products")
@PreAuthorize("hasAuthority('PERM_PRODUCT_IMPORT')")
@SecurityRequirement(name = "BearerAuth")
@RequiredArgsConstructor
public class CsvProductImportController {

    private static final String CSV_CONTENT_TYPE = "text/csv; charset=UTF-8";

    private final CsvProductImportService csvProductImportService;

    @PostMapping(value = "/import", consumes = "multipart/form-data")
    @PreAuthorize("hasAuthority('PERM_PRODUCT_IMPORT')")
    public ApiResponse<CsvImportRes> importProducts(
            @RequestParam("file") MultipartFile file,
            @RequestParam(name = "dryRun", defaultValue = "false") boolean dryRun,
            @RequestParam(name = "checksum", required = false) String checksum) {
        CsvImportRes result = dryRun
                ? csvProductImportService.dryRun(file)
                : csvProductImportService.apply(file, checksum);
        return ApiResponse.success(200,
                dryRun ? "Kiểm tra tệp CSV hoàn tất" : "Đã tạo bản nháp từ tệp CSV", result);
    }

    @GetMapping("/template")
    @PreAuthorize("hasAuthority('PERM_PRODUCT_IMPORT')")
    public void template(HttpServletResponse response) throws IOException {
        CsvProductImportService.CsvTemplate template = csvProductImportService.template();
        response.setStatus(HttpServletResponse.SC_OK);
        response.setContentType(CSV_CONTENT_TYPE);
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"" + template.filename() + "\"");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        response.getOutputStream().write(template.content());
        response.flushBuffer();
    }
}
