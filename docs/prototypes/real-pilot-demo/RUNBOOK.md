# Real-pilot integrated demo — Runbook

Stack riêng: FE `http://localhost:3220/`, Boot `http://localhost:18280/`, AI `http://127.0.0.1:18021/`, PG `127.0.0.1:55632`, S3 `127.0.0.1:38435`.
Stack cũ 3210/18180/18011/18080/8001 giữ nguyên.

## Khởi động

```bash
export TASK_ADMIN_PASS=Task-Admin-Test-Pass-123
bash tools/real-pilot-demo/lifecycle.sh start
bash tools/real-pilot-demo/lifecycle.sh health
bash tools/real-pilot-demo/lifecycle.sh warm
```

AI dùng model frozen `openai/clip-vit-base-patch32@092a3b7e3172+a6a0317b924b`, index `faiss-flatip-week4-v1`, catalog `catalog-20260908-pilot-v1`, 600 sản phẩm/512 chiều.
Biến môi trường AI: `FASEARCH_ENCODER=hf_clip`, `HF_HOME=<asset-root>/.cache/huggingface`, `HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`.

## Kiểm tra

```bash
export TASK_ADMIN_PASS=Task-Admin-Test-Pass-123
bash tools/real-pilot-demo/verify-r1-assets.sh /tmp/rp-r1.log
bash tools/real-pilot-demo/verify-r234-parity.sh /tmp/rp-r234.log
bash tools/real-pilot-demo/verify-r5-limits.sh /tmp/rp-r5.log
bash tools/real-pilot-demo/verify-r6-draft.sh /tmp/rp-r6.log
bash tools/real-pilot-demo/verify-r7-lifecycle.sh /tmp/rp-r7.log
```

## Dừng

```bash
bash tools/real-pilot-demo/lifecycle.sh stop
```

Không push/PR/merge/deploy. Dữ liệu thô/weights/index không commit.
