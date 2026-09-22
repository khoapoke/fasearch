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
