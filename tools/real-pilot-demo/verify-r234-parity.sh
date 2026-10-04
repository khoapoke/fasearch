#!/usr/bin/env bash
# R2+R3+R4 core: live HF identity, 3-mode parity AI/Boot/Next, image bytes, PRODUCT, stale.
set -uo pipefail
# Env required: TASK_ADMIN_PASS (bootstrap admin password). Never echoes secrets.
OUT="${1:-/tmp/rp-r234.log}"
PASS_W="${TASK_ADMIN_PASS:?Set TASK_ADMIN_PASS}"
AI=http://127.0.0.1:18021; BOOT=http://127.0.0.1:18280; FE=http://127.0.0.1:3220
PUB_CATALOG=catalog-20260908-pilot-v1
PUB_MODEL="openai/clip-vit-base-patch32@092a3b7e3172+a6a0317b924b"
PUB_INDEX=faiss-flatip-week4-v1
: > "$OUT"
pass=0; fail=0
log(){ echo "$@" | tee -a "$OUT"; }
J=/tmp/rp-r234-$$; mkdir -p $J; chmod 700 $J
log "== HEAD =="; git -C /private/tmp/fasearch-real-pilot-integrated-demo rev-parse HEAD | tee -a "$OUT"
curl -s -c $J/adm.txt $BOOT/api/v1/auth/csrf > $J/c0.json
T0=$(python3 -c "import json;print(json.load(open('$J/c0.json'))['token'])")
curl -s -b $J/adm.txt -c $J/adm.txt -X POST $BOOT/api/v1/auth/login -H "X-CSRF-TOKEN: $T0" --data-urlencode "username=task-admin" --data-urlencode "password=$PASS_W" > /dev/null
TA=$(curl -s -b $J/adm.txt $BOOT/api/v1/auth/csrf | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])")
curl -s -c $J/g.txt $FE/api/auth/csrf > $J/cg.json
HN=$(python3 -c "import json;print(json.load(open('$J/cg.json'))['header_name'])")
TK=$(python3 -c "import json;print(json.load(open('$J/cg.json'))['token'])")

