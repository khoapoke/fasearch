# Protocol nghiên cứu RQ1 đến RQ3

## Mục tiêu

Protocol này định nghĩa trước câu hỏi, đối chứng, dữ liệu, metric, thống kê và điều kiện diễn giải. Mọi final experiment phải trỏ đến version của tài liệu này trong experiment manifest.

## Nguyên tắc chung

1. Final test được đóng băng trước khi chọn final model.
2. Split theo product group và near-duplicate cluster.
3. Query khác product title và test author bị blind với training triplets.
4. Mọi system chạy trên cùng query/candidate snapshot khi thiết kế yêu cầu paired comparison.
5. Không chọn hyperparameter trên final test.
6. Mọi bảng kết quả ghi model, parser, tagger, catalog, qrels và code version.
7. Báo effect size và uncertainty, không chỉ báo một con số tốt nhất.
8. Negative hoặc null result vẫn được giữ và phân tích.

## Đơn vị phân tích

- Retrieval unit: query.
- Document unit: product version hoặc product group tùy metric; protocol phải ghi rõ.
- Pair unit cho RQ2: anchor product group, modification intent, target product group.
- Explanation unit: factual claim trong một query-result explanation.
- Latency unit: một request ở concurrency và cache state đã định nghĩa.

## RQ1 Vietnamese fashion retrieval

### Research question

Việc thích nghi miền thời trang và tiếng Việt cải thiện text-to-image retrieval trên query tiếng Việt native-human đến mức nào so với frozen multilingual và Vietnamese-specific baselines?

### Hypotheses

- H1a: Vietnamese-adapted model tăng nDCG at 10 so với frozen multilingual baseline.
- H1b: Vietnamese-adapted model không kém ViCLIP-OT trên overall primary metric và cải thiện ít nhất một fashion-language slice có đủ support.
- H1c: Compositional negation vẫn khó hơn lexicalized negation, kể cả sau adaptation.

H1b chỉ được gọi là confirmatory nếu exact baseline checkpoint và minimum practical effect được chốt trước test. Nếu không, trình bày exploratory.

### Arms

| Arm | Train history | Dùng khi |
|---|---|---|
| RQ1-B0 | Frozen multilingual | Bắt buộc |
| RQ1-B1 | Frozen ViCLIP-OT | Bắt buộc nếu checkpoint chạy được và data-overlap audit pass |
| RQ1-M1 | Fashion adaptation | Khi English fashion data tách riêng pass audit |
| RQ1-M2 | Fashion/Vietnamese adaptation | Bắt buộc |
| RQ1-C1 | English continuation control | Optional để cô lập extra-step effect |

### Control conditions

- Cùng product catalog snapshot và qrels.
- Mỗi encoder xây index riêng; không dùng embedding của model khác.
- Dùng preprocessing chính thức của mỗi checkpoint nhưng log đầy đủ.
- Search metric cosine trên L2-normalized vector.
- Cùng K và qrels interpretation.
- Không parser/reranker/filter.

### Metrics

```text
Primary: nDCG@10, grade 0-3
Secondary: MRR@10 strict, first grade >=2
Secondary: MRR@10 relaxed, first grade >=1
Supporting: Recall@10, Recall@50
```

Nếu không có relevant item trong top K, reciprocal rank bằng 0. Unjudged item được xử theo pooling protocol, không âm thầm map grade 0 trong analysis chính.

### Statistical analysis

- Resample query IDs với replacement trong paired bootstrap.
- Tối thiểu 10,000 bootstrap replicates cho final table nếu compute cho phép.
- Báo mean delta và percentile hoặc BCa 95 percent CI; chọn một cách trước final run.
- Primary comparison ưu tiên M2 với B0 và B1.
- Nếu kiểm định nhiều confirmatory hypotheses, dùng Holm correction; slice analysis còn lại ghi exploratory.
- Không dùng luật cứng `chênh 2 percent là significant`.

