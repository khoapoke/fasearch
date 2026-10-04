export type FashionCategory = "TOP" | "BOTTOM" | "ONE_PIECE";

export interface Publication {
  catalog_snapshot_id: string;
  model_version: string;
  index_version: string;
}

export interface SearchProduct {
  product_id: string;
  product_version_id: string;
  rank: number;
  similarity_score: number;
  title: string;
  category: FashionCategory;
  image_url: string;
}

export interface ImageSearchResponse {
  schema_version: "1.0.0";
  trace_id: string;
  mode: "IMAGE";
  publication: Publication;
  results: SearchProduct[];
  latency: {
    ai_latency_ms: number;
    total_latency_ms: number;
  };
}

export interface SearchError {
  schema_version: string;
  trace_id: string | null;
  code: string;
  message: string;
}

export interface ComposedReference {
  type: "UPLOAD" | "PRODUCT";
  product_id?: string;
  product_version_id?: string;
  catalog_snapshot_id?: string;
}

export interface ComposedFusion {
  fusion_version: string;
  strategy: string;
  image_weight: number;
  text_weight: number;
  component_normalization: string;
  output_normalization: string;
  similarity_metric: string;
}

export interface ComposedProvenance {
  artifact_scope: string;
  model_config_hash: string;
  text_normalization_version: string;
  text_overflow_policy: "REJECT_MODEL_LIMIT" | "RAW_CAP_ONLY";
  self_match_policy: "NONE" | "EXCLUDE_ANCHOR_PRODUCT";
  fusion: ComposedFusion;
}

export interface ComposedSearchResponse {
  schema_version: "1.0.0";
  trace_id: string;
  mode: "COMPOSED";
  publication: Publication;
  requested_k: number;
  returned_k: number;
  reference: ComposedReference;
  provenance: ComposedProvenance;
  results: SearchProduct[];
  latency: {
    ai_latency_ms: number;
    total_latency_ms: number;
  };
}

export type ComposedSearchErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_IMAGE"
  | "IMAGE_TOO_LARGE"
  | "TEXT_TOO_LONG"
  | "ANCHOR_PUBLICATION_MISMATCH"
  | "ANCHOR_NOT_AVAILABLE"
  | "CATALOG_UNAVAILABLE"
  | "AI_UNAVAILABLE"
  | "AI_TIMEOUT"
  | "AI_PUBLICATION_MISMATCH"
  | "AI_FUSION_MISMATCH"
  | "AI_CONTRACT_MISMATCH"
  | "CATALOG_VERSION_MISMATCH";

export interface ComposedSearchError {
  schema_version: string;
  trace_id: string | null;
  code: ComposedSearchErrorCode | string;
  message: string;
}

export interface TextProvenance {
  artifact_scope: string;
  model_config_hash: string;
  text_normalization_version: string;
  text_overflow_policy: "REJECT_MODEL_LIMIT" | "RAW_CAP_ONLY";
}

export interface TextSearchResponse {
  schema_version: "1.0.0";
  trace_id: string;
  mode: "TEXT";
  publication: Publication;
  requested_k: number;
  returned_k: number;
  provenance: TextProvenance;
  results: SearchProduct[];
  latency: {
    ai_latency_ms: number;
    total_latency_ms: number;
  };
}

export type TextSearchErrorCode =
  | "INVALID_REQUEST"
  | "TEXT_TOO_LONG"
  | "AI_UNAVAILABLE"
  | "AI_TIMEOUT"
  | "AI_PUBLICATION_MISMATCH"
  | "AI_CONTRACT_MISMATCH"
  | "CATALOG_VERSION_MISMATCH";

export interface TextSearchError {
  schema_version: string;
  trace_id: string | null;
  code: TextSearchErrorCode | string;
  message: string;
}
