# Ánh xạ sang đề cương báo cáo Word và bảo vệ

## Mục đích

Tài liệu này giúp chuyển artifact kỹ thuật thành văn bản học thuật đúng hình thức. Bản Word cũ có khung bìa/mục lục nhưng phần nội dung POS, tồn kho, thanh toán, khuyến mãi và loyalty không phù hợp với core đề tài, nên không tái sử dụng các yêu cầu đó.

Cập nhật scope/stack ngày 10/09/2026 theo [D054/D055](10_DECISION_REGISTER.md): website Next.js/TypeScript, API nghiệp vụ Java Spring Boot và AI Python/FastAPI nội bộ. Word tổng hợp và ZIP v1 trong `deliverables/` là snapshot lịch sử chưa phản ánh thay đổi này; dùng nội dung Markdown hiện tại cho lần xuất bản tiếp theo.

## Tên đề tài đề nghị

**Xây dựng hệ thống tìm kiếm sản phẩm thời trang dựa trên hình ảnh và mô tả ngôn ngữ tự nhiên**

Tên tiếng Anh tham khảo:

**Building a Multimodal Fashion Product Search System Using Images and Natural Language Descriptions**

Nếu muốn nhấn tiếng Việt và composed retrieval trong báo cáo nghiên cứu, có thể dùng subtitle thay vì đổi tên đề tài đã đăng ký.

## Nội dung đề cương

### Lý do chọn đề tài

- Fashion search phụ thuộc mạnh vào hình ảnh và thuộc tính khó diễn đạt bằng keyword.
- General search engine có catalog lớn nhưng không tối ưu cho taxonomy thời trang, composed modification, Vietnamese colloquial/negation và explanation.
- Vision-language embedding cho phép biểu diễn ảnh và text trong cùng vector space.
- Cần đánh giá khoa học thay vì chỉ demo.

### Mục tiêu tổng quát

Xây dựng và đánh giá một website tích hợp tìm kiếm sản phẩm thời trang từ ảnh, tiếng Việt tự nhiên và truy vấn kết hợp ảnh-văn bản, sử dụng taxonomy để kiểm soát thuộc tính và giải thích kết quả.

### Mục tiêu cụ thể

1. Xây dựng catalog/taxonomy MVP TOP, BOTTOM, ONE_PIECE.
2. Thích nghi vision-language model cho miền thời trang và tiếng Việt.
3. Xây dựng composed retrieval với fusion và hard negatives.
4. Xây dựng parser, taxonomy filter/reranker và evidence.
5. Tạo benchmark graded relevance native-human.
6. Triển khai website Next.js/TypeScript, backend nghiệp vụ Java Spring Boot và AI service Python/FastAPI nội bộ tái sử dụng core PyTorch/FAISS.
7. Nghiên cứu bonus compatibility/VTON nếu core hoàn tất.

### Đối tượng và phạm vi

- Đối tượng: multimodal embeddings, fashion attributes, Vietnamese queries, composed retrieval, taxonomy-aware reranking.
- Catalog MVP: TOP/BOTTOM/ONE_PIECE.
- Platform bắt buộc: website. Mobile là mở rộng tùy thời gian sau website/search core, kiểm thử, triển khai và báo cáo; chưa chọn framework mobile.
- Không gồm commerce transaction/POS.
- VTON/3D là module bổ trợ hoặc future work.

### Câu hỏi nghiên cứu

Dùng nguyên văn RQ1-RQ3 trong Research Protocol. Đề cương chỉ nêu design dự kiến; không điền kết quả chưa chạy.

### Phương pháp

- Literature review và dataset audit.
- Curriculum fine-tuning.
- Ablation/controlled experiments.
- Human relevance judging và qrels.
- Paired bootstrap và slice/error analysis.
- API-first software design, tích hợp Java–Python qua contract có version và triển khai website.

### Kết quả dự kiến

- Model/checkpoints và vector index.
- Taxonomy/data pipeline.
- Vietnamese benchmark và annotation guideline.
- Bảng RQ1-RQ3.
- Website demo với ba chế độ search qua API Spring Boot và AI service Python nội bộ.
- Mobile demo chỉ khi còn thời gian sau website/search core, kiểm thử, triển khai và báo cáo.
- Optional compatibility/VTON prototype.

### Kế hoạch

Dùng Phase 0-8 và điền ngày thực tế theo lịch trường. Không hứa bonus trước core gate.

