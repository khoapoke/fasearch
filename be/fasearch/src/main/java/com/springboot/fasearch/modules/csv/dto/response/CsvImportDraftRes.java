package com.springboot.fasearch.modules.csv.dto.response;

/** A draft created by an import; the id links to the existing draft screen. */
public record CsvImportDraftRes(long draftId, String productName, int skuCount) {
}
