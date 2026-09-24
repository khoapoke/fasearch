package com.fasearch.backend.catalog;

public interface CatalogObjectStore {

	String put(String key, byte[] bytes, String mediaType);

	byte[] read(String storageUri);

	void delete(String storageUri);
}