## Cấu trúc báo cáo cuối đề nghị

### Phần đầu

- Bìa ngoài và bìa phụ theo mẫu trường.
- Lời cảm ơn.
- Lời cam đoan nếu trường yêu cầu.
- Tóm tắt tiếng Việt và Abstract.
- Mục lục.
- Danh mục chữ viết tắt.
- Danh mục hình và bảng.

### Chương 1 Tổng quan

1. Bối cảnh và vấn đề.
2. Khoảng trống: Vietnamese/fine-grained/composed/explainable.
3. Mục tiêu và RQs.
4. Phạm vi và đối tượng.
5. Đóng góp.
6. Cấu trúc báo cáo.

Nguồn chính: Master Blueprint, Scope và Decision Register.

### Chương 2 Cơ sở lý thuyết và công trình liên quan

1. Information retrieval và vector search.
2. Vision-language contrastive learning và CLIP.
3. Multilingual/fashion CLIP.
4. Composed image retrieval.
5. Fashion taxonomy và attribute extraction.
6. Relevance evaluation, nDCG, MRR, pooling và agreement.
7. Explainable reranking và GA2M.
8. Outfit compatibility.
9. VTON/SMPL-X nếu feature được triển khai.

Không biến chương này thành danh sách paper. Mỗi nhóm công trình phải kết thúc bằng limitation liên quan đến đề tài.

### Chương 3 Dữ liệu taxonomy và benchmark

1. Dataset selection và data cards.
2. Catalog collection/cleaning.
3. Taxonomy design.
4. Bronze/Silver/Gold.
5. Dedupe và group split.
6. Query authoring/intent cards.
7. Pooling/judging/adjudication.
8. Benchmark statistics và quality.

Nguồn: Data/Taxonomy và Benchmark docs.

### Chương 4 Phương pháp đề xuất

1. System overview.
2. Retrieval encoder và vector space.
3. Curriculum Stage 0-5.
4. Composed fusion.
5. Hard-negative mining.
6. Parser và structured intent.
7. Taxonomy filter/reranker.
8. Result lanes/evidence.
9. Optional compatibility/VTON design.

Nguồn: Research Protocol, Training, Architecture và Bonus docs.

### Chương 5 Thực nghiệm và kết quả

1. Hardware/software/config.
2. RQ1 setup/results/slices.
3. RQ2 Panel A/B/results.
4. RQ3 matrix/coverage/evidence/latency.
5. Statistical uncertainty.
6. Error analysis.
7. Threats to validity.

Mỗi RQ nên kết thúc bằng câu trả lời trực tiếp, không chỉ bảng số.

### Chương 6 Phân tích thiết kế và triển khai hệ thống

1. Actors/use cases.
2. Requirements.
3. Architecture/components.
4. Database/domain model.
5. Sequence flows.
6. API/index/job consistency.
7. Website UI; mobile chỉ trình bày nếu phần mở rộng đã triển khai.
8. Deployment, security và privacy.
9. System testing.

### Chương 7 Kết luận và hướng phát triển

- Trả lời lại từng RQ bằng bằng chứng.
- Đóng góp đã đạt.
- Limitations: data size, pooled judgments, parser/tagger errors, catalog coverage, VTON artifacts.
- Future: outerwear, footwear, personalization, multi-layer outfit, better 3D.

## Bảng/hình nên chuẩn bị

### Bảng

1. Dataset statistics trước/sau cleaning.
2. Taxonomy facets và coverage.
3. Query/style/slice distribution.
4. Agreement and confusion matrix.
5. RQ1 overall/slices.
6. RQ2 Panel A.
7. RQ2 Panel B và contamination.
8. RQ3 matrix 2x2.
9. Parser/tagger metrics.
10. System latency and compute.
11. Failure taxonomy.

### Hình

1. Tổng thể architecture.
2. Data flywheel.
3. Training curriculum.
4. RQ dependency.
5. Embedding visualization có phương pháp rõ như UMAP/t-SNE, không dùng làm bằng chứng định lượng chính.
6. Alpha distribution theo attribute.
7. RQ3 latency-quality Pareto curve.
8. Exact/Substitute/Unverified UI.
9. Seller ingestion/review flow.
10. Optional outfit/VTON qualitative grid gồm cả failure.

## Cách trình bày bảng kết quả

