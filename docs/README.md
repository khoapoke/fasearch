# Chỉ mục tài liệu đồ án

## Cách sử dụng bộ tài liệu

Đọc theo vai trò và thời điểm, không cần đọc mọi file cùng lúc:

1. Cả nhóm đọc **Master Blueprint** và **Decision Register**.
2. Người phụ trách AI đọc Research Protocol, Data, Benchmark và Training Protocol.
3. Người phụ trách backend đọc Scope, Architecture và các schema.
4. Người phụ trách Next.js/Web đọc Scope, Architecture và Phase 6.
5. Mỗi sprint chỉ mở playbook phase đang thực hiện và hoàn thành gate trước khi chuyển phase.
6. Khi viết đề cương hoặc báo cáo, dùng tài liệu Mapping để chuyển nội dung kỹ thuật sang cấu trúc học thuật.

## Đọc nhanh

- [PROJECT BRIEFING](PROJECT_BRIEFING.md) — bản tóm tắt dẫn xuất: đồ án làm gì, đang ở bước nào, cần gì tiếp, FAQ bàn giao. Không thay thế nguồn sự thật bên dưới.

Stack hiện hành từ 10/09/2026 theo [D054/D055](10_DECISION_REGISTER.md): Next.js/TypeScript → Java Spring Boot API nghiệp vụ → Python/FastAPI AI nội bộ, cùng worker Python. Website là bắt buộc; mobile là mở rộng tùy thời gian sau website/search core, kiểm thử, triển khai và báo cáo. Framework mobile chưa chọn.

Word và ZIP v1 là snapshot lịch sử chưa cập nhật stack mới và không được migrate vào GitHub code repo. Bộ Markdown hiện tại là tài liệu triển khai; không dùng nội dung Flutter trong các snapshot cũ làm yêu cầu hiện hành.

## Tài liệu nền

| Tài liệu | Mục đích |
|---|---|
| [00 MASTER BLUEPRINT](00_MASTER_BLUEPRINT.md) | Bản tổng thể tự chứa toàn bộ hướng đi và kiến trúc quyết định |
| [01 PROJECT SCOPE AND REQUIREMENTS](01_PROJECT_SCOPE_AND_REQUIREMENTS.md) | Phạm vi, actor, use case, yêu cầu chức năng và phi chức năng |
| [02 RESEARCH PROTOCOL](02_RESEARCH_PROTOCOL.md) | RQ1 đến RQ3, hypotheses, ablation, metric và thống kê |
| [03 DATA TAXONOMY AND GOVERNANCE](03_DATA_TAXONOMY_AND_GOVERNANCE.md) | Nguồn dữ liệu, taxonomy, split, data flywheel và HITL |
| [04 BENCHMARK AND ANNOTATION](04_BENCHMARK_AND_ANNOTATION.md) | Query, pooling, qrels, relevance grade, reason code và adjudication |
| [05 MODEL TRAINING PROTOCOL](05_MODEL_TRAINING_PROTOCOL.md) | Curriculum Stage 0 đến Stage 5, checkpoint và promotion gate |
| [06 SYSTEM ARCHITECTURE AND DEPLOYMENT](06_SYSTEM_ARCHITECTURE_AND_DEPLOYMENT.md) | Kiến trúc API first, indexing, concurrency, observability và triển khai |
| [07 OUTFIT VTON AND 3D](07_OUTFIT_VTON_AND_3D.md) | Compatibility, explainability, virtual try-on, avatar 3D và privacy |
| [08 EXECUTION ROADMAP](08_EXECUTION_ROADMAP.md) | Dependency, vai trò, lịch tương đối, Definition of Done và risk |
| [09 THESIS PROPOSAL MAPPING](09_THESIS_PROPOSAL_MAPPING.md) | Ánh xạ sang đề cương, báo cáo Word và nội dung bảo vệ |
| [10 DECISION REGISTER](10_DECISION_REGISTER.md) | Danh mục quyết định đã khóa và quy tắc thay đổi |
| [11 GLOSSARY AND REFERENCES](11_GLOSSARY_AND_REFERENCES.md) | Thuật ngữ thống nhất và tài liệu tham khảo khởi đầu |

