#!/usr/bin/env bash
# Live composed-search pilot check: Next -> Boot -> FastAPI -> frozen core.
# UPLOAD branch plus exact-PRODUCT branch with anchor exclusion, against the
# pinned 600-product Dataset A pilot. Technical integration only, not a
# retrieval-quality evaluation.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
data_root="${FASEARCH_DATA_ROOT:-$repo_root}"
query_image="$data_root/data/raw/dataset_a/images/11739.jpg"
web_origin="${FASEARCH_WEB_ORIGIN:-http://127.0.0.1:3000}"

if [[ ! -f "$query_image" ]]; then
  printf 'Missing pilot query image: %s\n' "$query_image" >&2
  exit 1
fi

csrf_token="$(curl --fail --silent --show-error -c /tmp/fasearch-composed-cj.txt \
  "$web_origin/api/auth/csrf" | jq -r .token)"
csrf_header="$(curl --fail --silent --show-error "$web_origin/api/auth/csrf" | jq -r .header_name)"

upload="$(curl --fail --silent --show-error -b /tmp/fasearch-composed-cj.txt \
  -H "$csrf_header: $csrf_token" \
  -F 'schema_version=1.0.0' \
  -F "image=@${query_image};type=image/jpeg" \
  -F 'modification_text=đổi sang màu xanh' \
  -F 'k=5' \
  "$web_origin/api/search/composed")"

printf '%s' "$upload" | jq -e '
  .schema_version == "1.0.0"
  and .mode == "COMPOSED"
  and .publication.catalog_snapshot_id == "catalog-20260908-pilot-v1"
  and .publication.model_version == "openai/clip-vit-base-patch32@092a3b7e3172+a6a0317b924b"
  and .publication.index_version == "faiss-flatip-week4-v1"
  and .requested_k == 5
  and .returned_k == (.results | length)
  and [.results[].rank] == [1, 2, 3, 4, 5]
  and .reference.type == "UPLOAD"
  and .provenance.artifact_scope == "PILOT_ONLY"
  and .provenance.text_overflow_policy == "REJECT_MODEL_LIMIT"
  and .provenance.self_match_policy == "NONE"
  and .provenance.fusion.fusion_version == "equal-weight-l2-v1"
  and .provenance.fusion.image_weight == 0.5
  and (.trace_id | length) > 0
' >/dev/null

first_image="$(printf '%s' "$upload" | jq -r '.results[0].image_url')"
curl --fail --silent --show-error -o /dev/null "$web_origin$first_image"

anchor_snapshot="$(printf '%s' "$upload" | jq -r .publication.catalog_snapshot_id)"
product="$(curl --fail --silent --show-error -b /tmp/fasearch-composed-cj.txt \
  -H "$csrf_header: $csrf_token" \
  -F 'schema_version=1.0.0' \
  -F 'anchor_product_id=11739' \
  -F 'anchor_product_version_id=dataset-a-11739-v1' \
  -F "anchor_catalog_snapshot_id=$anchor_snapshot" \
  -F 'modification_text=váy linen suông' \
  -F 'k=5' \
  "$web_origin/api/search/composed")"

printf '%s' "$product" | jq -e '
  .mode == "COMPOSED"
  and .reference.type == "PRODUCT"
  and .reference.product_id == "11739"
  and .provenance.self_match_policy == "EXCLUDE_ANCHOR_PRODUCT"
  and ([.results[].product_id] | index("11739") | not)
  and [.results[].rank] == ([range(1; (.results | length) + 1)])
' >/dev/null

printf '%s' "$upload" | jq '{
  status: "PASS",
  scope: "PILOT_ONLY technical integration",
  upload_trace_id: .trace_id,
  product_trace_id: $product.trace_id,
  publication,
  upload_top_ids: [.results[].product_id],
  product_top_ids: [$product.results[].product_id]
}' --argjson product "$product"
