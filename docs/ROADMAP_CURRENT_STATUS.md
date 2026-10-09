# Roadmap điều hành FaSearch — 05/10/2026

Owner: Control. Đây là bảng tiến độ đối chiếu nguồn/task, không thay thế đề cương, Decision Register hoặc `08_EXECUTION_ROADMAP.md`. Đại diện xác nhận deadline cuối tháng10 và đầu ra theo đề cương. Lấy31/10/2026 làm mốc lập lịch tạm, cần đổi nếu ngày nộp thực tế sớm hơn; đề cương PDF ghi08/11/2026. Lịch dưới đây là đề xuất điều hành, chưa phải cam kết ngày giao.

## Đang ở đâu

Website demo local đã có tìm ảnh/chữ/composed, catalog list/detail và Draft cơ bản. Research mới có frozen pilot; chưa có bằng chứng hoàn tất Data Foundation hoặc RQ1–RQ3. Không dùng số test/commit hoặc website chạy được để suy ra phần trăm hoàn thành đồ án.

| Hạng mục | Hiện trạng có nguồn | Còn lại / điều kiện đóng |
| --- | --- | --- |
| Protocol/schema/decisions | Có bộ nguồn chốt và research protocol | Rà rubric/deadline và quyết định mở; chưa audit lại toàn Gate0 |
| Frozen baseline | CLIP pretrained + FAISS, 600 sản phẩm, 3 mode, 24 pilot queries | Week4 sign-off độc lập bởi thành viên còn PENDING trong file gốc; review app không thay chữ ký này |
| Website search/catalog | Local tích hợp; search-input-ui clean01104318; review revision2 PASS trong packet | Manual UX/native clipboard; acceptance gaps cũ Catalog phải kiểm lại trước release; consolidation/PR chưa hoàn tất |
| Auth/Draft | Login/session/CSRF, Draft create/revise/upload/list có evidence task | Account/register/profile/password bundle chưa có evidence hoàn tất; route inventory không có dedicated account pages |
| Seller → Active | Draft checkpoint có; processing packet SCOUT_READY | Chốt và implement job/worker/review/publication/version consistency; chưa coi pilot catalog seed là publication nghiệp vụ |
| Data Foundation | Dataset A small đã audit; pilot cân bằng600 | Coverage catalog trong TOP/BOTTOM/ONE_PIECE, product-group split/dedupe, query/intent/qrels, leakage audit, gold annotation |
| RQ1 tiếng Việt | Có execution baseline, chưa có model fine-tuned cho app | Frozen multilingual/ViCLIP-OT arms theo protocol, adaptation experiments, paired metrics/CI/error slices; cần cloud handoff |
| RQ2 composed | Equal-weight engineering path chạy | Panel A/B, training regimes/hard negatives,400 target queries/100 judged subset và contamination audit theo protocol |
| RQ3 constraints/evidence | Contract/provenance hiện có không chứng minh RQ3 complete | Matrix/oracle/production lanes, retrieval/evidence metrics và latency Pareto |
| AI teammate | Draft CLIP+Qdrant đã có hardening/shadow parity riêng | Local-only; clean publication route cần quyết định vì ancestor artifacts; không thay FAISS baseline |
| Deployment/report/defense | Có runbook/demo/task evidence local | Môi trường deploy, E2E latency, backup/video; chương phương pháp/kết quả, bảng/figure reproducible, slides và rehearsal chưa xác nhận |

Nguồn tiến độ: search-input-ui TASK/STATUS/REVIEW; catalog-discovery STATUS/REVIEW; ai-draft-hardening STATUS; catalog-processing-gate STATUS; Week4 gate/sign-off; inspected current FE routes. Tests/browser gần nhất ghi trong packet là evidence Implement/reviewer, không phải Control chạy lại toàn bộ vào05/10. Mục chưa có evidence được ghi chưa xác nhận, không kết luận không có ở mọi branch khác.

## Đường găng và tăng tốc

Research: scope/protocol → data + split + judged queries → RQ1 → RQ2 → RQ3 → bảng kết quả/báo cáo. Product có thể chạy song song: consolidate reviewed app → seller processing/publication + account core → deployment/demo. Annotation, thí nghiệm và viết báo cáo cần calendar time; không ước lượng chúng từ tốc độ agent sửa UI.

**Tăng tốc từ bây giờ:** chuyển từ polish từng trang sang hai luồng có outcome. Dừng thêm bonus/mobile/VTON/outfit khi core chưa đủ; không đổi vector backend chỉ để tìm chất lượng tốt hơn. Không tự giảm scope RQ1–RQ3 đã chốt; nếu deadline không đủ, đại diện và GVHD phải quyết định điều chỉnh.

### Ba gói tiếp theo đề xuất

1. **Chốt deadline + release inventory:** phân biệt local reviewed/manual accepted/published/merged; chọn integration HEAD, kiểm remaining acceptance gaps, lên PR package có review. Không tự push/merge từ tài liệu này.
2. **Data/evaluation readiness:** audit catalogue đầy đủ trong phạm vi MVP, đề xuất snapshot mở rộng; chốt split/query annotation plan và notebook frozen baseline gọi core. Mở rộng catalog không phải training, không tự thêm Socks/Accessories ngoài scope.
3. **Product completion:** scout/chốt processing/publication và account còn thiếu theo nguồn, chia writer rõ; giao các vertical tickets sau khi hợp đồng nghiệp vụ sẵn sàng. Viết report phương pháp/kiến trúc song song ngay.

Sau gói2: báo representative trước training; notebook chạy Kaggle/Colab có checkpoint/resume/env/data hashes, held-out test và cost/GPU-hour log. User sẽ chạy cloud; không tự tiêu compute. Final-test integrity và independent evaluation giữ nguyên.

