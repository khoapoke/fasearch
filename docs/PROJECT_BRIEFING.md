# Briefing đồ án — đọc nhanh trong 10 phút

> Tài liệu **dẫn xuất**: dùng để giới thiệu và bàn giao. Nó không thay thế nguồn sự thật.
> Thứ tự thẩm quyền vẫn theo [docs/README.md](README.md): đề cương chính thức → Decision Register và schema → Research Protocol → Master Blueprint và phase playbook.
> Cập nhật: 2026-09-10.

## 1. Một câu

Hệ thống tìm kiếm sản phẩm thời trang cho tiếng Việt: nhập ảnh, câu mô tả, hoặc ảnh + yêu cầu sửa đổi → trả về sản phẩm kèm **bằng chứng giải thích** vì sao kết quả đó được chọn.

## 2. Nhóm thực hiện

| Vai trò | Tên | MSSV |
|---|---|---|
| Thành viên | Tạ Minh Khoa | 2001230407 |
| Thành viên | Đỗ Hoàng Anh Khoa | 2001230395 |
| Thành viên | Trần Nhật Hào | 2001230213 |
| GVHD | Nguyễn Thị Định | — |

## 3. Ba câu hỏi nghiên cứu (đã khóa)

| RQ | Câu hỏi | Metric chính | Cô lập |
|---|---|---|---|
| RQ1 | Thích nghi miền thời trang + tiếng Việt giúp text-to-image retrieval tốt hơn frozen baseline bao nhiêu? | nDCG@10 (grade 0–3), paired bootstrap CI | Không parser, reranker, composed |
| RQ2 | Fusion và hard negative fine-grained giúp composed retrieval tốt hơn bao nhiêu? | TargetRecall@K trên 400 query, nDCG trên pool chấm | Gold intent + gold facets |
| RQ3 | Taxonomy-aware parse/filter/rerank cải thiện constraint satisfaction ra sao khi dùng input production? | ConstraintSatisfied@10, matrix 2×2, evidence, latency | Matrix Gold/Predicted × Gold/Production |

Nguyên tắc chung: final test đóng băng **trước** khi chọn model; không tune trên final test; null result vẫn phải báo.

## 4. Sản phẩm gồm gì

**Core bắt buộc**

- Tìm bằng text tiếng Việt, bằng ảnh, và composed (ảnh + mô tả sửa).
- Taxonomy để hiểu thuộc tính mịn và xử lý `must_not`.
- Kết quả chia 3 lane: **Exact / Substitute / Unverified**, kèm evidence.
- Seller CRUD, AI gắn nhãn, review queue, embedding/index có version.
- Website dùng API Spring Boot; client mobile tương lai (nếu làm) dùng cùng API.

**Bonus sau core**: outfit compatibility (GA2M + named factors), counterfactual, VTON/3D prototype.

**Ngoài phạm vi**: e-commerce đầy đủ (POS, thanh toán, vận chuyển), SLA production, đo body từ 1 ảnh, phán xét hình thể.

MVP catalog chỉ gồm **TOP, BOTTOM, ONE_PIECE**.

## 5. Stack và kiến trúc (cập nhật D054/D055 ngày 10/09/2026)

| Layer | Lựa chọn hiện hành |
|---|---|
| Website | Next.js + TypeScript (deliverable bắt buộc) |
| Backend nghiệp vụ / API công khai | Java Spring Boot, prefix `/v1` |
| AI nội bộ | Python: PyTorch + FAISS + core `ai/ml/`, qua adapter FastAPI nội bộ (không phải API công khai) |
| Training | PyTorch trên Colab T4 |
| Vector index | FAISS (`IndexFlatIP`, cosine trên vector chuẩn hóa L2) |
| Metadata | PostgreSQL (do Spring Boot sở hữu) |
| Queue | Redis + Celery/RQ |
| Object storage | S3-compatible |

Mobile là mở rộng tùy thời gian sau website/search core; framework chưa chọn.

Sơ đồ hiện hành: [system_architecture.web-v1.1.png](../tools/assets/system_architecture.web-v1.1.png), xem [00_MASTER_BLUEPRINT.md](00_MASTER_BLUEPRINT.md).

Luồng seller: `DRAFT → PROCESSING → NEEDS_REVIEW → INDEXED → ACTIVE` (hoặc `FAILED`, `ARCHIVED`).

## 6. Dữ liệu

Ba tầng chất lượng — quy tắc bất biến:

| Tầng | Nguồn | Dùng cho | Cấm |
|---|---|---|---|
| Bronze | máy dịch, LLM caption, weak label | pretraining, candidate generation | final test |
| Silver | người sửa chọn lọc | train, validation | thay Gold |
| Gold | người Việt viết tay, intent freeze, chấm độc lập | final evaluation | tune prompt/model |

