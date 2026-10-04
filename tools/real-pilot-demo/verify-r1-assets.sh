#!/usr/bin/env bash
# R1: Exact assets usable and immutable. Uses absolute root assets, no rewrite.
set -uo pipefail
ASSET_ROOT="/Users/khoado/Documents/ChatGPT/Graduate Bachelor"
OUT="${1:-/tmp/rp-r1.log}"
: > "$OUT"
pass=0; fail=0
log(){ echo "$@" | tee -a "$OUT"; }
check(){ if [[ "$2" == "$3" ]]; then pass=$((pass+1)); log "PASS: $1 (=$3)"; else fail=$((fail+1)); log "FAIL: $1 expected=$2 actual=$3"; fi; }
log "== HEAD =="; git -C /private/tmp/fasearch-real-pilot-integrated-demo rev-parse HEAD | tee -a "$OUT"
log "== verifier 600x512 =="
"/Users/khoado/Documents/ChatGPT/Graduate Bachelor/.venv/bin/python" "$ASSET_ROOT/ai/scripts/verify_week4_artifacts.py" \
  --catalog "$ASSET_ROOT/data/processed/catalog-20260908-pilot-v1/catalog.cleaned.v1.jsonl" \
  --embeddings-dir "$ASSET_ROOT/artifacts/embeddings/week4-baseline-20260908-v1" \
  --index-dir "$ASSET_ROOT/artifacts/indexes/week4-baseline-20260908-v1" 2>&1 | tee -a "$OUT"
[[ ${PIPESTATUS[0]} == 0 ]] && { pass=$((pass+1)); log "PASS: verifier exit 0"; } || { fail=$((fail+1)); log "FAIL: verifier exit"; }
check "catalog sha" "82b21a099c92dbf42eca43475e6cea5459da3c3ff27fc528589ad85517f9da44" "$(sha256sum "$ASSET_ROOT/data/processed/catalog-20260908-pilot-v1/catalog.cleaned.v1.jsonl" | cut -d' ' -f1)"
check "mapping sha" "4ef3bb9ceb69955f02a1ca3347f000194e1d5fe027115e24ca38cb3f61decf6b" "$(sha256sum "$ASSET_ROOT/artifacts/indexes/week4-baseline-20260908-v1/row-to-product.v1.jsonl" | cut -d' ' -f1)"
check "config sha" "47c89a1911e2bcfd2def03778cdbefd8447b63eff2e419eb43ea190a424127f8" "$(sha256sum "$ASSET_ROOT/ai/configs/baseline.v1.yaml" | cut -d' ' -f1)"
IDS=$(python3 -c "import json; rows=[json.loads(l) for l in open('$ASSET_ROOT/data/processed/catalog-20260908-pilot-v1/catalog.cleaned.v1.jsonl')]; print(len(set(r['product_id'] for r in rows)), len(rows))")
check "600 unique identities" "600 600" "$IDS"
MISSING=$(python3 -c "import json,os; rows=[json.loads(l) for l in open('$ASSET_ROOT/data/processed/catalog-20260908-pilot-v1/catalog.cleaned.v1.jsonl')]; print(sum(1 for r in rows if not os.path.isfile(r['image_path'])))")
check "600 images present" "0" "$MISSING"
check "weights 605247071" "605247071" "$(stat -L -f%z "$ASSET_ROOT/.cache/huggingface/hub/models--openai--clip-vit-base-patch32/snapshots/092a3b7e31726acc3a0207eea00f6040ac8b03a7/pytorch_model.bin")"
log "RESULT pass=$pass fail=$fail"
[[ $fail == 0 ]]
