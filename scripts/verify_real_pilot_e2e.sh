#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
query_image="$repo_root/data/raw/dataset_a/images/11739.jpg"
web_origin="${FASEARCH_WEB_ORIGIN:-http://127.0.0.1:3000}"

if [[ ! -f "$query_image" ]]; then
  printf 'Missing pilot query image: %s\n' "$query_image" >&2
  exit 1
fi

response="$(curl --fail --silent --show-error \
  -F "image=@${query_image};type=image/jpeg" \
  -F 'k=5' \
  "$web_origin/api/search/image")"

printf '%s' "$response" | jq -e '
  .schema_version == "1.0.0"
  and .mode == "IMAGE"
  and .publication.catalog_snapshot_id == "catalog-20260908-pilot-v1"
  and .publication.model_version == "openai/clip-vit-base-patch32@092a3b7e3172+a6a0317b924b"
  and .publication.index_version == "faiss-flatip-week4-v1"
  and (.results | length) == 5
  and [.results[].rank] == [1, 2, 3, 4, 5]
  and .results[0].product_id == "11739"
  and .results[0].product_version_id == "dataset-a-11739-v1"
' >/dev/null

image_url="$(printf '%s' "$response" | jq -r '.results[0].image_url')"
case "$image_url" in
  /api/catalog/images/11739/dataset-a-11739-v1) ;;
  *) printf 'Unexpected product image URL: %s\n' "$image_url" >&2; exit 1 ;;
esac

actual_sha="$(curl --fail --silent --show-error "$web_origin$image_url" | shasum -a 256 | cut -d ' ' -f 1)"
expected_sha="$(shasum -a 256 "$query_image" | cut -d ' ' -f 1)"
if [[ "$actual_sha" != "$expected_sha" ]]; then
  printf 'Product image checksum mismatch\n' >&2
  exit 1
fi

printf '%s' "$response" | jq '{
  status: "PASS",
  scope: "PILOT_ONLY technical integration",
  trace_id,
  publication,
  ranked_product_ids: [.results[].product_id],
  image_sha256: "verified against local dataset",
  latency
}'