for QT in "red dress" "ao so mi trang"; do
  T="txt-$(echo "$QT" | md5 | cut -c1-6)"
  curl -s -X POST $AI/internal/v1/search/text -H 'Content-Type: application/json' -H "X-Trace-Id: $T" -d "{\"schema_version\":\"1.0.0\",\"query_text\":\"$QT\",\"k\":3,\"trace_id\":\"$T\",\"catalog_snapshot_id\":\"$PUB_CATALOG\",\"model_version\":\"$PUB_MODEL\",\"index_version\":\"$PUB_INDEX\"}" > $J/ai.json
  curl -s -b $J/adm.txt -X POST $BOOT/api/v1/search/text -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $TA" -H "X-Trace-Id: $T" -d "{\"schema_version\":\"1.0.0\",\"query_text\":\"$QT\",\"k\":3}" > $J/boot.json
  curl -s -b $J/g.txt -X POST $FE/api/search/text -H 'Content-Type: application/json' -H "$HN: $TK" -H "X-Trace-Id: $T" -d "{\"schema_version\":\"1.0.0\",\"query_text\":\"$QT\",\"k\":3}" > $J/next.json
  if python3 - "$J/ai.json" "$J/boot.json" "$J/next.json" >> "$OUT" 2>&1 <<'PY'
import json,sys
ai=json.load(open(sys.argv[1])); bo=json.load(open(sys.argv[2])); nx=json.load(open(sys.argv[3]))
assert ai["publication"]["model_version"]=="openai/clip-vit-base-patch32@092a3b7e3172+a6a0317b924b", ai["publication"]
assert ai["publication"]["catalog_snapshot_id"]=="catalog-20260908-pilot-v1"
assert ai["publication"]["index_version"]=="faiss-flatip-week4-v1"
assert ai["provenance"]["artifact_scope"]=="PILOT_ONLY"
assert ai["provenance"]["model_config_hash"]=="a6a0317b924b6bece0b9cc8887d0ee53c1bf4ac51c00797f7514dce3e0bfeac8"
assert ai["provenance"]["text_overflow_policy"]=="REJECT_MODEL_LIMIT"
ids=lambda d:[(r["product_id"],r.get("product_version_id") or r.get("productVersionId"),r["rank"]) for r in d["results"]]
assert ids(ai)==ids(bo)==ids(nx), (ids(ai),ids(bo),ids(nx))
sa=[r["similarity_score"] for r in ai["results"]]
sb=[r.get("similarity_score",r.get("similarityScore")) for r in bo["results"]]
sn=[r.get("similarity_score",r.get("similarityScore")) for r in nx["results"]]
assert all(abs(a-b)<=1e-5 for a,b in zip(sa,sb)), (sa,sb)
assert all(abs(a-b)<=1e-5 for a,b in zip(sa,sn)), (sa,sn)
print(f"PASS: TEXT parity '{ai.get('trace_id')}' order/count/scores<=1e-5")
PY
  then pass=$((pass+1)); else fail=$((fail+1)); log "FAIL: TEXT parity $QT"; fi
done

# IMAGE self-query mapping check + Next parity (11739 + second image 10011)
for IMG_ID in 11739 10011; do
  IMG="/Users/khoado/Documents/ChatGPT/Graduate Bachelor/data/raw/dataset_a/images/$IMG_ID.jpg"
  curl -s -X POST $AI/internal/v1/search/image -H "X-Trace-Id: img-$IMG_ID" -F "image=@$IMG;type=image/jpeg" -F 'k=3' -F "trace_id=img-$IMG_ID" -F "catalog_snapshot_id=$PUB_CATALOG" -F "model_version=$PUB_MODEL" -F "index_version=$PUB_INDEX" > $J/ai-img.json
  curl -s -b $J/g.txt -F "image=@$IMG;type=image/jpeg" -F 'k=3' -H "$HN: $TK" $FE/api/search/image > $J/nx-img.json
  if python3 - "$J/ai-img.json" "$J/nx-img.json" "$IMG_ID" >> "$OUT" 2>&1 <<'PY'
import json,sys
ai=json.load(open(sys.argv[1])); nx=json.load(open(sys.argv[2])); want=sys.argv[3]
assert ai["mode"]=="IMAGE" and nx["mode"]=="IMAGE"
assert ai["results"][0]["product_id"]==want, ai["results"][0]
assert abs(ai["results"][0]["similarity_score"]-1.0)<1e-3, ai["results"][0]
idsa=[(r["product_id"],r["rank"]) for r in ai["results"]]
idsn=[(r["product_id"],r["rank"]) for r in nx["results"]]
assert idsa==idsn, (idsa,idsn)
sa=[r["similarity_score"] for r in ai["results"]]; sn=[r["similarity_score"] for r in nx["results"]]
assert all(abs(a-b)<=1e-5 for a,b in zip(sa,sn))
print(f"PASS: IMAGE parity self {want} order/scores<=1e-5")
PY
  then pass=$((pass+1)); else fail=$((fail+1)); log "FAIL: IMAGE parity $IMG_ID"; fi
done

# COMPOSED UPLOAD + PRODUCT anchor exclusion
IMG="/Users/khoado/Documents/ChatGPT/Graduate Bachelor/data/raw/dataset_a/images/11739.jpg"
curl -s -b $J/adm.txt -X POST $BOOT/api/v1/search/composed -H "X-CSRF-TOKEN: $TA" -H "X-Trace-Id: cmp-u1" -F 'schema_version=1.0.0' -F "image=@$IMG;type=image/jpeg" -F 'modification_text=doi sang mau xanh' -F 'k=3' > $J/cmp-u.json
curl -s -X POST $AI/internal/v1/search/composed -H "X-Trace-Id: cmp-u1" -F 'schema_version=1.0.0' -F "image=@$IMG;type=image/jpeg" -F 'modification_text=doi sang mau xanh' -F 'k=3' -F 'trace_id=cmp-u1' -F 'fusion_version=equal-weight-l2-v1' -F "catalog_snapshot_id=$PUB_CATALOG" -F "model_version=$PUB_MODEL" -F "index_version=$PUB_INDEX" > $J/ai-cmp.json
if python3 - "$J/ai-cmp.json" "$J/cmp-u.json" >> "$OUT" 2>&1 <<'PY'
import json,sys
ai=json.load(open(sys.argv[1])); bo=json.load(open(sys.argv[2]))
assert bo["reference"]["type"]=="UPLOAD", bo["reference"]
idsa=[(r["product_id"],r["rank"]) for r in ai["results"]]; idsb=[(r["product_id"],r["rank"]) for r in bo["results"]]
assert idsa==idsb, (idsa,idsb)
sa=[r["similarity_score"] for r in ai["results"]]; sb=[r["similarity_score"] for r in bo["results"]]
assert all(abs(a-b)<=1e-5 for a,b in zip(sa,sb)), (sa,sb)
print("PASS: COMPOSED UPLOAD parity order/scores<=1e-5")
PY
then pass=$((pass+1)); else fail=$((fail+1)); log "FAIL: COMPOSED UPLOAD parity"; fi
curl -s -b $J/adm.txt -X POST $BOOT/api/v1/search/composed -H "X-CSRF-TOKEN: $TA" -H "X-Trace-Id: cmp-p1" -F 'schema_version=1.0.0' -F 'anchor_product_id=11739' -F 'anchor_product_version_id=dataset-a-11739-v1' -F "anchor_catalog_snapshot_id=$PUB_CATALOG" -F 'modification_text=doi sang mau xanh' -F 'k=3' > $J/cmp-p.json
if python3 - "$J/cmp-p.json" >> "$OUT" 2>&1 <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
assert d["reference"]["type"]=="PRODUCT" and d["reference"]["product_id"]=="11739", d["reference"]
assert all(r["product_id"]!="11739" for r in d["results"]), d["results"]
assert d["provenance"]["artifact_scope"]=="PILOT_ONLY"
print("PASS: COMPOSED PRODUCT anchor exclusion")
PY
then pass=$((pass+1)); else fail=$((fail+1)); log "FAIL: COMPOSED PRODUCT"; fi

# stale snapshot fail-closed + wrong version image 404
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST $AI/internal/v1/search/text -H 'Content-Type: application/json' -H 'X-Trace-Id: stale' -d "{\"schema_version\":\"1.0.0\",\"query_text\":\"dress\",\"k\":2,\"trace_id\":\"stale\",\"catalog_snapshot_id\":\"wrong\",\"model_version\":\"$PUB_MODEL\",\"index_version\":\"$PUB_INDEX\"}")
[[ "$CODE" == "409" ]] && { pass=$((pass+1)); log "PASS: stale snapshot 409"; } || { fail=$((fail+1)); log "FAIL: stale snapshot=$CODE"; }
CODE=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:18280/api/v1/catalog/images/11739/wrong-version)
[[ "$CODE" == "404" ]] && { pass=$((pass+1)); log "PASS: wrong version 404"; } || { fail=$((fail+1)); log "FAIL: wrong version=$CODE"; }

# image bytes vs catalog for top TEXT hit
TOP=$(python3 -c "import json;print(json.load(open('$J/boot.json'))['results'][0]['product_id'])")
VER=$(python3 -c "import json;print(json.load(open('$J/boot.json'))['results'][0]['product_version_id'])")
curl -s -o $J/top.jpg http://127.0.0.1:18280/api/v1/catalog/images/$TOP/$VER
CATALOG_SHA=$(python3 -c "import json; rows=[json.loads(l) for l in open('/Users/khoado/Documents/ChatGPT/Graduate Bachelor/data/processed/catalog-20260908-pilot-v1/catalog.cleaned.v1.jsonl')]; print([r['image_sha256'] for r in rows if r['product_id']=='$TOP'][0])")
SERVED_SHA=$(sha256sum $J/top.jpg | cut -d' ' -f1)
[[ "$CATALOG_SHA" == "$SERVED_SHA" ]] && { pass=$((pass+1)); log "PASS: image bytes $TOP match catalog"; } || { fail=$((fail+1)); log "FAIL: image bytes $TOP $SERVED_SHA vs $CATALOG_SHA"; }
rm -rf $J
log "RESULT pass=$pass fail=$fail"
[[ $fail == 0 ]]
