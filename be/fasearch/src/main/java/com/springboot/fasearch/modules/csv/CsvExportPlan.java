package com.springboot.fasearch.modules.csv;

import java.io.IOException;
import java.io.OutputStream;

/**
 * A prepared export: the row count is known (and checked against the cap) before the response
 * starts streaming, so a refusal still reaches the client as a normal API error.
 *
 * @param filename ASCII file name with the dataset and the export date only
 * @param rows     number of data rows the stream will contain
 * @param content  writes the rows to the response body
 */
public record CsvExportPlan(String filename, long rows, Content content) {

    @FunctionalInterface
    public interface Content {
        void writeTo(OutputStream out) throws IOException;
    }
}
