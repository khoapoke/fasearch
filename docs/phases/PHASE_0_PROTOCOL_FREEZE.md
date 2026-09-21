# Phase 0 Protocol Freeze

## Outcome

Nhóm có một baseline repository, schema và protocol v1 đủ để bắt đầu code/data mà không phải quyết định lại các khái niệm cốt lõi.

## Time box

3 đến 5 ngày làm việc.

## Inputs

- Master Blueprint.
- Decision Register.
- Brief chính thức.
- Lịch và quy định nộp của khoa.

## Work packages

### P0.1 Repository structure

Tạo các vùng:

```text
apps/web              # Next.js/TypeScript website
services/api          # Java Spring Boot API nghiệp vụ/công khai
services/ai           # FastAPI nội bộ, adapter mỏng dùng lại ml/
services/worker       # Python background processing
ml/retrieval
ml/tagger
ml/parser
ml/outfit
evaluation
data/manifests
configs
schemas
docs
tests
```

Nếu dùng monorepo khác, vẫn giữ ranh giới logic tương đương. Layout này cập nhật theo D054/D055 ngày 10/09/2026; giữ các path generic `services/api` và `services/worker`, chỉ tạo phần còn thiếu khi scaffold được triển khai. `services/ai` là adapter triển khai sau baseline, không viết lại core Python hoặc tạo thêm backend nghiệp vụ. Không yêu cầu tạo thư mục/module bonus chưa được mở.

### P0.2 Environment

- Python version lock.
- PyTorch/CUDA version lock cho Colab T4.
- Khi scaffold website: pin Node.js, package manager và Next.js/TypeScript dependencies bằng lockfile.
- Khi scaffold backend: pin JDK, Spring Boot và Maven Wrapper cùng dependency/plugin versions; chưa chọn số phiên bản trong đợt đổi tài liệu này.
- Giữ Python dependency lock của baseline; FastAPI/worker dùng cùng core Python với CLI.
- Dependency lock files được version hóa theo runtime; CI kiểm tra bootstrap tương ứng.
- `.env.example` không chứa secret.
- Docker/development startup plan.

### P0.3 Schemas

Validate:

- Product.
- Intent card.
- Evidence.
- Experiment manifest.
- Judgment.

Tạo positive/negative fixtures cho từng schema.

### P0.4 Taxonomy v1 seed

- Review global/category-specific/semantic fields.
- Chốt sáu primary edit families cho RQ2 hoặc ghi Conditional với deadline.
- Tạo alias examples tiếng Việt/không dấu/loanword.
- Chốt version `1.0.0`.

### P0.5 Evaluation definitions

- Implement unit-tested nDCG, MRR strict/relaxed, TargetRecall, ConstraintSatisfied.
- Chốt gain function và unjudged policy.
- Implement paired bootstrap skeleton.
- Tạo tiny synthetic qrels fixture có expected result tính tay.

### P0.6 Governance

- Final-test access owners.
- Artifact naming.
- Decision-change procedure.
- Annotation role rotation.
- Backup/storage locations.

## Deliverables

- Protocol v1 tag/commit.
- Schema files pass validation.
- Taxonomy v1.
- Tiny evaluation fixture.
- Environment setup guide.
- Updated Decision Register.

## Acceptance tests

- Invalid intent operator bị schema reject.
- CANNOT_JUDGE record không bị map grade 0.
- Metric fixture trả expected values.
- Experiment manifest thiếu data hash bị reject.
- Product category ngoài MVP bị policy flag.

## Gate 0 checklist

- [ ] Không còn blocker về core scope.
- [ ] RQ1-RQ3 text khóa.
- [ ] Schema validate tự động.
- [ ] Taxonomy seed reviewed bởi ít nhất hai người.
- [ ] Final-test policy written.
- [ ] Repo có clean bootstrap path.
- [ ] Ongoing unknowns có ID/deadline trong Decision Register.

## Rollback or failure

Nếu schema/taxonomy tranh cãi chưa xong, dùng version `0.x` cho Phase 1 pilot, nhưng không được freeze final queries. Không kéo dài Phase 0 để hoàn thiện mọi future attribute.
