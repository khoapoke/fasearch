# Week 5-6 Vertical Slice Execution Flow

## Trạng thái

- Change note: `CP-20260921-IMPLEMENTATION-INFORMED-MODELING`
- Ngày thống nhất: 21/09/2026
- Trạng thái: nhóm đã chọn hướng vertical-slice-first; không thay đổi D003, D054 hoặc D055

## Lý do thay đổi cách thực hiện

Actor, scope, permission, requirement và acceptance criteria vẫn phải có trước implementation. Tuy nhiên sequence, analysis class chi tiết và ERD hoàn chỉnh dễ sai nếu được khóa trước khi có một luồng chạy xuyên hệ thống.

Nhóm chuyển từ quy trình tuyến tính “hoàn tất mọi sơ đồ rồi mới code” sang implementation-informed modeling:

1. khóa interface và invariant tối thiểu;
2. xây một vertical slice nhỏ;
3. chạy test và ghi hành vi thực tế;
4. hoàn thiện use case, sequence, class model và ERD của slice;
5. review rồi mới mở slice tiếp theo.

Đây không phải cách làm “code xong mới hợp thức hóa tài liệu”. Requirement và acceptance vẫn là nguồn kiểm tra implementation; hành vi tình cờ của code không tự động trở thành requirement.

## Những nội dung đã đủ để bắt đầu implementation

- system scope và actor;
- actor-permission matrix và business rules;
- compliance matrix;
- functional/non-functional requirement ID;
- stack và ownership Next.js/Spring Boot/Python;
- frozen Week 4 AI baseline và artifact contract.

## Interface cần khóa trước Slice 1

### Website -> Spring Boot

- Public contract: [public-api.openapi.json](../../contracts/public-api.openapi.json).
- image upload request;
- Top-K result response;
- validation, timeout và unavailable errors;
- product ID/version, rank và display metadata.

### Spring Boot -> AI module

- Editable/generated contract: [internal-ai.openapi.json](../../contracts/internal-ai.openapi.json).
- internal image-search request có trace ID, K và publication versions;
- response có product ID/version, rank, score và model/index/catalog provenance;
- AI module không sở hữu user, role hoặc catalog business tables;
- không fallback âm thầm sang model/index khác.

## Slice 1 - Image search read path

```text
Guest
  -> Next.js upload ảnh
  -> Spring Boot validate/orchestrate
  -> FastAPI adapter gọi core ml/ và FAISS
  -> Spring Boot join metadata
  -> Next.js hiển thị Top-K/loading/empty/error
```

Definition of Done:

- request chạy xuyên `fe -> be -> ai`;
- dùng frozen catalog/index đã version hóa;
- Top-K giữ đúng rank;
- invalid image, timeout, unavailable và version mismatch có hành vi rõ;
- có contract test Spring Boot-Python và ít nhất một E2E Web flow;
- sau khi test pass mới khóa sequence diagram và class/ERD liên quan.

## Slice 2 - Catalog to searchable

```text
Operations Staff tạo Draft
  -> upload ảnh/metadata
  -> tạo Product Version và Processing Job
  -> AI worker sinh embedding/index artifact
  -> Administrator publish
  -> Guest tìm thấy Product trong image search
```

Definition of Done:

- product lifecycle và permission được kiểm tra;
- published version không bị ghi đè;
- publication không để search thấy partial update;
- `changed_by`, `published_by` và provenance được lưu;
- use case, sequence, analysis class và ERD catalog được cập nhật từ flow đã kiểm chứng.

## Artifact timing

| Artifact | Trước implementation | Sau mỗi vertical slice |
|---|---|---|
| Scope/actor/permission | Khóa baseline | Chỉ sửa bằng review/change note |
| Requirement/acceptance | Khóa requirement ID | Cập nhật clarification, không hợp thức hóa bug |
| Use case | Draft goal/actor | Hoàn thiện main/alternate/error flow |
| Sequence | Chỉ seed lifeline/interface | Khóa theo trace và contract đã test |
| Analysis class | Seed entity/control/boundary | Chốt responsibility và relationship thực tế |
| ERD | Chỉ entity/invariant cần cho slice | Chốt key/cardinality/constraint qua migration/test |
| Design class | Không khóa trước | Sinh từ implementation đã review |

## Non-goals

- Không mở text/composed search trong Slice 1.
- Không mở mobile, commerce, VTON/3D hoặc outfit compatibility.
- Không fine-tune hoặc chọn multilingual model mới.
- Không dùng CLI latency Week 4 làm website latency.
