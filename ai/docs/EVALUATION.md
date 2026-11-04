# STT6 P3 Evaluation Harness

## Overview
Offline evaluation harness for STT6 search quality. Computes Precision@K, Recall@K, and latency statistics from pre-collected retrieval results.

## Files
- `ai/scripts/eval_metrics.py` — pure-Python metric computation (no external dependencies)
- `ai/scripts/eval_runner.py` — evaluation runner (BLOCKED if qrels missing)
- `ai/tests/test_eval_metrics.py` — unit tests for metric math (synthetic fixtures, clearly separated from experimental results)

## Usage
```bash
# When canonical qrels are available:
python ai/scripts/eval_runner.py --queries queries.json --qrels qrels.json --results results.json --output report.json --k 10

# If qrels missing, emits BLOCKED report with required schema
python ai/scripts/eval_runner.py --queries queries.json --qrels missing.json --results results.json --output report.json --k 10
```

## Metric Definitions
- **Precision@K**: |retrieved[:K] ∩ relevant| / min(K, |retrieved[:K]|)
- **Recall@K**: |retrieved[:K] ∩ relevant| / |relevant|
- **Latency**: p50, p95, mean, min, max over measured samples (linear interpolation)

## Measurement Boundary
- End-to-end: BE search endpoint including AI service round-trip
- Warm/cold samples measured separately
- p50/p95 only where actual measured sample supports

## Status
**BLOCKED** — canonical research splits/qrels/metrics not present in repository. No synthetic relevance labels may be used. Harness and unit tests are complete and runnable.

## Quan hệ với EvaluationService (Streamlit / `scripts/run_benchmark.py`)
Repo có HAI cách đánh giá, mục đích khác nhau — không thay thế nhau:
- **Offline harness (file này)**: `scripts/eval_runner.py` + `scripts/eval_metrics.py` tính Precision@K / Recall@K / latency từ `results.json` đã thu thập và `qrels.json` (nhãn người gán theo từng query, recall theo pool đã gán nhãn). Dùng cho đánh giá pilot P3. Không gọi AI service.
- **EvaluationService** (`src/services/evaluation_service.py`): chạy truy vấn trực tiếp trên một collection và so với nhãn `articleType` trong `dataset/test/styles.csv` (kèm AP/RR/mAP/MRR). Là bộ kiểm thử nhanh cho dataset Fashion Product Images; **không** phải nhãn đánh giá chính thức. Thiếu `styles.csv` hoặc không khớp collection thì báo lỗi rõ ràng (không in 0%).
