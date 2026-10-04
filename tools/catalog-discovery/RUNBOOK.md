# RUNBOOK — catalog-discovery (vận hành stack task)

Branch `codex/catalog-discovery`, checkout `/private/tmp/fasearch-catalog-discovery`.
Base `499d9eefb`, freeze HEAD `4dd21c8a7e382dd5541d1b1fa65b640e6be51a38`.

## Ports (đã verify trống trước khi dựng)

| Dịch vụ | Port | PID file |
| --- | --- | --- |
| FE (Next start) | 3230 | /private/tmp/fasearch-catalog-discovery-fe.pid |
| Boot (jar) | 18380 | /private/tmp/fasearch-catalog-discovery-boot.pid |
| AI (uvicorn) | 18031 | /private/tmp/fasearch-catalog-discovery-ai.pid |
| PostgreSQL (docker) | 55732 | container fasearch-catalog-discovery-pg |
| S3/seaweedfs (docker) | 38535 | container fasearch-catalog-discovery-s3 |

Preview cũ (3220/3210) và process lạ không bị chạm. Không sửa hosts/DNS.

## Lifecycle

Script: `tools/catalog-discovery/lifecycle.sh` (chạy từ bất kỳ cwd nào):

```bash
/private/tmp/fasearch-catalog-discovery/tools/catalog-discovery/lifecycle.sh start    # dựng PG/S3 + AI + Boot + FE, chờ health
/private/tmp/fasearch-catalog-discovery/tools/catalog-discovery/lifecycle.sh health   # AI/Boot/FE UP?
/private/tmp/fasearch-catalog-discovery/tools/catalog-discovery/lifecycle.sh warm     # 1 TEXT query thật qua AI
/private/tmp/fasearch-catalog-discovery/tools/catalog-discovery/lifecycle.sh restart  # stop rồi start
/private/tmp/fasearch-catalog-discovery/tools/catalog-discovery/lifecycle.sh stop     # kill đúng PID có guard + stop containers
```

Guards: refuse khi port đã có listener; kill chỉ khi `/proc` args khớp pattern task
(`backend-0.0.1-SNAPSHOT.jar`, `uvicorn fasearch_ai.main:app.*--port 18031`,
FE wrapper); Boot/AI có listener check; không broad pkill.

## Biến môi trường runtime (giống real-pilot, đổi ports/paths)

- Python: `/Users/khoado/Documents/ChatGPT/Graduate Bachelor/.venv/bin/python` (3.12.14)
- `HF_HOME=.cache/huggingface`, `HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1`
- Publication: `catalog-20260908-pilot-v1`, model
  `openai/clip-vit-base-patch32@092a3b7e3172+a6a0317b924b`, index `faiss-flatip-week4-v1`
- `FASEARCH_CATALOG_FILE=data/processed/catalog-20260908-pilot-v1/catalog.cleaned.v1.jsonl` (600 dòng, sha256 `82b21a09…`)
- DB `jdbc:postgresql://127.0.0.1:55732/fasearch`, S3 endpoint `http://127.0.0.1:38535`

## Kiểm thử

```bash
# BE full suite (offline, cần ~/.m2 + testcontainers docker)
/private/tmp/fasearch-catalog-discovery/be && ./mvnw -o test
# FE
cd /private/tmp/fasearch-catalog-discovery/fe && npm run lint && npm run build
node --test tests/catalog-contract.test.mjs  # + các file tests/*.test.mjs riêng lẻ
# API live (cần stack running)
/private/tmp/fasearch-catalog-discovery/tools/catalog-discovery/verify-catalog-api.sh 18380
```

## Sự cố thường gặp

- Port bị chiếm → script REFUSE, kiểm tra `lsof -iTCP:<port>`, không kill process lạ.
- AI cold start chậm → `health` retry 40×3s có sẵn trong `start`.
- Boot 503 `CATALOG_UNAVAILABLE` → kiểm tra `FASEARCH_CATALOG_FILE` trỏ đúng JSONL 600 dòng.