### Slice schema

Origin của final test luôn là native_human. Các trục còn lại multi-label:

- generation_mode;
- register;
- orthography;
- language_mix;
- negation_type;
- query complexity và số hard/soft constraints.

Code-switch phải tách lexicalized loanword khỏi true code-switch. Negation phải tách lexicalized attribute khỏi compositional exclusion.

### Sample size rule

- Overall Gold final test: target 200 đến 300, minimum 200.
- Slice support dưới 20: descriptive only.
- Từ 20 đến 39: exploratory estimate với CI.
- Từ 40: cho phép conditional conclusion nếu CI đủ rõ.
- Query có thể đóng góp nhiều slice nhưng intersection nhỏ không được phóng đại.

### RQ1 exit criteria

- Baseline và proposed model runs reproducible.
- Overall table, paired deltas và CI hoàn chỉnh.
- Slice support table đi kèm metric table.
- Error examples có reason code, không cherry-pick chỉ success.
- Exact checkpoint để chuyển sang RQ2 được khóa.

## RQ2 Composed multimodal retrieval

### Research question

Fusion strategy và fine-grained hard negatives giúp retrieval từ anchor image cộng Vietnamese modification tốt hơn bao nhiêu?

### Hypotheses

- H2a: Multimodal fusion vượt image-only và text-only TargetRecall.
- H2b: Adaptive scalar gate vượt equal-weight và global fixed-weight trên validation/final primary metric.
- H2c: Curated one-violation hard negatives tăng constraint satisfaction hoặc graded relevance mà không làm giảm TargetRecall guardrail quá mức.
- H2d: Stage 5 consolidation chỉ được promote nếu tăng primary metric và giữ retention guardrails.

### Data budget

```text
Full set: 400 queries
  Controlled: 240 = 6 primary edit families x 40
  Natural: 160

Automatic evaluation: all 400 TargetRecall
Judged pool subset: approximately 100
  Controlled: 60 = 6 x 10
  Natural: 40
```

Do pool chỉ có 10 controlled queries mỗi family, per-attribute nDCG/ConstraintSatisfied cần gộp natural occurrences hoặc ghi exploratory. Per-attribute TargetRecall trên full controlled set có support 40.

### Intent source

RQ2 luôn dùng Gold intent card để tính ConstraintSatisfied. Product facets dùng Gold trên judged pool. Không dùng parser output trong RQ2 vì sẽ confound retrieval với RQ3.

### Panel A design

| Arm | Alpha | Fit | Trainable component |
|---|---:|---|---|
| A0 image-only | 1.0 | Không | Không |
| A1 text-only | 0.0 | Không | Không |
| A2 equal-weight | 0.5 | Không | Không |
| A3 fixed-weight | Một scalar | Grid search trên train | Scalar hoặc chọn grid |
| A4 adaptive | Per-query scalar | Train set | Small gate only |

Encoder checkpoint được freeze. Nếu A4 thay embedding dimension, thêm residual tower hoặc unfreeze encoder, đó là experiment khác.

### Alpha diagnostics

Log cho mỗi query:

- alpha;
- primary/all edit attributes;
- query complexity;
- success/failure;
- anchor-target similarity;
- text length.

Gate L2 flag nếu alpha variance gần 0, phần lớn alpha nằm sát 0/1, hoặc attribute cần text rõ nhưng alpha liên tục về image-only. Exact threshold được tune trên validation và freeze.

### Text-only leakage gate

Text-only có thể mạnh vì modification tự chứa target hoặc lộ title. L1 threshold `tau_text_only` được chọn trên development set; vùng 0.35 đến 0.40 là trigger ban đầu. Khi trigger:

1. Tính lexical overlap với target title.
2. Kiểm tra author có thấy title/training phrase không.
3. Phân loại self-contained hợp lệ và leakage.
4. Sửa data collection protocol, không sửa final query hậu nghiệm.