## Playbook thực thi

| Phase | Tài liệu | Gate chính |
|---:|---|---|
| 0 | [Protocol Freeze](phases/PHASE_0_PROTOCOL_FREEZE.md) | Protocol v1 và schema hợp lệ |
| 1 | [Baseline Vertical Slice](phases/PHASE_1_BASELINE_VERTICAL_SLICE.md) | Search end to end tái lập được |
| 2 | [Data Foundation](phases/PHASE_2_DATA_FOUNDATION.md) | Catalog và split v1 đóng băng |
| 3 | [RQ1 Vietnamese Adaptation](phases/PHASE_3_RQ1.md) | Bảng RQ1 và slice analysis hoàn chỉnh |
| 4 | [RQ2 Composed Retrieval](phases/PHASE_4_RQ2.md) | Panel A và B hoàn chỉnh |
| 5 | [RQ3 Taxonomy Explainability](phases/PHASE_5_RQ3.md) | Ma trận 2 nhân 2, lanes, evidence và latency |
| 6 | [Product Web — Mobile tùy chọn](phases/PHASE_6_PRODUCT_WEB_MOBILE.md) | Website Next.js dùng API Spring Boot; mobile không bắt buộc để đạt gate |
| 7 | [Bonus Features](phases/PHASE_7_BONUS_FEATURES.md) | Compatibility hoặc VTON prototype có evaluation riêng |
| 8 | [Report and Defense](phases/PHASE_8_REPORT_AND_DEFENSE.md) | Báo cáo, bảng số liệu và demo defense-ready |

## Schema và cấu hình

- [Product schema](../schemas/product.schema.json)
- [Intent card schema](../schemas/intent-card.schema.json)
- [Evidence schema](../schemas/evidence.schema.json)
- [Experiment manifest schema](../schemas/experiment-manifest.schema.json)
- [Judgment schema](../schemas/judgment.schema.json)
- [Taxonomy v1](../config/taxonomy.v1.yaml)
- [Experiment manifest example](../ai/templates/experiment-manifest.example.yaml)
- [Query intent card example](../ai/templates/query-intent-card.example.yaml)
- [Annotation form](../ai/templates/annotation-form.md)

## Week 5-6 implementation flow

- [Scope, actors and permissions](week5/WEEK5_SCOPE_ACTORS_AND_PERMISSIONS.md)
- [Compliance matrix](week5/WEEK5_COMPLIANCE_MATRIX.md)
- [Requirements specification](week5/WEEK5_REQUIREMENTS_SPECIFICATION.md)
- [Vertical-slice execution flow](week5/WEEK5_VERTICAL_SLICE_EXECUTION_FLOW.md)
- [Week 6 vertical-slice status](week6/WEEK6_VERTICAL_SLICE_STATUS.md)

## Week 4 baseline artifacts

- [Runbook local CPU và Colab T4](week4/WEEK4_BASELINE_RUNBOOK.md)
- [Dataset A card v1](week4/DATASET_A_CARD.v1.md)
- [Frozen baseline pilot report v1](week4/WEEK4_PILOT_REPORT.v1.md)
- [Conflict và quyết định Week 4](week4/WEEK4_CONFLICTS_AND_DECISIONS.md)
- [Week 4 Gate status](week4/WEEK4_GATE_STATUS.md)
- [Independent rerun sign-off](week4/WEEK4_INDEPENDENT_RERUN.md)

## Quy tắc nguồn sự thật

Thứ tự thẩm quyền hiện hành:

1. Đề cương chính thức CNTT-KLCN198, lưu ngoài GitHub code repo vì chứa thông tin cá nhân; tên file và cách kiểm chứng được ghi trong tài liệu Week 5.
2. Decision Register và schema máy đọc.
3. Research Protocol.
4. Master Blueprint và phase playbook.

Nếu hai nguồn mâu thuẫn, dừng phần bị ảnh hưởng, ghi conflict/change proposal và cập nhật đồng bộ các tài liệu liên quan khi quyết định đã rõ. Danh sách conflict Week 4 nằm tại [WEEK4_CONFLICTS_AND_DECISIONS](week4/WEEK4_CONFLICTS_AND_DECISIONS.md).
