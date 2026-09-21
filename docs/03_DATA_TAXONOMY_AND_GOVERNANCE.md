# Dữ liệu taxonomy và quản trị

## Mục tiêu

Tạo dữ liệu đủ để huấn luyện, đánh giá và vận hành catalog mà không gây leakage. Tài liệu này phân biệt rõ dữ liệu public, catalog sản phẩm, training labels, intent cards, qrels và user data.

## Inventory dữ liệu

| Dataset artifact | Đơn vị | Owner | Versioning | Dùng cho |
|---|---|---|---|---|
| Product catalog | product version | Data/backend | snapshot immutable | Train, index, demo |
| Product group map | image/product | Data | immutable per snapshot | Dedupe và split |
| Taxonomy labels | product facet | Data/AI | raw plus reviewed | Tagger, filter, evidence |
| Image-text pairs | product-caption | AI | dataset manifest | RQ1 training |
| Composed triplets | anchor-mod-target | AI/eval | split/version | RQ2 training/eval |
| Query intent cards | query | Query author | freeze before pooling | RQ1-RQ3 gold intent |
| Raw judgments | query-product-assessor | Eval | append-only | Reliability/audit |
| Final qrels | query-product | Adjudicator | versioned frozen | Metrics |
| Hard-negative list | query-negative | AI | versioned | RQ2 Stage 4 |
| Parser responses | query-response | AI | date/hash freeze | RQ3 matrix |
| Search/event logs | request/event | Backend | retention policy | Debug/product metrics |
| VTON user assets | user/job | VTON | short-lived | Optional visualization |

## Candidate public datasets

### Fashion Product Images Dataset từ Myntra trên Kaggle

**Trạng thái: accepted cho Dataset A/catalog seed và baseline Week 4; không accepted làm benchmark tiếng Việt cuối.** Snapshot small tải ngày 08/09/2026 được pin bằng raw content manifest; audit chi tiết nằm tại [Dataset A card Week 4](week4/DATASET_A_CARD.v1.md). Dataset do Param Aggarwal công bố trên Kaggle có khoảng 44 nghìn sản phẩm, ảnh sản phẩm và bảng `styles.csv`. Các trường chính gồm `id`, `gender`, `masterCategory`, `subCategory`, `articleType`, `baseColour`, `season`, `year`, `usage` và `productDisplayName`. Bản full dùng ảnh độ phân giải cao; bản `fashion-product-images-small` giữ cùng quy mô catalog với ảnh nhẹ hơn, phù hợp để dựng vertical slice trước.

Vai trò được phép:

- seed catalog cho demo và kiểm thử ingest;
- frozen image/text retrieval baseline;
- fashion-domain image-text pairs từ ảnh cộng `productDisplayName` hoặc text view đã làm sạch;
- category, article type, color, season và usage weak labels;
- thử nghiệm mapping taxonomy, imbalance handling, dedupe và vector indexing.

Không coi dataset này là đủ cho toàn bộ đề tài vì:

- title và metadata chủ yếu bằng tiếng Anh, không tạo ra benchmark tiếng Việt;
- không có anchor-modification-target triplet cho composed retrieval;
- material, pattern, silhouette và vibe không đầy đủ hoặc không phải Gold label;
- không có graded qrels và natural Vietnamese queries;
- không có outfit-pair ground truth;
- không phải person-garment paired dataset cho VTON hoặc 3D;
- catalog chứa cả footwear, accessories, personal care và nhiều nhóm ngoài MVP;
- category distribution có thể mất cân bằng, có missing image/metadata và near-duplicate cần audit.

Quy trình dùng trong đồ án:

1. Pin chính xác Kaggle version, ngày tải và checksum.
2. Dùng bản small cho Phase 1 nếu cần tải và thử nhanh; chỉ chuyển sang full-resolution khi thí nghiệm chứng minh ảnh lớn mang lại lợi ích đáng kể.
3. Join ảnh với `styles.csv` bằng `id` và loại record thiếu ảnh hoặc metadata bắt buộc.
4. Filter về apparel rồi map `articleType` vào TOP, BOTTOM và ONE_PIECE; các nhóm khác giữ ngoài MVP thay vì xóa khỏi raw snapshot.
5. Cluster exact và near-duplicate trước khi split.
6. Dùng metadata gốc làm Bronze hoặc weak evidence; các facet suy ra bằng AI vẫn phải lưu confidence và qua selective human review.
7. Tạo caption tiếng Việt Silver riêng, nhưng final query và qrels phải do người Việt viết/chấm theo benchmark protocol.
8. Cấm để `productDisplayName` hoặc paraphrase quá sát target title lọt vào final query.

Nguồn:

- Full-resolution: <https://www.kaggle.com/datasets/paramaggarwal/fashion-product-images-dataset>
- Small: <https://www.kaggle.com/datasets/paramaggarwal/fashion-product-images-small>

### DeepFashion2

