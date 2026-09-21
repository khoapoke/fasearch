# FaSearch AI Module

Module Python cho baseline truy hồi đa phương thức, FastAPI adapter nội bộ và processing worker. Core `ml/` là implementation dùng chung cho CLI, test và HTTP adapter; Spring Boot không nhân bản logic encoder/FAISS.

Điểm bắt đầu dành cho cả nhóm là [docs/README.md](../docs/README.md). Tài liệu tổng thể nằm tại [docs/00_MASTER_BLUEPRINT.md](../docs/00_MASTER_BLUEPRINT.md). Mọi thay đổi ảnh hưởng đến phạm vi, dữ liệu, benchmark hoặc protocol thí nghiệm phải được ghi vào [docs/10_DECISION_REGISTER.md](../docs/10_DECISION_REGISTER.md) trước khi áp dụng.

Thông tin phiên bản và trạng thái kiểm định của gói hiện tại nằm tại [RELEASE_NOTES.md](../RELEASE_NOTES.md).

## Stack và phạm vi triển khai

Nhóm chốt ngày 10/09/2026: website dùng **Next.js/TypeScript**, backend nghiệp vụ và API công khai dùng **Java Spring Boot**. Dịch vụ AI nội bộ dùng **Python/FastAPI**, tái sử dụng `ml/`, PyTorch và FAISS; worker Python xử lý các job embedding/index. Spring Boot sở hữu auth, catalog, lịch sử tìm kiếm, phân quyền và điều phối; Next.js gọi API này, không tạo thêm backend nghiệp vụ riêng.

Website là deliverable bắt buộc. Mobile chỉ mở khi website/search core, kiểm thử, triển khai và báo cáo đã sẵn sàng; framework mobile chưa chọn. Quyết định nhóm [D054/D055](../docs/10_DECISION_REGISTER.md) thay D005 và giải quyết O007/O008, sẽ được trình bày với GVHD ở buổi gặp kế tiếp.

Thay đổi này giảm số nền tảng UI phải hoàn thiện, nhưng thêm contract và vận hành giữa Java–Python; tiến độ còn phụ thuộc kinh nghiệm React/Java của nhóm. Code baseline Week 4 vẫn là nguồn tái lập nghiên cứu.

## Week 4 runnable baseline

Baseline hiện có đường chạy từ Dataset A small đến cleaned catalog 600 sản phẩm, frozen CLIP embeddings, FAISS `IndexFlatIP`, ba chế độ tìm kiếm và pilot metrics. Bắt đầu tại [Week 4 runbook](../docs/week4/WEEK4_BASELINE_RUNBOOK.md).

```bash
cd ai
/Users/khoado/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock
.venv/bin/python scripts/download_dataset_a.py --variant small --output-dir data/raw/dataset_a
./scripts/run_week4_baseline.sh
```

Smoke test hoàn toàn offline:

```bash
./scripts/run_cpu_smoke.sh
```

## Internal FastAPI adapter

Spring Boot chỉ gọi interface nội bộ đã version hóa; adapter không trả title/category/image path và không sở hữu dữ liệu catalog nghiệp vụ.

```bash
cd ai
export FASEARCH_INDEX_DIR="artifacts/indexes/week4-baseline-20260908-v1"
export FASEARCH_CATALOG_SNAPSHOT_ID="catalog-20260908-pilot-v1"
../.venv/bin/uvicorn fasearch_ai.main:app --host 127.0.0.1 --port 8001
```

OpenAPI contract được sinh deterministic từ adapter:

```bash
cd ai
../.venv/bin/python scripts/export_internal_openapi.py
```

Mọi query/metric Week 4 đều là `pilot_only`, không phải final benchmark. Raw dataset, model weights, embeddings và index được Git-ignore; manifest hash có thể commit nằm ở `data/manifests/`.

## Nguyên tắc làm việc

- Core của đồ án là truy hồi thời trang đa phương thức bằng tiếng Việt.
- RQ1, RQ2 và RQ3 cùng benchmark đóng băng là phần bắt buộc.
- Website Next.js và backend Spring Boot là phần bắt buộc để chứng minh khả năng tích hợp; mobile là mở rộng tùy thời gian theo D055.
- Outfit compatibility là điểm cộng sau core.
- Virtual try-on và 3D là prototype hoặc future work, tách khỏi benchmark retrieval.
- Không dùng final test để chọn model, threshold, prompt hoặc hyperparameter.