- Ghi mean và 95 percent CI hoặc CI cho paired delta.
- Bold chỉ best valid result; không bold những số không so sánh được.
- Có support N cho slice.
- Có run ID dưới bảng hoặc appendix.
- Không trộn validation và test rows.
- Không dùng `accuracy cao/loss thấp` làm claim nếu metric retrieval không hỗ trợ.

## Threats to validity cần nêu

### Internal validity

- Extra training steps confound nếu không có control.
- Tagger/parser contamination.
- Hard-negative false negatives.
- Human judgment disagreement.

### Construct validity

- Designated target không đại diện mọi valid result.
- Vibe chủ quan.
- nDCG phụ thuộc grade/gain definition.
- ConstraintSatisfied không đo usefulness toàn diện.

### External validity

- Chỉ TOP/BOTTOM/ONE_PIECE.
- Catalog Việt quy mô nhỏ.
- Query do team viết chưa hoàn toàn giống traffic thực.
- Model/provider version có thể thay đổi.

### Statistical conclusion validity

- Slice nhỏ.
- Multiple comparisons.
- Seed variance.
- Incomplete judgments/pooling.

## Kịch bản bảo vệ

### Câu chuyện 12-15 phút

1. Vấn đề và khác biệt với search engine lớn.
2. Taxonomy/benchmark là nền móng.
3. RQ1: model hiểu tiếng Việt ở đâu.
4. RQ2: ảnh và text đóng góp thế nào.
5. RQ3: gold-to-production degradation và explanation.
6. Demo seller publish và user composed search.
7. Error/failure case trung thực.
8. Bonus feature nếu ổn.

### Demo path

1. Seller tạo product và review AI tag.
2. User tìm bằng text tiếng Việt colloquial.
3. User chọn product làm anchor và sửa color/material.
4. UI cho thấy Exact/Substitute/Unverified.
5. Mở evidence.
6. Optional chọn top-bottom compatibility/VTON.

### Backup

- Local demo data/index.
- Screen recording.
- Static screenshots.
- Cached parser output nếu external API lỗi.
- Slide có architecture và result table để vẫn bảo vệ được research.

## Những câu hỏi phản biện dự kiến

| Câu hỏi | Cách trả lời bằng artifact |
|---|---|
| Sao không so Google/TikTok | Scope/novelty: fine-grained Vietnamese composed retrieval và controlled benchmark |
| Vì sao ba dataset | Mỗi nguồn phục vụ một curriculum stage khác nhau |
| Vì sao 30 epoch | Không cố định epoch; chọn bằng validation/steps/early stopping |
| Model hơn do train lâu hơn | English continuation control hoặc giới hạn claim cumulative ablation |
| Pool bỏ sót item tốt | Known-target recall, outside-pool audit, CandidateRecall/Ideal@N |
| Vibe ai quyết định | Soft probabilistic label, human agreement và không hard filter mặc định |
| Explanation có bịa không | Evidence consistency assertion và claim-level faithfulness |
| Parser/tagger làm sai thì sao | Matrix 2x2, UNKNOWN lane, repair/corruption |
| Vì sao Next.js + Spring Boot | Bám website và stack nêu trong đề cương; giảm số client phải hoàn thiện, phân công Web/backend rõ; tiến độ phụ thuộc kinh nghiệm nhóm và cần trả chi phí contract Java–Python |
| Có viết lại AI bằng Java không | Không; Python/FastAPI nội bộ và worker dùng lại `ai/ml/`, PyTorch/FAISS. Spring Boot sở hữu auth/CRUD/history/quyền và điều phối |
| Mobile có bắt buộc không | D055 xác định là mở rộng tùy thời gian sau website/search core, kiểm thử, triển khai và báo cáo; framework chưa chọn |
| 3D có thực tế không | Prototype tách benchmark, guided capture/manual correction và limitations |

## Hình thức Word

Khi chuyển thành bản nộp:

- Dùng mẫu bìa/trường chính thức mới nhất.
- A4, font và margin theo quy định khoa.
- Heading styles thật để tạo mục lục.
- Caption và cross-reference tự động.
- Phương trình dùng Word Equation.
- Table/Figure numbering theo chương nếu trường yêu cầu.
- Tài liệu tham khảo IEEE hoặc chuẩn giảng viên yêu cầu, dùng thống nhất một chuẩn.
- Không copy placeholder, số liệu giả hoặc nội dung POS từ bản cũ.