Phù hợp cho fashion-domain visual understanding, instance-level retrieval, category, landmarks và segmentation. Dùng sau khi audit access, mapping category và duplicate. Không coi captions của dataset là Vietnamese data.

### FashionGen

Phù hợp cho product image-text descriptions và domain alignment. Access có thể thay đổi nên phải có fallback. Nếu không lấy được hợp lệ hoặc metadata không đủ, dùng catalog product-description khác đã audit.

### FashionIQ

Phù hợp cho composed fashion retrieval vì có reference image, relative language feedback và target. Dùng để học composition pattern nhưng final Vietnamese test vẫn là custom native-human.

### CIRR

Là auxiliary composed retrieval dataset ngoài miền thời trang. Dùng để kiểm tra khả năng composition tổng quát hoặc tham khảo false-negative handling, không thay thế FashionIQ/custom fashion evaluation.

### Polyvore Outfits

Phù hợp cho outfit compatibility. Ưu tiên disjoint split để tránh item overlap. Chỉ mở sau core retrieval gates.

### Custom Vietnamese catalog

Là nguồn localization chính. MVP bắt đầu khoảng 1000 sản phẩm nếu khả thi, nhưng chất lượng, category balance và product group cleanliness quan trọng hơn số lượng thô. Nguồn và quyền sử dụng phải được ghi trong data card.

## Quyết định dùng nhiều dataset

Không concatenate mọi dataset rồi train một lần. Mỗi nguồn có một vai trò curriculum:

```text
Fashion visual/text pairs -> Stage 1 domain alignment
Vietnamese pairs          -> Stage 2 language alignment
Composed triplets         -> Stage 3 composition
Curated negatives         -> Stage 4 fine-grained discrimination
Balanced replay           -> Stage 5 consolidation
```

Điều này cho phép ablation có ý nghĩa và rollback theo stage.

## Data card bắt buộc

Mỗi nguồn dữ liệu có một data card gồm:

- tên, version, URL/source và ngày lấy;
- điều khoản hoặc quyền sử dụng đã kiểm tra;
- số product/images/pairs trước và sau cleaning;
- category/attribute/language distribution;
- duplicate/near-duplicate rate;
- missing fields và image quality;
- mapping vào taxonomy v1;
- split method;
- known limitations/bias;
- dùng ở training stage nào;
- có overlap tiềm năng với validation/test hoặc pretrained model benchmark không.

## Product identity và version

Phân biệt:

- `product_id`: khái niệm sản phẩm trong app.
- `product_version_id`: snapshot nội dung cụ thể.
- `product_group_id`: nhóm near-duplicate, variant hoặc cross-seller cùng mẫu.
- `image_id`: một asset có checksum/pHash.
- `embedding_id`: output của model/preprocessing cho một image/product version.

Mọi retrieval run rank `product_version_id` nhưng có thể collapse cùng `product_group_id` khi tính diversity hoặc qrels.

## Pipeline ingest

1. Lưu raw metadata và source reference.
2. Chuẩn hóa encoding, whitespace, currency-independent text và image format.
3. Tính exact checksum để loại file trùng byte.
4. Tính pHash và title similarity để cluster near-duplicate.
5. Validate image resolution, aspect ratio và corrupt file.
6. Map source category vào taxonomy category.
7. Chạy tagger và lưu prediction từng facet.
8. Áp confidence threshold per attribute/class.
9. Review required items.
10. Tạo text views/captions và embeddings.
11. Publish snapshot hoặc incremental version.

## Dedupe

### Exact duplicate

Image checksum giống nhau được nối vào cùng asset hoặc duplicate group.

### Near-image duplicate

Perceptual hash Hamming distance dưới threshold candidate. Threshold chốt bằng validation sample, không chọn tùy ý. Có thể kết hợp image embedding similarity để giảm false positive.

### Product duplicate

Title normalization cộng brand/source attributes và visual similarity. Reviewer kiểm tra các cluster gần threshold. Mọi member cluster vào cùng split.

### Cross-seller duplicate

Không giả định seller khác là product khác. Nếu ảnh, title hoặc mẫu quá giống, giữ cùng group để tránh model nhớ ảnh rồi xuất hiện ở test.

## Split order

```text
Raw products
 -> dedupe/group
 -> assign group split
 -> generate image-text pairs within split
 -> generate composed anchor-target pairs within split
 -> author queries for validation/test
```

Không tạo pair trước rồi mới split. Cấm mọi cạnh anchor-target đi xuyên split.

## Taxonomy design principles

1. Canonical value là stable ID, display label có thể đổi.
2. Alias tiếng Việt, không dấu, English loanword và seller wording map về canonical value.
3. `unknown` khác `other` và khác `not_applicable`.
4. Physical attribute và semantic inference tách provenance.
5. Multi-label chỉ dùng khi bản chất có thể cùng đúng.
6. Mọi taxonomy change có migration plan và version bump.
7. RQ test freeze giữ taxonomy version riêng; không reinterpret qrels bằng version mới.