- **Dataset A** (`paramaggarwal/fashion-product-images-small`, Kaggle, MIT): ~44k ảnh, dùng làm catalog seed và baseline. Không có query tiếng Việt, không có composed triplet, không có material/pattern/vibe Gold.
- **Benchmark tiếng Việt** do nhóm tự tạo: RQ1 mục tiêu 200–300 query Gold; RQ2 400 query (240 controlled + 160 natural), pool chấm ~100.
- Split theo **product_group** (dedupe pHash + title) trước khi tạo pair. Không để biến thể của cùng mẫu lọt qua cả train và test.
- Query author không được chấm query của mình; kappa tính trên raw judgment trước adjudication.

## 7. Hiện trạng — đang ở đâu

| Phase | Trạng thái |
|---|---|
| 0 Protocol freeze | **Xong** — schema, taxonomy, protocol, playbook |
| 1 Baseline vertical slice (Week 4) | **13/14 gate** — chờ rerun độc lập có ký |
| 2 Data foundation | Chưa mở |
| 3–5 RQ1–RQ3 | Chưa mở |
| 6 Web + mobile | Chưa mở |
| 7 Bonus | Chưa mở |
| 8 Report + defense | Chưa mở |

Baseline Week 4 đã có:

- Catalog 600 sản phẩm (200 TOP / 200 BOTTOM / 200 ONE_PIECE), seed 42, pin bằng hash.
- CLIP `openai/clip-vit-base-patch32` revision `092a3b7e31726acc3a0207eea00f6040ac8b03a7`, đóng băng.
- 600 embedding 512 chiều, chuẩn hóa L2; FAISS `IndexFlatIP` 600 dòng + row-to-product mapping.
- 3 mode tìm kiếm chạy thật; 24 pilot query; report metric + latency.
- 14 unit test + CPU smoke test pass; script `verify_week4_artifacts.py` kiểm provenance.

Mọi metric Week 4 là `pilot_only: true` — **không** phải benchmark cuối. Nhãn hiện tại sinh từ metadata (weak label), không có người chấm.

## 8. Gate còn lại và cách đóng

Mục 14/14: *"Thành viên khác chạy lại baseline theo README."*

```bash
# reviewer, trong máy sạch:
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock
.venv/bin/python scripts/download_dataset_a.py --variant small --output-dir data/raw/dataset_a
./scripts/run_cpu_smoke.sh          # 14 test pass, smoke PASS
./scripts/run_week4_baseline.sh     # rebuild + tự verify
.venv/bin/python scripts/verify_week4_artifacts.py
```

Bốn giá trị phải khớp:

| Giá trị | Kỳ vọng |
|---|---|
| Catalog SHA-256 | `82b21a099c92dbf42eca43475e6cea5459da3c3ff27fc528589ad85517f9da44` |
| Model revision | `092a3b7e31726acc3a0207eea00f6040ac8b03a7` |
| Model config hash | `a6a0317b924b6bece0b9cc8887d0ee53c1bf4ac51c00797f7514dce3e0bfeac8` |
| Index SHA-256 | `3de85fd6a4a8ce380726d3fef42c4592c8a0206101a2c3346e9157ebbe5c640b` |

Quy tắc: người ký phải **khác** người tạo lần chạy. Dùng đường CPU mặc định (không set `FASHION_SEARCH_DEVICE` / `FASHION_SEARCH_PRECISION`). Hash lệch thì ghi vào ô "Differences or blockers", không giấu.

Điền phiếu tại [week4/WEEK4_INDEPENDENT_RERUN.md](week4/WEEK4_INDEPENDENT_RERUN.md), sau đó cập nhật [week4/WEEK4_GATE_STATUS.md](week4/WEEK4_GATE_STATUS.md) thành 14/14.

## 9. Việc tiếp theo — Phase 2 (2–4 tuần)

| Mã | Việc | Deliverable |
|---|---|---|
| P2.1 | Audit Dataset A đầy đủ: license, missing rate, category mapping, duplicate, title leakage | data card + accept/reject |
| P2.2 | Scale catalog, exact dedupe, pHash cluster, gán product_group, map taxonomy | catalog v1 |
| P2.3 | Split theo group, stratify category, kiểm tra zero overlap | split manifest |
| P2.4 | Tagger bootstrap: version prompt/model, review 200 nhãn đầu, calibration, threshold theo attribute | threshold table |
| P2.5 | Vietnamese pairs: Bronze → Silver, đo translationese | training set |
| P2.6 | Annotation pilot 20–30 query mới, 2 assessor, đo thời gian/kappa | guideline v1 |
| P2.7 | Viết query Gold RQ1 (200–300) và RQ2 (400 = 240 + 160) | query + intent card |
| P2.8 | Freeze: hash query + intent, khóa quyền sửa | frozen artifacts |

