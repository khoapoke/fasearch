# FaSearch

Monorepo cho đồ án CNTT-KLCN198: website tìm kiếm sản phẩm thời trang bằng hình ảnh và mô tả tự nhiên.

## Cấu trúc

| Thư mục | Trách nhiệm |
|---|---|
| `fe/` | Website Next.js/TypeScript. Chỉ gọi Spring Boot, không sở hữu business logic. |
| `be/` | Spring Boot modular monolith: identity, catalog, history, authorization và search orchestration. |
| `ai/` | Python AI module: FastAPI adapter, core `ml/`, PyTorch/FAISS và processing worker. |
| `schemas/` | Schema dùng chung và contract nghiên cứu đã version hóa. |
| `config/` | Taxonomy/config dùng chung ở cấp repository. |
| `docs/` | Nguồn tài liệu phân tích, quyết định và traceability. |

## Luồng triển khai hiện tại

Nhóm áp dụng implementation-informed modeling:

1. khóa scope, actor, permission, requirement và interface tối thiểu;
2. xây một vertical slice chạy xuyên `fe -> be -> ai`;
3. kiểm thử luồng thực tế;
4. hoàn thiện use case, sequence, class model và ERD từ hành vi đã kiểm chứng;
5. lặp lại cho vertical slice tiếp theo.

Vertical slice đầu tiên là image search trên frozen catalog. Không mở mobile, commerce, VTON/3D hoặc fine-tuning trong mốc này.

## AI baseline

Baseline Week 4 được đặt trong `ai/` và vẫn là một module tự chứa:

```bash
cd ai
/Users/khoado/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock
./scripts/run_cpu_smoke.sh
```

Raw dataset, model weights, embeddings, FAISS index, local uploads và secret không được commit. Xem [chỉ mục tài liệu](docs/README.md) và [luồng vertical slice](docs/week5/WEEK5_VERTICAL_SLICE_EXECUTION_FLOW.md) trước khi thay đổi interface liên module.