## Taxonomy MVP

### Category

Root categories:

- TOP;
- BOTTOM;
- ONE_PIECE.

Subcategory seed:

- TOP: t-shirt, shirt, blouse, polo, crop_top, tank_top, sweater.
- BOTTOM: jeans, trousers, shorts, skirt, leggings.
- ONE_PIECE: dress, jumpsuit, romper.

Outerwear, footwear và accessories ở taxonomy future nhưng không active trong MVP catalog.

### Color

Canonical family trước, shade sau:

- black, white, gray;
- red, orange, yellow;
- green, blue, purple, pink;
- brown, beige_cream;
- metallic, multicolor.

Nếu image không đủ phân biệt be/kem, trả `beige_cream` và confidence thấp. Không ép một shade giả chính xác.

### Material

Seed values: cotton, linen, denim, wool, knit, polyester, silk_satin, leather, faux_leather, chiffon, lace, velvet, blended, unknown.

Material từ ảnh đơn thường không chắc chắn. Kết hợp image, seller text và review; evidence phải ghi source.

### Pattern

solid, stripe, check, floral, polka_dot, graphic, animal, geometric, abstract, textured, multicolor_mixed, unknown.

### Audience

women, men, unisex, kids, unknown. Đây là metadata catalog, không suy luận giới tính người dùng từ ảnh.

### Category-specific facets

Các field chi tiết nằm trong [taxonomy.v1.yaml](../config/taxonomy.v1.yaml). Rule `applicable_to` quyết định `not_applicable`.

### Semantic layer

Vibe/style seed: minimalist, streetwear, vintage, preppy, romantic, sporty, elegant, casual, formal, bohemian, edgy.

Occasion seed: daily, work, school, date, party, wedding_guest, beach, travel, sport.

Season seed: warm, transitional, cool, all_season.

Formality có ordinal scale từ very_casual đến formal. Semantic labels có confidence và có thể disagree giữa annotators.

## Tagger output

Mỗi facet prediction:

```json
{
  "attribute": "material",
  "value": "linen",
  "confidence": 0.68,
  "source": ["image", "seller_text"],
  "model_version": "tagger-v0.3",
  "taxonomy_version": "1.0.0",
  "decision": "REVIEW_REQUIRED"
}
```

Không tin confidence raw nếu chưa calibration. Threshold table có key `(attribute, class)` và được freeze theo tagger version.

## Data flywheel

### Sampling score

Active review queue có thể kết hợp:

```text
priority = w1 uncertainty + w2 disagreement + w3 diversity
         + w4 error-frequency + w5 random-audit
```

Weights tune ở development environment. Luôn giữ random audit để ước lượng lỗi ở phần model tự tin.

### Maturity stages

#### 0 đến 200 reviewed labels

- sửa prompt;
- thêm aliases;
- sửa deterministic conflicts;
- phân biệt unknown/other;
- kiểm tra label guideline.

#### 200 đến 1000 labels

- reliability diagram;
- threshold per attribute/class;
- selective auto-accept;
- active sampling;
- error matrix.

#### Đủ nhãn theo nhóm thuộc tính

- train linear probe hoặc small classifier;
- LoRA/adapter nếu cần;
- giữ frozen gold test;
- chỉ promote khi precision ở auto-accept lane đạt target.

Con số 500 hoặc 1000 không phải phép màu. Decision dựa trên class support, label quality, learning curve và validation uncertainty.

## Vietnamese text construction

### Bronze

- machine translate English captions;
- LLM generate aliases, query templates và paraphrases;
- automatic normalization;
- train only.

### Silver

- human correct translationese;
- seller/product text cleaned;
- confidence-selected review;
- train/validation.

### Gold

- native-human written from intent;
- raw wording giữ nguyên;
- author metadata và reviewer validation;
- no model tuning.

Không normalize dấu/teencode trước khi lưu raw. Có thể tạo normalized view cho model nhưng phải giữ raw query để slice analysis.

## Data leakage checklist

- [ ] pHash/title cluster hoàn tất trước split.
- [ ] Product group chỉ ở một split.
- [ ] Anchor và target cùng split.
- [ ] Test target unseen trong train.
- [ ] Test author không thấy title/triplet/train queries.
- [ ] Query freeze trước pooling.
- [ ] Template family holdout.
- [ ] LLM-generated data không vào Gold test.
- [ ] Hard-negative miner không dùng model đang tự train để mine online.
- [ ] Pretrained baseline overlap được audit và ghi limitation.

## Data artifact naming

```text
catalog-YYYYMMDD-vN
taxonomy-vMAJOR.MINOR.PATCH
split-grouped-vN
queries-rq1-gold-vN
queries-rq2-composed-vN
qrels-raw-vN
qrels-final-vN
negatives-stage4-vN
parser-responses-vN-YYYYMMDD
```

Không dùng tên `final_final_v2`.
