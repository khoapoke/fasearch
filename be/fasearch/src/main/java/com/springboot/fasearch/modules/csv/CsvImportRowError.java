package com.springboot.fasearch.modules.csv;

/**
 * One row/column problem found while importing products. The same shape is returned in the dry
 * run response and in the apply refusal, so the UI can point at the exact cell.
 */
public record CsvImportRowError(int row, String column, String code, String message) {
}
