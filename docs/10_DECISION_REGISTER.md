# Sổ quyết định đồ án

## Mục đích

Tài liệu này ghi những quyết định đã được nhóm thống nhất. Trạng thái **Locked** có nghĩa là không thay đổi chỉ vì một thử nghiệm đơn lẻ hoặc sở thích triển khai. Muốn thay đổi phải có bằng chứng, tác động và phiên bản mới. Trạng thái **Conditional** có nghĩa là quyết định đã có hướng ưu tiên nhưng còn phụ thuộc data audit hoặc pilot.

## Quy trình thay đổi

Mỗi change proposal phải có:

- mã quyết định bị ảnh hưởng;
- vấn đề hoặc bằng chứng mới;
- phương án cũ và phương án mới;
- tác động đến dữ liệu, test freeze, model, API, UI và báo cáo;
- yêu cầu tái chạy experiment nào;
- người duyệt và ngày hiệu lực.

Không sửa hoặc ghi đè artifact cũ. Tạo version mới và giữ provenance.

## Danh sách quyết định

| ID | Quyết định | Trạng thái | Hệ quả chính |
|---|---|---|---|
| D001 | Core là tìm kiếm sản phẩm thời trang bằng ảnh và mô tả tự nhiên tiếng Việt | Locked | Mọi feature khác phải hỗ trợ hoặc tách khỏi core benchmark |
| D002 | Loại đồ MVP gồm TOP, BOTTOM và ONE_PIECE | Locked | Outerwear, footwear và accessories để sau |
| D003 | Không xây full e-commerce, POS, thanh toán, vận chuyển, loyalty hoặc kế toán | Locked | Seller catalog chỉ phục vụ nguồn sản phẩm có kiểm soát |
| D004 | Seller hoặc shop đăng sản phẩm, AI gắn nhãn, human review, tạo embedding rồi publish catalog | Locked | Có CRUD, dashboard, job bất đồng bộ và audit log |
| D005 | Lựa chọn cũ: Flutter cho Web/Android/iOS và FastAPI làm backend công khai | Superseded 10/09/2026 by D054/D055 | Giữ để truy vết lịch sử; không dùng làm yêu cầu triển khai hiện hành |
| D006 | FAISS là index nghiên cứu mặc định; PostgreSQL lưu metadata; object storage lưu ảnh | Locked | Index phải xây riêng theo checkpoint và snapshot |
| D007 | Taxonomy gồm physical layer, category-specific layer và semantic layer | Locked | Vibe nằm semantic layer, không nằm global physical attributes |
| D008 | Global attributes gồm category, color, material, pattern và audience | Locked | Material bắt buộc; vibe là soft/probabilistic |
| D009 | Data quality đi theo Bronze, Silver và Gold | Locked | Bronze không được vào final test; Gold do người viết native và được chấm độc lập |
| D010 | Data flywheel quay từ compare về active review | Locked | Lỗi thực nghiệm tạo sampling ưu tiên cho vòng gắn nhãn tiếp theo |
| D011 | Threshold confidence theo attribute và class, không dùng một số chung | Locked | Giá trị 0.75 chỉ là ví dụ, phải tune trên validation |
| D012 | Split theo product_group hoặc near-duplicate cluster trước khi tạo pair | Locked | Cấm cùng mẫu hoặc biến thể lọt qua train và test |
| D013 | Final test đóng băng, query khác title, hold out template family | Locked | Không sửa model bằng quan sát test |
| D014 | Annotation dùng grade 0 đến 3 và bảy reason code đã thống nhất | Locked | INSUFFICIENT_PRODUCT_INFORMATION là CANNOT_JUDGE, không phải grade 0 |
| D015 | Kappa tính trên raw judgments trước adjudication | Locked | Báo quadratic weighted kappa chính, thêm linear và agreement diagnostics |
| D016 | Author của query không được chấm query đó | Locked | Adjudicator không thấy grades và system identity |
| D017 | RQ1 chỉ đánh Vietnamese text to image retrieval | Locked | Không parser, taxonomy filter, reranker hoặc composed fusion trong RQ1 |
| D018 | RQ1 dùng frozen multilingual baseline và frozen ViCLIP-OT challenger | Locked | Ghi exact checkpoint, preprocessing và hash |
| D019 | RQ1 dùng nDCG at 10 primary, MRR strict/relaxed và Recall supporting | Locked | So sánh bằng paired bootstrap 95 percent CI |
| D020 | Slice ngôn ngữ là multi-label trên các trục register, orthography, code switching và negation | Locked | Native human là origin, không phải slice độc quyền |
| D021 | RQ1 chạy 3-way chỉ khi có Stage 1 English fashion data sạch; nếu không chạy 2-way | Conditional | Không tạo một fashion stage giả tạo |
| D022 | Training theo curriculum Stage 0 đến Stage 4 và Stage 5 consolidation ngắn tùy chọn | Locked | Stage 5 là challenger, rollback về Stage 4 nếu không thắng validation |
| D023 | Epoch không phải mục tiêu; chọn checkpoint bằng validation và guardrail | Locked | Ghi steps, examples seen, GPU-hours, early stopping và seeds |
| D024 | T4 là compute mặc định cho PyTorch; TPU chỉ dùng khi pipeline XLA đã được chứng minh | Locked | Giảm rủi ro chuyển framework và debug |
| D025 | RQ2 có Panel A modality/fusion và Panel B training regime | Locked | Không dồn bảy hàng thành một causal ladder giả |
| D026 | Equal-weight dùng alpha 0.5; fixed alpha fit trên train; adaptive dùng scalar gate theo input | Locked | Encoder freeze trong Panel A |
| D027 | RQ2 có 400 query gồm 240 controlled và 160 natural | Locked | Sáu primary attribute có 40 controlled query mỗi loại |
| D028 | TargetRecall chạy trên 400; pooled graded evaluation khoảng 100 gồm 60 controlled và 40 natural | Locked | Pooled set có khoảng 10 controlled query mỗi attribute, không phải 40 |
| D029 | ConstraintSatisfied trong RQ2 dùng gold intent và gold judged facets | Locked | Parser quality chỉ được đưa vào RQ3 |
| D030 | Hard negatives loại designated target, alternate positives và item thỏa hard constraints | Locked | Non-target không tự động là negative |
| D031 | Curated miner freeze tại Stage 2, negative list versioned và ghi provenance | Locked | Contamination trên 5 percent sau audit buộc tạo negatives v2 và retrain |
| D032 | Text-only và adaptive alpha có health gates chốt trước test | Locked | Text shortcut hoặc gate collapse phải điều tra trên validation |
| D033 | RQ3 dùng ma trận Gold hoặc Predicted intent nhân Gold hoặc Production facets | Locked | Báo interaction và mỗi snapshot thành bảng riêng |
| D034 | Gold plus gold là oracle-input trong frozen judged candidate pool, không phải global ceiling | Locked | Báo Ideal at N và CandidateRecall at N |
| D035 | Search output có Exact, Substitute và Unverified lanes | Locked | Category và explicit must_not không bao giờ relax |
| D036 | Constraint có attribute, operator, value, reference, priority và source | Locked | Hỗ trợ relative edit như dài hơn và ít formal hơn |
| D037 | Relax inferred trước explicit trong cùng priority tier | Locked | Tie-break deterministic và versioned |
| D038 | Confidence dưới threshold thành UNKNOWN; log unknown source | Locked | Threshold lấy từ calibrated validation |
| D039 | Inventory answerable được tính bằng code từ gold facets | Locked | Unanswerable queries giữ lại để test fallback behavior |
| D040 | Evidence completeness là metric; deterministic consistency là CI assertion | Locked | Mismatch quá epsilon làm invalid run |
| D041 | Faithfulness được chấm theo từng factual claim và min-rule contradiction | Locked | Một contradicted claim làm explanation fail |
| D042 | Latency báo component và end to end p50 p95 theo N 50, 100, 200 | Locked | Chọn N trên validation rồi freeze |
| D043 | Parser báo set F1, operator, scope negation, calibration và repair/corruption tests | Locked | Correlation chỉ là association, repair là intervention |
| D044 | Outfit MVP dùng general compatibility và context rerank, personalization là future work | Locked | Không dùng lịch sử hành vi trong core compatibility MVP |
| D045 | Explainable compatibility mặc định dùng named factors và GA2M | Locked | Latent branch chạy shadow, hybrid phải khai latent weight |
| D046 | Counterfactual chỉ trỏ đến sản phẩm active có thật trong catalog | Locked | Không có candidate hợp lệ thì fallback im lặng |
| D047 | VTON và 3D tách hoàn toàn khỏi retrieval benchmark | Locked | Có evaluation riêng và không claim cải thiện RQ1 đến RQ3 |
| D048 | VTON MVP ưu tiên top plus bottom, outerwear layering là future work | Locked | Multi-garment fail có thể fallback thử từng món và phải nói rõ |
| D049 | Guided capture dùng khung pose, ảnh toàn thân có quần áo phù hợp, không yêu cầu ảnh nude | Locked | Hard fail và soft warning phải có hành động cụ thể |
| D050 | User image có consent, retention, deletion và no-training-by-default controls | Locked | Disclaimer không thay thế trách nhiệm bảo vệ dữ liệu của hệ thống |
| D051 | Giữ Fashion Product Images Dataset của Param Aggarwal trên Kaggle làm Dataset A cho catalog seed và baseline; snapshot small 08/09/2026 đã pass audit Week 4 | Locked | Pin bằng raw content manifest; không dùng một mình thay benchmark tiếng Việt, composed triplets, outfit hoặc VTON data |
| D052 | Frozen engineering baseline Week 4 là `openai/clip-vit-base-patch32` revision `092a3b7e31726acc3a0207eea00f6040ac8b03a7` | Locked | Chứng minh CLIP-compatible vertical slice; không thay quyết định multilingual baseline còn mở cho RQ1 |
| D053 | Week 4 vertical slice dùng 600 sản phẩm cân bằng và bắt buộc chạy text, image, composed; challenger thứ hai chỉ mở sau khi baseline/gate xanh | Locked | Thay scope Phase 1 cũ 100-200 và image/composed optional cho đợt Week 4; mọi output vẫn pilot-only |
| D054 | Website dùng Next.js/TypeScript; backend nghiệp vụ và API công khai dùng Java Spring Boot; Python/PyTorch/FAISS phục vụ AI qua FastAPI nội bộ | Locked 10/09/2026 | Spring Boot quản lý auth, catalog, history, quyền và orchestration; AI service tái sử dụng core Python Week 4, không viết lại encoder/index bằng Java |
| D055 | Website là deliverable bắt buộc; mobile là mở rộng tùy thời gian sau website/search core, kiểm thử, triển khai và báo cáo | Locked 10/09/2026 | Không yêu cầu Android/iOS để đạt Gate 6; framework mobile chưa chọn và client tương lai dùng cùng API Spring Boot |
| D056 | Website dùng session cookie server-side do Spring Boot sở hữu, lưu phiên bằng Spring Session JDBC trong PostgreSQL | Locked 24/09/2026 | Browser chỉ giữ session ID `HttpOnly`; không phát Access/Refresh Token; CSRF bảo vệ thao tác ghi, phiên được đổi ID khi login và hủy khi logout. Xem [ADR 0001](adr/0001-server-session-for-website.md). |

