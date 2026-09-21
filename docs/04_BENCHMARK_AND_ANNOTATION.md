# Benchmark và hướng dẫn annotation

## Mục tiêu

Tạo một test collection có thể tái sử dụng cho RQ1 đến RQ3, trong đó query intent, candidate pool, raw judgments và final qrels được phân biệt rõ.

## Artifact graph

```text
Query text + Intent card frozen
              |
              v
Multiple retrieval runs -> Candidate pool -> Independent judgments
                                              |
                                Raw qrels + disagreement
                                              |
                                   Blind adjudication
                                              |
                                      Final qrels
```

Raw judgments không bị sửa khi final qrels hình thành.

## Query authoring protocol

1. Author nhận task card, được xem đúng thông tin được phép.
2. Author viết raw query tiếng Việt theo intent, không copy title.
3. Author hoàn thành intent card trước khi xem retrieval result.
4. Author gắn writing-style metadata.
5. Một reviewer khác kiểm metadata, không rewrite câu cho đẹp.
6. Query và intent được freeze, cấp hash/version.
7. Author bị loại khỏi toàn bộ assessor list của query đó.

## Controlled và natural queries

### Taxonomy-controlled

Dùng template family ở mức intent, không ép câu chữ cố định. Mục tiêu là phủ đều category, attribute, negation và complexity.

Ví dụ task card:

```yaml
target_category: ONE_PIECE
primary_attribute: material
required_value: linen
secondary_constraints:
  pattern: floral
  occasion: beach
writing_style: colloquial
```

Author tự viết câu tự nhiên; task card không chứa product title.

### Natural

Team member viết như người mua thật, có thể dùng celebrity/style reference, không dấu, viết tắt hoặc code-switch. Author phải mô tả intent clarification ngay lúc tạo, trước khi biết result.

## Intent card

Năm bucket:

- `must_change`;
- `must_preserve`;
- `must_not`;
- `soft_preference`;
- `dont_care`.

Constraint tuple có attribute, operator, value, reference, priority, source và confidence nếu do parser sinh. Gold author card không cần confidence giả; có thể đặt 1.0 và `source=author_gold`.

## Gold intent examples

### Text query

Query: `váy linen hoa nhí đi biển, không lấp lánh`

```yaml
must_change:
  - {attribute: category, operator: EQ, value: dress}
  - {attribute: material, operator: EQ, value: linen}
  - {attribute: pattern, operator: EQ, value: floral_small}
must_not:
  - {attribute: surface_detail, operator: EQ, value: glitter}
soft_preference:
  - {attribute: occasion, operator: EQ, value: beach}
```

### Composed query

Query: `giống áo này nhưng màu đỏ đậm hơn và không có chữ`

```yaml
must_preserve:
  - {attribute: category, operator: SAME_AS, reference: anchor}
must_change:
  - {attribute: color, operator: DARKER_THAN, reference: anchor, value: red}
must_not:
  - {attribute: pattern, operator: IN, value: [graphic, text_print]}
```

## Pooling

### Runs đưa vào pool

- frozen multilingual;
- frozen Vietnamese-specific;
- adapted retrieval checkpoint;
- image-only, text-only và fusion variants cho RQ2;
- dense, oracle-input và production taxonomy variants cho RQ3;
- một diversity-oriented hoặc lexical/taxonomy run nếu có.

Pool lấy top depth đã chốt của mỗi run rồi union theo product group. Run identity bị ẩn với assessor.

### Chống pool miss

1. Known-target rank chạy trên toàn query set.
2. Outside-pool audit lấy sample từ deeper ranks của new/challenger systems.
3. Theo dõi tỷ lệ newly judged relevant ngoài pool.
4. Nếu tỷ lệ cao, mở rộng pool version và không so table dùng qrels cũ với table dùng qrels mới như cùng benchmark.

## Form judging

Assessor thấy:

- raw query;
- intent clarification frozen;
- candidate product images và approved metadata;
- rubric 0 đến 3;
- reason-code checklist;
- facet matched/violated/unknown fields;
- cannot-judge option.

Assessor không thấy:

- system name;
- rank gốc của từng run nếu UI có thể randomize;
- grade của người khác;
- author identity nếu không cần;
- expected target marker.

## Relevance grades

### Grade 3 Highly Relevant

Khớp category và toàn bộ hard intent, đồng thời đáp ứng phần lớn semantic context. User có thể chọn ngay mà không phải đổi yêu cầu.

Ví dụ: query `váy linen hoa nhí đi biển`; result là váy linen hoa nhí, phom thoáng/xòe và phù hợp ngữ cảnh biển.

### Grade 2 Relevant

Đúng nhu cầu chính và có thể mua, nhưng sai một thuộc tính phụ hoặc một khác biệt không làm thay đổi intent cốt lõi.

Ví dụ: váy hoa nhí cotton thay vì linen, trong khi category, pattern và occasion vẫn phù hợp.

### Grade 1 Acceptable Substitute

Không thỏa một major attribute nhưng vẫn là phương án có lý do để cân nhắc nhờ cùng category, silhouette hoặc vibe.

Ví dụ: váy trơn màu be cùng vintage/beach vibe thay cho váy hoa nhí.

### Grade 0 Irrelevant

Sai category, vi phạm phủ định cứng hoặc không còn đáp ứng intent sử dụng.

Ví dụ: query váy nhưng trả quần jeans.

## Hard constraints và grade

Grade không được tính cơ học chỉ bằng số facet match. Guideline ưu tiên:

