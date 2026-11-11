package com.springboot.fasearch.modules.csv.service.interfaces;

import org.springframework.web.multipart.MultipartFile;

import com.springboot.fasearch.modules.csv.dto.response.CsvImportRes;

/**
 * Product CSV import (D9/D10): products only, always as drafts, never stock and never published.
 * The dry run validates and writes nothing; apply re-validates and writes every draft in one
 * transaction or none.
 */
public interface CsvProductImportService {

    CsvImportRes dryRun(MultipartFile file);

    CsvImportRes apply(MultipartFile file, String expectedChecksum);

    CsvTemplate template();

    record CsvTemplate(String filename, byte[] content) {
    }
}