## Change record CP-20260910-STACK

- Quyết định bị ảnh hưởng: D005, O007 và O008; được thay bằng D054/D055.
- Bằng chứng: đề cương CNTT-KLCN198 mục 5–7 và rubric mục 9 yêu cầu website, Backend API và tích hợp tìm kiếm; mục 7 nêu Java Spring Boot và Next.js. Đề cương không liệt kê mobile là deliverable bắt buộc. Nhóm yêu cầu đổi stack trong trao đổi ngày 10/09/2026 để tập trung đồ án định hướng tích hợp.
- Phương án cũ: một client Flutter cho Web/Android/iOS, backend công khai FastAPI. Phương án mới: Next.js frontend, Spring Boot backend nghiệp vụ, dịch vụ Python AI nội bộ và worker dùng lại `ai/ml/`.
- Trade-off: giảm số nền tảng UI phải hoàn thiện; thêm ranh giới Java–Python cần contract, timeout, version propagation và đo latency toàn tuyến. Tốc độ thực hiện còn phụ thuộc kinh nghiệm React/Java của nhóm, không coi đây là kết luận benchmark giữa framework.
- Tác động: sửa scope, kiến trúc, roadmap, phase playbook, sơ đồ và tài liệu bàn giao. Spring Boot sở hữu dữ liệu nghiệp vụ và auth; AI service sở hữu thực thi embedding/search và artifact model/index, không lặp lại user/role/CRUD. Next.js không xây backend nghiệp vụ thứ hai.
- Dữ liệu/model: không thay taxonomy, schema nghiên cứu, dataset/catalog, checkpoint, fusion, query/qrels hoặc final-test freeze. Baseline CLI Week 4 vẫn là nguồn tái lập; dịch vụ HTTP là adapter triển khai sau.
- Kiểm thử/tái chạy: thay đổi tài liệu này không cần tái chạy thí nghiệm. Khi tích hợp phải kiểm tra contract Java–Python, ba chế độ tìm kiếm, lỗi/timeout và latency website → Spring Boot → AI service; không dùng latency CLI hiện tại làm latency website.
- Người duyệt: nhóm sinh viên, qua yêu cầu trực tiếp của đại diện nhóm ngày 10/09/2026. Có hiệu lực cùng ngày; đây không phải xác nhận đã được GVHD duyệt. Trình bày kiến trúc và kế hoạch Web-first ở buổi gặp kế tiếp, không còn chặn việc cập nhật tài liệu vì O007/O008.
- Phiên bản: tài liệu kiến trúc/scope cập nhật ngày 10/09/2026; các gói Word/ZIP v1 giữ là snapshot lịch sử và chưa phản ánh D054/D055.

