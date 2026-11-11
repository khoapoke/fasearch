package com.springboot.fasearch.modules.csv.dto.response;

import java.util.List;

import com.springboot.fasearch.modules.csv.CsvImportRowError;

/**
 * Result of a CSV product dry run or apply. Errors carry the record number (header is row 1),
 * the column name and a Vietnamese message. Drafts are only present after an apply.
 */
public record CsvImportRes(
        String checksum,
        int totalRows,
        int validRows,
        int productCount,
        int errorCount,
        boolean truncated,
        List<CsvImportRowError> errors,
        List<CsvImportDraftRes> drafts) {
}
