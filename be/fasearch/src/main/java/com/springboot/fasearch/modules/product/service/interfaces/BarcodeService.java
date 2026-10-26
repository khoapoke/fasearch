package com.springboot.fasearch.modules.product.service.interfaces;

public interface BarcodeService {

    byte[] generateBarcodePngBytes(String barcodeText, int width, int height);

    String generateBarcodeBase64(String barcodeText, int width, int height);
}