## Quyết định còn mở

| ID | Câu hỏi | Hạn chốt |
|---|---|---|
| O001 | Exact multilingual baseline checkpoint nào | Trước Phase 1 baseline run |
| O002 | Stage 1 có đủ English fashion captions sạch để chạy 3-way không | Kết thúc data audit Phase 2 |
| O003 | Sáu primary edit attribute chính thức và cardinality taxonomy v1 | Trước authoring RQ2 controlled queries |
| O004 | Ngưỡng health gate L1 và L2 chính xác | Sau validation pilot, trước final test |
| O005 | Rerank depth N được chọn | Sau RQ3 validation latency curve |
| O006 | Bonus ưu tiên Outfit Compatibility hay VTON 3D | Sau khi RQ1 đến RQ3 đạt gate |

## Câu hỏi đã giải quyết

| ID | Kết luận | Căn cứ/trạng thái |
|---|---|---|
| O007 | Chọn Next.js + Spring Boot; FastAPI chỉ là adapter nội bộ cho AI Python | D054, nhóm chốt 10/09/2026 theo mục 7 đề cương; thông báo GVHD ở buổi gặp kế tiếp |
| O008 | Mobile là mở rộng tùy thời gian, không nằm trong gate website | D055, nhóm chốt 10/09/2026 theo deliverable hiện hành; chưa có quyết định bổ sung khác từ GVHD |
