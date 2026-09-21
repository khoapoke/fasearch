# Bản phát hành tài liệu đồ án v1

Ngày đóng gói: 2026-09-05

Ngày cập nhật gần nhất: 2026-09-10

## Cập nhật stack Web ngày 10/09/2026

- D054/D055 và change record `CP-20260910-STACK` thay D005: Next.js/TypeScript cho website; Java Spring Boot cho backend nghiệp vụ/API công khai; Python/FastAPI cho AI nội bộ, dùng lại `ai/ml/`, PyTorch, FAISS và worker Python.
- Website là deliverable bắt buộc. Mobile là mở rộng sau website/search core, kiểm thử, triển khai và báo cáo; framework mobile chưa chọn.
- O007/O008 đã được nhóm giải quyết ngày 10/09/2026. Nhóm sẽ trình bày kiến trúc trong buổi gặp GVHD kế tiếp; chưa có tuyên bố GVHD đã duyệt quyết định nhóm.
- Phạm vi UI giảm còn website; chi phí tích hợp Java–Python tăng. Không khẳng định framework mới tự động nhanh hơn, và không thay protocol/model/data/metric Week 4.
- Bộ Markdown và sơ đồ hiện hành được cập nhật. `deliverables/Ke_hoach_nghien_cuu_va_trien_khai_Fashion_AI.docx` và `deliverables/Fashion_Search_Documentation_Pack_v1.zip` giữ nguyên là snapshot lịch sử v1, chưa phản ánh D054/D055; các kiểm định Word dưới đây chỉ áp dụng cho snapshot đó.
- Sơ đồ hiện hành dùng `system_architecture.web-v1.1` và `research_roadmap.web-v1.1` (DOT + PNG); giữ lại các ảnh/source v1 để truy vết lịch sử. Gate 1 roadmap được đồng bộ với D053 đã chốt, sửa sót wording 100–200/B0–B1.
- Week 4 vẫn 13/14 Gate, chờ independent rerun sign-off; cập nhật stack không mở gói Week 5.

## Week 4 baseline v1

- Dataset A small đã tải và audit; catalog pilot cân bằng 600 sản phẩm được pin bằng manifest/checksum.
- Frozen `openai/clip-vit-base-patch32` exact revision đã encode 600 ảnh thành vector 512 chiều chuẩn hóa L2.
- FAISS `IndexFlatIP`, row-product mapping, ba search mode và 24 pilot queries đã chạy end to end.
- Precision@K, Recall@K, TargetRecall@K, MRR strict/relaxed và latency p50/p95 được xuất overall/by-mode/per-query.
- 14 unit tests và offline CPU smoke test pass.
- Bundle artifact thống nhất ID `week4-baseline-20260908-v1`; ba CLI search mode đã được chạy lại bằng đường dẫn mặc định sau khi chuẩn hóa cache/model path.
- Week 4 Gate đạt 13/14; còn chờ một thành viên khác chạy lại và ký xác nhận, nên chưa mở artifact Week 5.
- Phiếu `docs/week4/WEEK4_INDEPENDENT_RERUN.md` ghi quy trình và hash cần ký để đóng Gate còn lại.
- Mọi metric đều `pilot_only`; weak metadata labels không phải final qrels và không hỗ trợ claim chất lượng model.

## Mục đích

Đây là mốc tài liệu đầu tiên đã chuyển các quyết định trong quá trình thảo luận thành nguồn tham chiếu có cấu trúc. Bộ Markdown là nguồn sự thật để nhóm tiếp tục cập nhật. Bản Word tổng hợp chỉ là snapshot thuận tiện để đọc và chưa thay thế mẫu đề cương hoặc báo cáo chính thức của khoa.

## Nội dung đã khóa

- Core là tìm kiếm sản phẩm thời trang bằng ảnh và mô tả tiếng Việt tự nhiên.
- Catalog MVP gồm TOP, BOTTOM và ONE_PIECE.
- Ba research question RQ1, RQ2 và RQ3 có protocol, baseline, metric, slice, gate và artifact riêng.
- Test set đóng băng; split theo product group; query author không chấm query của mình.
- RQ2 dùng 400 composed queries, gồm 240 controlled và 160 natural; judged subset dự kiến khoảng 100.
- Taxonomy, intent card, graded qrels, reason codes, data flywheel và human in the loop là nền tảng chung.
- Curriculum huấn luyện gồm Stage 0 đến Stage 5; Stage 5 là joint consolidation ngắn và chỉ được giữ nếu thắng Stage 4 trên validation mà không phá guardrail.
- Website Next.js/TypeScript và backend nghiệp vụ/API công khai Java Spring Boot là bắt buộc; Python/FastAPI giữ vai trò AI nội bộ theo D054. Mobile là mở rộng theo D055; D005 đã superseded.
- Outfit compatibility là bonus ưu tiên sau core; VTON và 3D là prototype hoặc future work có benchmark tách biệt.
- Fashion Product Images Dataset của Param Aggarwal trên Kaggle được giữ làm Dataset A cho catalog seed và baseline, nhưng phải qua version pin, cleaning, filtering và leakage audit; nó không thay thế benchmark tiếng Việt hoặc composed retrieval data.

## Thành phần phát hành

- Chỉ mục và Master Blueprint.
- Mười một tài liệu nền về scope, nghiên cứu, dữ liệu, benchmark, training, kiến trúc, bonus, roadmap, báo cáo, quyết định và thuật ngữ.
- Chín playbook từ Phase 0 đến Phase 8.
- Năm JSON Schema, taxonomy YAML và ba template làm việc.
- Bốn sơ đồ kiến trúc và quy trình, kèm nguồn Graphviz.
- Một bản Word tổng hợp tham khảo được render và kiểm tra trực quan toàn bộ trang.

## Kiểm định đã chạy

- Mọi tệp JSON parse thành công.
- Mọi tệp YAML parse thành công.
- Mọi liên kết Markdown nội bộ resolve thành công.
- Các con số ngân sách query RQ2 được đối chiếu nhất quán.
- Bản Word là ZIP OOXML hợp lệ, accessibility audit không có finding và toàn bộ 151 trang đã được kiểm tra trực quan.

## Quy tắc cập nhật sau v1

1. Đề xuất thay đổi trong Decision Register trước khi sửa protocol hoặc schema.
2. Cập nhật cùng lúc tài liệu giải thích, schema máy đọc và playbook bị ảnh hưởng.
3. Tăng version của taxonomy, query set, qrels, prompt, checkpoint hoặc evidence schema khi nội dung tương ứng thay đổi.
4. Không ghi đè artifact thí nghiệm cũ; tạo snapshot mới có hash và provenance.
5. Khi có mẫu Word chính thức của khoa, dùng Thesis Proposal Mapping để chuyển nội dung sang hình thức nộp mà không tự ý thay đổi protocol.
