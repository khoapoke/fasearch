# FaSearch

Monorepo cho đồ án CNTT-KLCN198: website tìm kiếm sản phẩm thời trang bằng hình ảnh và mô tả tự nhiên.

## Cấu trúc

| Thư mục | Trách nhiệm |
|---|---|
| `fe/` | Website Next.js/TypeScript. Chỉ gọi Spring Boot, không sở hữu business logic. |
| `be/` | Spring Boot modular monolith: identity, catalog, history, authorization và search orchestration. |
| `ai/` | Python AI module: FastAPI adapter, core `ml/`, PyTorch/FAISS và processing worker. |
| `contracts/` | OpenAPI contracts được sinh và kiểm tra giữa các module. |
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

Codex và Pi dùng chung [quy tắc agent](AGENTS.md), [workflow nhiều session](docs/agents/session-workflow.md) và các task packet đã version hóa trong `.agent/tasks/`. Packet ghi tiến độ/review theo ticket, không thay thế Decision Register, requirements hay schema.

Vertical slice đầu tiên là image search trên frozen catalog. Không mở mobile, commerce, VTON/3D hoặc fine-tuning trong mốc này.

## Workflow oxk cho FaSearch

Đã tích hợp bản local `0.1.0-fasearch.1`: [audit và cách dùng](docs/agents/oxk-integration.md), [project context](.agent/PROJECT.md), skill `.agents/skills/oxk/` và bốn prompt Pi. Tạo packet ở `.agent/tasks/` bằng `node tools/oxk/bin/oxk.mjs task <slug> --project .`; thêm `--mode ui` khi cần DESIGN.md. Công cụ không sửa production code, cài plugin global hay tự merge.

## AI baseline

Baseline Week 4 được đặt trong `ai/` và vẫn là một module tự chứa:

```bash
cd ai
/Users/khoado/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock
./scripts/run_cpu_smoke.sh
```

Raw dataset, model weights, embeddings, FAISS index, local uploads và secret không được commit. Xem [chỉ mục tài liệu](docs/README.md) và [luồng vertical slice](docs/week5/WEEK5_VERTICAL_SLICE_EXECUTION_FLOW.md) trước khi thay đổi interface liên module.

## Backend

Backend hiện yêu cầu PostgreSQL local cho identity/session và Catalog Draft, cùng S3-compatible storage cho ảnh sản phẩm. Cấu hình credential qua environment; xem [checkpoint identity, Draft và ảnh](docs/week6/WEEK6_IDENTITY_AND_DRAFT_STATUS.md).

```bash
docker compose -f be/compose.yaml -f be/compose.storage.yaml up -d
cd be
./mvnw test
./mvnw spring-boot:run
```

Public image-search contract nằm tại `contracts/public-api.openapi.json`; contract Spring Boot-AI nằm tại `contracts/internal-ai.openapi.json`.