**Gate 2** cần: nguồn dữ liệu accept/reject có lý do; product group overlap = 0; tagger threshold table; annotation pilot pass; query/intent freeze; test access được kiểm soát; số học RQ2 đúng (240 controlled = 6 family × 40).

Chia việc theo 3 stream:

- **A — AI & evaluation**: encoder, training, metric, RQ runs.
- **B — Data & backend**: catalog, schema, job, index, provenance.
- **C — Web & product (Next.js)**: UI website, seller/review/search flows.

Backend/UI có thể chạy song song từ Phase 1; research dependency vẫn tuần tự RQ1 → RQ2 → RQ3.

Ước lượng tương đối (sprint 1 tuần, nhóm 3 người): Phase 1: 1–2 tuần, Phase 2: 2–4 tuần, Phase 3: 2–3 tuần, Phase 4: 3–4 tuần, Phase 5: 2–3 tuần, Phase 6: 3–5 tuần (song song một phần), Phase 7: 1–4 tuần time-box, Phase 8: 2–4 tuần.

## 10. Đang chờ quyết định

| ID | Câu hỏi | Hạn chốt |
|---|---|---|
| O001 | Exact multilingual baseline checkpoint nào | Trước Phase 1 baseline run |
| O002 | Stage 1 có đủ English fashion captions sạch để chạy 3-way không | Kết thúc data audit Phase 2 |
| O003 | Sáu primary edit attribute chính thức và cardinality taxonomy v1 | Trước authoring RQ2 controlled |
| O004 | Ngưỡng health gate L1/L2 | Sau validation pilot, trước final test |
| O005 | Rerank depth N | Sau latency curve RQ3 |
| O006 | Bonus ưu tiên outfit compatibility hay VTON/3D | Sau khi RQ1–RQ3 đạt gate |

| ID | Kết luận | Căn cứ |
|---|---|---|
| O007 | Chọn Next.js + Spring Boot; FastAPI chỉ là adapter nội bộ cho AI Python | D054, nhóm chốt 10/09/2026 |
| O008 | Mobile là mở rộng tùy thời gian, không nằm trong gate website | D055, nhóm chốt 10/09/2026 |

## 11. FAQ cho người nhận package

**Dataset ở đâu?**
Kaggle `paramaggarwal/fashion-product-images-small`, tải bằng `ai/scripts/download_dataset_a.py`. Raw data và model không commit vào Git.

**Sao metric thấp vậy?**
Nhãn hiện tại do script sinh từ metadata (weak label), không có người chấm; recall thấp vì nhãn đánh dấu tới 200 sản phẩm nhưng chỉ hiện 10 kết quả. Mọi số đều là `pilot_only`, chưa dùng để claim chất lượng model.

**Sao không dùng dataset tiếng Việt luôn?**
Dataset A chỉ là catalog seed. Benchmark tiếng Việt do nhóm tự tạo và phải là Gold native-human — không có dataset công khai nào thay được.

**Vì sao phải chạy lại?**
Để chứng minh pipeline tái lập được từ máy khác, không phụ thuộc vào máy của người tạo. Đây là bằng chứng cho NFR-01 (reproducibility).

**Cần GPU không?**
Không. 600 ảnh chạy CPU được. Colab T4 là tùy chọn và tạo ra bundle khác (CUDA/float16), không dùng để so hash.

**Chạy mất bao lâu?**
Cài môi trường ~3–5 phút, dataset ~2–5 phút, model ~2–4 phút, encode + index + evaluate ~5–15 phút. Tổng khoảng 15–30 phút.

**Cần cài gì?**
Python 3.12, `ai/requirements.lock`, internet, ~2 GB đĩa trống, tài khoản Kaggle.

**Không có tài khoản Kaggle thì sao?**
Người gửi đưa kèm thư mục `ai/data/raw/dataset_a` đã nén (~1,26 GB). Giải nén vào đúng chỗ và **không** chạy script download. Ghi rõ ở ô "Git revision or shared snapshot".

**Làm sao biết chạy đúng?**
So 4 giá trị ở mục 8. `verify_week4_artifacts.py` sẽ tự kiểm tra norm, số dòng index, mapping và khớp hash.

**Bản Word và ZIP v1 còn dùng được không?**
Chưa. Hai artifact v1 trong `deliverables/` được giữ nguyên làm snapshot lịch sử. Dùng Markdown hiện tại và D054/D055 để triển khai; không lấy lựa chọn Flutter trong snapshot làm yêu cầu hiện hành.

**Mobile có bắt buộc không?**
Không. Website và API là bắt buộc (D055); mobile là mở rộng tùy thời gian, framework chưa chọn.

**Khi nào bắt đầu RQ1?**
Sau Gate 2: catalog/split/query freeze xong. Không chạy RQ trên catalog còn thay đổi.