### Panel B design

| Arm | Negatives | Regime | Compute reporting |
|---|---|---|---|
| B0 | Random/in-batch | Stage 3/4 control | steps, batch, GPU-hours |
| B1 | Curated hard | Cùng architecture và budget gần tương đương | steps, mining cost, GPU-hours |
| B2 | B1 plus joint consolidation package | Balanced replay plus retention distillation | toàn bộ sub-change checklist |

### Negative construction

Tier 1 curated:

1. Mine similarity bằng frozen Stage 2 encoder.
2. Exclude target/product group/grade>=1/full-hard-match.
3. Filter candidate có violation_count đúng 1.
4. Sort similarity sau filter.
5. Lưu negative_id, query_id, violated facet, provenance, miner checkpoint và list version.

Tier 2 random/in-batch:

- Không kỳ vọng purity tuyệt đối.
- Estimate contamination trên sample hoặc qrels intersection.
- Báo tỷ lệ, không che giấu.

Sau judging, nếu curated contamination vượt 5 percent thì tạo v2, retrain affected arms và giữ v1 artifact để audit.

### RQ2 metrics

- TargetRecall@K trên 400.
- nDCG@10 trên judged subset.
- ConstraintSatisfied@K trên judged subset, hard constraints only.
- MRR strict/relaxed nếu qrels support.
- Per-attribute TargetRecall.
- Multi-attribute stress-test result.
- Alpha diagnostics và L1/L2 gate results.

### RQ2 exit criteria

- Panel A và B tách riêng trong báo cáo.
- Mỗi row chỉ được diễn giải đúng biến thay đổi.
- Negative list versioned, contamination audited.
- Stage 5 có promotion decision bằng validation, không bằng test.
- Checkpoint/index cho RQ3 được khóa.

## RQ3 Taxonomy-aware retrieval and explainability

### Research question

Taxonomy-aware parser/filter/reranker cải thiện constraint satisfaction và relevance ra sao trong oracle và production conditions, với trade-off coverage, evidence faithfulness và latency nào?

### Hypotheses

- H3a: T_GG tăng ConstraintSatisfied@10 so với dense D trong cùng candidate pool.
- H3b: T_PP vẫn giữ deployment gain dương sau parser/facet degradation.
- H3c: Relaxation policy giảm blank-page UX nhưng không che ZeroResultRate_exact.
- H3d: Deterministic evidence đạt consistency assertion và verbalization có contradicted-claim rate thấp.

### Factorial matrix

| Cell | Intent | Product facets | Isolates |
|---|---|---|---|
| T_GG | Gold | Gold | Oracle-input taxonomy system |
| T_PG | Predicted | Gold | Parser effect dưới gold facets |
| T_GP | Gold | Production | Tagger effect dưới gold intent |
| T_PP | Predicted | Production | End-to-end production simulation |

Mỗi cell dùng cùng reranker code, candidate set và score config. Interaction tính bằng difference-in-differences. Nếu muốn phân bổ total degradation thành hai contribution đối xứng, có thể báo Shapley-style decomposition trong appendix; không bắt buộc.

### Candidate ceiling

- CandidateRecall@N: relevant item hiện diện trong dense top-N.
- Ideal@N: ranking tối ưu theo qrels trong top-N.
- T_GG: output của taxonomy algorithm với gold input, không đồng nhất Ideal@N.
- Gold matrix chỉ được claim trong judged candidate pool.

### Provenance snapshot

Mỗi matrix table có:

- catalog_snapshot_id;
- qrels_version;
- parser model/prompt/schema version;
- frozen parser response date và hash;
- tagger checkpoint/threshold table;
- taxonomy/factor/reranker version;
- code commit và environment.

Version mới sinh table mới, không overwrite.

### Three-valued constraints

```text
SATISFIED: facet đủ tin cậy và thỏa operator
VIOLATED: facet đủ tin cậy và vi phạm operator
UNKNOWN: missing, abstained hoặc dưới confidence threshold
```