## Các mốc đếm ngược đề xuất

D = deadline cuối đã xác nhận. Đây là checkpoint quản trị rủi ro, không chứng minh toàn roadmap fit được vào một tháng.

| Mốc | Điều kiện nên có | Hành động nếu chưa đạt |
| --- | --- | --- |
| Ngay khi chốt D | Required deliverables, owner, dependencies, capacity và intermediate reviews | Tính lịch ngược dựa trên actual work; không đoán % |
| D−4 tuần | Data/splits/evaluation sẵn; thí nghiệm chính đang có results; product core có owner/contract | Review scope với GVHD nếu required work vượt capacity; hạn chế polish |
| D−2 tuần | Main experiments ổn định; report draft có tables; integrated demo + deployment candidate | Feature freeze; chỉ fix defect và khép evidence, tránh model/architecture migration |
| D−1 tuần | Reproducible results, báo cáo/slides/demo video + backup | Rehearsal, review claims, security/error/demo fixes |
| D−3 ngày | Release candidate pin; artifacts backed up; demo rehearsed | Không thêm feature/model mới; fixes nhỏ có regression |

Nếu hiện đã đi qua mốc nào mà điều kiện chưa đạt, cần escalation ngay, không chờ agent làm hết roadmap cũ. Ước lượng phase gốc giả định3 người và sprint1 tuần; đó không phải lịch thực tế đã xác nhận.

## Các thông tin cần chốt với đại diện

- Deadline cuối; ngày demo/báo cáo gần nhất; rubric/đầu ra ở từng mốc.
- Số người và capacity tuần thực tế; owner AI/eval, data/backend, FE/product.
- Scope bắt buộc theo GVHD; mức deploy/demo và yêu cầu RQ outcomes.

Không monitor hoặc Implement mới được khởi chạy từ roadmap này. Control chỉ cập nhật tài liệu; shipping/manual và kiến trúc thuộc đại diện.


## Lịch cập nhật theo deadline cuối tháng10

Đối chiếu trực tiếp7 trang PDF `references/CNTT_KLCN198_Tìm kiếm sản phẩm thời trang bằng hình ảnh và mô tả tự nhiên.pdf` ngày05/10. PDF ghi mãCNTT-KLCN198, thời gian17/08–08/11; representative yêu cầu hoàn tất cuối tháng10, nên không dựa vào08/11 để trì hoãn.

### Phân biệt yêu cầu đề cương và research mở rộng

Bắt buộc theo PDF pp.2–4: khảo sát/phân tích/thiết kế và mô hình hóa; user/admin UI; đăng ký/login/logout/đổi mật khẩu/phân quyền; profile; product CRUD/category/image/description; history/interested products và chọn/hủy chọn kết quả; IMAGE/TEXT/COMPOSED tích hợp; thực nghiệm embedding và chiến lược fusion; Precision@K/Recall@K/response time; functional tests/deploy kiểm thực tế; báo cáo/source/slides. Fine-tuning không được PDF ghi như điều kiện độc lập; full RQ1–RQ3 matrix cũng không được nêu trực tiếp. Proposal core không đòi thương mại/cart/checkout.

Repo vẫn giữ locked research protocol/decisions. Bảng trước về RQ1–RQ3 là roadmap nội bộ, không phải trích rubric bắt buộc. Control đề xuất ưu tiên rubric cốt lõi và trình đại diện/GVHD xác nhận mức mở rộng khả thi; KHÔNG tự xóa/sửa RQs hay coi quyết định điều chỉnh đã được duyệt. Processing/publication là thiết kế repo để sản phẩm mới thực sự searchable, không phải tên chức năng nguyên văn PDF.

### Target calendar đề xuất (capacity chưa xác nhận)

| Ngày | Lane product | Lane AI/evaluation + report | Gate |
| --- | --- | --- | --- |
|05–11/10|Release inventory/consolidation; account/auth/profile/password; chốt catalog/admin/publication contracts|Audit data coverage + split/dedupe; bộ query/qrels có owner; frozen baseline notebook; rà use-case/class/data diagrams và outline report|Không còn ambiguity scope/owner; benchmark runnable; account core có evidence|
|12–18/10|Product management/category/images/searchable update; history/interested products/result interactions; integrated permission journeys|So sánh embedding/fusion đã chốt; đo query metrics; cloud run chỉ sau handoff/đại diện xác nhận; viết methods và tables từ artifacts|Core proposal coverage có test; main experimental outputs available|
|19–23/10|Freeze feature; deploy+functional/E2E/security checks; fix blockers|Precision@K/Recall@K + end-to-end response-time report; failure analysis; finalize main results|Deployed release candidate, metrics traceable|
|24–28/10|Manual matrix + demo backup/video; no new architecture|Report/format/source packaging/slides; rehearsal cả nhóm|Submission candidate ready|
|29–31/10|Buffer fixes bounded, backup + submission|Cross-check claims/source/figures và final rehearsal|Nộp theo ngày thực tế|

Ngày chạy là targets cần owner/capacity, không bảo đảm full original research fit26 ngày. Nếu11/10 data/eval chưa runnable hoặc18/10 core/matrix tối thiểu chưa có evidence, báo đại diện/GVHD ngay để điều chỉnh kế hoạch; không cắt final-test integrity. Website polish/Qdrant migration/mobile/outfit/VTON không chiếm đường găng. Account và quản trị/history/saved không bị bỏ qua chỉ vì search demo đã đẹp.

Cần chốt tiếp: owner3 lanes và giờ rảnh thực tế mỗi người; GVHD đã duyệt mức research mở rộng nào. Control chỉ lập lịch; chưa dispatch writer/train/ship hoặc thay decisions.