1. Wrong category thường grade 0.
2. Explicit negation violation thường grade 0, trừ khi intent card đánh constraint không cứng.
3. Một major mismatch có thể grade 1 hoặc 2 tùy phần còn lại và buying viability.
4. Vibe-only match thường grade 1.
5. Occasion mismatch có thể grade 0 hoặc 1 tùy mức xung đột.
6. Missing information dùng CANNOT_JUDGE thay vì suy đoán grade.

## Reason codes

### WRONG_CATEGORY

Sai loại sản phẩm cốt lõi. Ví dụ tìm áo hai dây nhưng trả quần.

### NEGATION_VIOLATION

Vi phạm explicit negation. Ví dụ tìm váy không hoa nhưng trả váy hoa.

### MAJOR_ATTRIBUTE_MISMATCH

Sai một thuộc tính chính như color, material, pattern hoặc fit đã được intent xác định là hard/primary.

### MULTIPLE_MINOR_MISMATCHES

Hai hoặc nhiều sai khác nhỏ kết hợp làm kết quả giảm giá trị.

### VIBE_ONLY_MATCH

Đúng vibe nhưng sai các thuộc tính cứng. Hữu ích để phát hiện dense/CLIP shortcut.

### OCCASION_MISMATCH

Item có thể đẹp nhưng không phù hợp dịp yêu cầu.

### INSUFFICIENT_PRODUCT_INFORMATION

Ảnh hoặc metadata không đủ để chấm. Đây là status CANNOT_JUDGE. Judgment record không ghi grade 0 tự động.

Duplicate product không nằm reason code vì phải được collapse/dedupe trước judging.

## Raw judgment record

Mỗi record có:

- query_id;
- product_version_id và product_group_id;
- assessor_id pseudonymous;
- grade hoặc cannot_judge;
- reason codes;
- per-constraint status;
- free note optional;
- guideline_version;
- timestamp;
- intent_card_hash;
- UI/form version.

Không update record cũ. Correction tạo record mới có `supersedes` và lý do.

## Agreement

Hai assessor độc lập chấm overlap set. Báo:

- quadratic weighted Cohen kappa primary;
- linear weighted kappa;
- exact agreement;
- within-one agreement;
- grade confusion matrix;
- reason-code agreement có thể dùng per-label F1/Jaccard.

Kappa được tính trên raw pre-adjudication. Mục tiêu thực dụng lớn hơn 0.60; dưới 0.50 kích hoạt guideline workshop và vòng chấm mới, nhưng con số vòng cũ vẫn được báo.

## Adjudication

1. Query author đã ghi intent clarification trước pooling.
2. Adjudicator độc lập với author và hai initial assessors nếu nhân lực cho phép.
3. Adjudicator thấy query, intent card, item và guideline; không thấy grades, system hoặc rank source.
4. Final qrels ghi adjudicator decision và liên kết raw record IDs.
5. Không tính lại kappa trên qrels đã thống nhất.
6. Dispute pattern chỉ cập nhật guideline v2 cho vòng sau.

## Facet golding như byproduct

Khi assessor đánh matched/violated/unknown cho constraint, hệ thống tích lũy query-relevant facet evidence. Reviewer có thể xác nhận/correct product facet. Gold bắt buộc cho designated targets và judged pool items dùng trong RQ2/RQ3.

Không claim full-catalog gold. RQ3 gold matrix chỉ hoạt động trong frozen judged candidate pool; full-catalog simulation dùng production facets.

## Metric definitions

### Precision@K

Tỷ lệ top-K có grade đạt relevant threshold. Phải ghi strict `grade>=2` hoặc relaxed `grade>=1`.

### Recall@K

Tỷ lệ relevant items đã biết xuất hiện top-K. Với incomplete qrels, interpretation bị giới hạn; báo pool version.

### TargetRecall@K

Binary indicator designated target xuất hiện top-K. Chạy được tự động nhưng không coi mọi non-target là irrelevant.

### MRR@K

Reciprocal rank của first relevant trong top-K; không có thì 0. Báo strict và relaxed riêng.

### nDCG@K

Dùng grade 0 đến 3 và discount theo rank. Gain function phải chốt trong code/config, ví dụ exponential `2^grade-1`, rồi giữ cố định.

### ConstraintSatisfied@K

Số displayed results trong top-K thỏa toàn bộ gold hard constraints chia K. Soft preference không làm fail. UNKNOWN không được tính satisfied.

## Annotation workload plan

### Pilot

- 20 đến 30 query không thuộc final test.
- 2 assessor chấm overlap 100 percent.
- Sửa guideline, form, timing và unclear examples.

### Production round

- Query freeze.
- Pool build.
- Hai assessor overlap đủ lớn để tính kappa.
- Remaining pool có thể chia workload nhưng giữ blind.
- Cannot-judge queue được xử bằng metadata/image review riêng.

### Quality audit

- Random 5 đến 10 percent double-check.
- Check impossible timestamps hoặc patterned grades.
- Check author-assessor constraint.
- Check grade/reason logical conflicts.
- Check missing raw records trước adjudication.

## Deliverables

- `queries.jsonl`;
- `intent_cards.jsonl`;
- `pool.tsv`;
- `judgments_raw.jsonl`;
- `agreement_report.json`;
- `adjudication.jsonl`;
- `qrels_final.txt`;
- `facet_gold.jsonl`;
- annotation guideline PDF/DOCX khi nộp phụ lục;
- README có version và checksum.