Must_not semantics:

- Known forbidden value: VIOLATED.
- Known non-forbidden value: SATISFIED.
- Unknown value: UNKNOWN, không gọi exact.

### Relaxation algorithm

1. Xây exact verified set bằng toàn hard constraints.
2. Nếu exact count dưới display target L, giữ exact section nguyên vẹn.
3. Tạo substitute candidates, không bao giờ relax category hoặc explicit must_not.
4. Sort relax candidates theo priority tăng dần; trong cùng priority relax inferred trước explicit.
5. Mỗi step chỉ relax một constraint và recompute.
6. Ghi relaxed constraint và score delta vào evidence.
7. Unknown critical facets vào Unverified, không trộn Exact.

### Coverage metrics

- ZeroResultRate_exact.
- Shortfall@L với denominator cố định L.
- RelaxationRate.
- Mean number of relaxed constraints.
- UnverifiedRate và unknown source breakdown.
- DisplayedConstraintViolation@K.
- Answerable và unanswerable slices.

`inventory_answerable` được code-check bằng Gold facets. Natural query không có exact item vẫn được giữ để kiểm tra fallback honesty.

### Evidence gates

EvidenceCompleteness kiểm schema tự động. EvidenceConsistency recompute score/decision deterministic trong epsilon; fail assertion làm invalid run và phải sửa code. Dense latent score không bị buộc decomposable nhưng phải được ghi rõ.

Verbalization được split thành factual claims. Hai assessor chấm Entailed, Unsupported hoặc Contradicted. Min-rule: một Contradicted claim làm explanation fail. Báo claim entailed rate, unsupported rate, contradicted rate và explanation pass rate.

### Parser evaluation

- Exact intent match.
- Constraint tuple micro/macro precision, recall, F1.
- Logical bucket routing accuracy.
- Attribute/value/operator/reference accuracy.
- Negation detection và scope accuracy.
- Confidence ECE/Brier hoặc calibration plot.
- Accuracy-coverage/risk-coverage khi abstain.

Gold-repair sửa một field predicted sai rồi rerun. Gold-corruption làm sai một field gold có kiểm soát. Báo downstream delta theo field; correlation đơn thuần không được gọi là causal proof.

### Latency protocol

Rerank N thuộc 50, 100, 200. Chạy cùng catalog snapshot, precomputed embeddings, batch size 1 và fixed concurrency cho interactive path. Ghi warm-up, repetitions, CPU/GPU/RAM và cache state.

Report:

- parser, query encoder, dense lookup, rerank, evidence builder p50/p95;
- end-to-end p50/p95 wall clock;
- CandidateRecall@N, nDCG@10, ConstraintSatisfied@10, Shortfall@10;
- external API retries/timeouts nếu có.

Accuracy dùng frozen parser responses. Latency của external parser dùng uncached live calls có timestamp/model version. Chọn N trên validation rồi run test một lần.

### RQ3 exit criteria

- D và đủ bốn matrix cells có provenance.
- CandidateRecall và Ideal@N được báo.
- Lanes/relaxation deterministic và có unit tests.
- Evidence consistency assertion pass 100 percent cho deterministic branch.
- Claim-level faithfulness sample hoàn tất.
- Latency Pareto curve và N decision được freeze.

## Cross-RQ integrity checklist

- [ ] RQ1 query không vô tình chạy qua parser/reranker.
- [ ] RQ2 ConstraintSatisfied dùng Gold intent.
- [ ] RQ3 candidate set/snapshot giống giữa matrix cells.
- [ ] Product group split được áp dụng trước pair generation.
- [ ] Query author khác assessor.
- [ ] Raw judgments chưa bị sửa sau adjudication.
- [ ] Final test chưa được dùng để chọn stage/threshold/N.
- [ ] Mọi table có run IDs và confidence interval khi thích hợp.
