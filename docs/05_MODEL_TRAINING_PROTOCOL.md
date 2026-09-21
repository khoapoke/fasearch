# Protocol huấn luyện model

## Mục tiêu

Huấn luyện theo curriculum có checkpoint rõ, tránh vừa thay dữ liệu, kiến trúc và loss rồi không biết yếu tố nào tạo ra thay đổi. Primary selection dựa trên validation retrieval metrics, không dựa trên train loss hoặc số epoch.

## Module naming

Không dùng một chữ cái Model E cho nhiều ý nghĩa. Tên module thống nhất:

| ID logic | Module | Trách nhiệm |
|---|---|---|
| RET | Retrieval Encoder | Image/text representation và candidate retrieval |
| CMP | Composed Combiner | Ghép anchor image và modification text |
| TAG | Attribute Tagger | Product facets và confidence |
| PAR | Intent Parser | Query thành structured intent |
| RER | Taxonomy Reranker | Constraint state, lanes và score |
| EXP | Evidence Verbalizer | JSON evidence thành lời giải thích |
| OUTFIT | Compatibility Scorer | General top-bottom compatibility |
| VTON | Virtual Try-On | Optional visualization |

Mỗi module có version namespace riêng.

## Compute strategy

### T4 mặc định

- Native PyTorch support.
- Dễ dùng mixed precision và Hugging Face/OpenCLIP tooling.
- FAISS/CUDA workflow quen thuộc.
- Dễ reproduce local hoặc GPU cloud khác.

### TPU v5e tùy chọn

Chỉ dùng nếu code đã tương thích PyTorch/XLA hoặc JAX, data pipeline không nghẽn và benchmark nhỏ chứng minh throughput tốt hơn. Không đổi accelerator giữa arms của cùng ablation nếu điều đó làm khác numerical/config behavior.

### Compute logging

Mỗi run ghi:

- accelerator model/count;
- wall-clock và GPU-hours;
- precision mode;
- peak memory;
- data-loader workers;
- effective batch size;
- steps/examples seen;
- evaluation frequency.

## Common training controls

1. Seed Python, NumPy, framework và sampler khi khả thi.
2. Lưu exact train/validation manifest hash.
3. Dùng deterministic preprocessing version.
4. Save best checkpoint theo validation primary metric.
5. Lưu last checkpoint riêng để resume, không mặc định dùng làm best.
6. Early stopping dựa trên eval cycles, không chỉ epoch.
7. Log train loss, validation loss và retrieval metrics cùng nhau.
8. Rebuild catalog embeddings/index cho từng checkpoint được đánh giá.
9. Không reuse index của checkpoint khác.
10. Final shortlisted configuration chạy nhiều seed nếu compute cho phép.

## Loss primitives

### Symmetric contrastive loss

Với batch image/text pairs, tính similarity matrix và cross entropy theo cả image-to-text và text-to-image. Temperature/logit scale được log và giới hạn hợp lý.

### Multi-positive contrastive loss

Khi một query có nhiều valid products, positive mask chứa toàn bộ grade>=1 hoặc curated positive theo training policy. Không ép alternate positive thành negative.

### Triplet hoặc ranking loss

Composed query cần gần target hơn negative với margin. Nếu kết hợp contrastive và ranking loss, weights phải có ablation hoặc được coi là một package rõ ràng.

### Retention distillation

Stage 5 dùng teacher Stage 4 hoặc Stage 2/4 snapshots để hạn chế quên RQ1/RQ2 capability. Distillation target, temperature và replay ratio được ghi trong config.

## Stage 0 Frozen baselines

### Input

- Catalog pilot hoặc snapshot v1.
- Exact pretrained checkpoint.
- Query validation set.

### Việc làm

1. Implement official preprocessing.
2. Encode image catalog.
3. Encode text queries.
4. Build FAISS index.
5. Run text-to-image and optional image-to-image sanity checks.
6. Save per-query run file and metrics.

### Output

- `checkpoint_manifest`;
- embeddings/index snapshot;
- RQ1 baseline table draft;
- failure examples;
- throughput/memory baseline.

### Gate

- No NaN/zero embeddings.
- L2 norms within tolerance after normalization.
- Repeated run yields same top-K except documented ANN nondeterminism.
- Product IDs map correctly to index rows.

## Stage 1 Fashion domain alignment

### Decision gate

Stage 1 chỉ chạy như một RQ1 rung riêng khi có English fashion image-text pairs đủ sạch. Nếu data chủ yếu Vietnamese Shopee/Yody-style captions thì đi thẳng frozen đến Vietnamese fashion adaptation và đổi claim thành 2-way.

### Recommended progression

1. Freeze image tower, train text projector/head để sanity check.
2. Unfreeze top text layers hoặc dùng LoRA.
3. Chỉ unfreeze image tower nếu validation gain và compute hợp lý.
4. Dùng hard fashion in-batch examples sau khi baseline ổn.

### Metrics và guardrails

- Fashion validation retrieval.
- Generic/multilingual retention sample.
- Category balance.
- Overfit gap.

### Exit

Checkpoint M1 được chọn trên validation, embeddings/index rebuild và data exposure logged.

## Stage 2 Vietnamese alignment

### Data mix

- Silver native/corrected Vietnamese pairs là chính.
- Bronze translation/synthetic hỗ trợ coverage.
- English fashion replay giữ domain knowledge.
- Gold final test tuyệt đối không tham gia.

### Text views

Một product có thể có nhiều positive texts:

- seller title cleaned;
- product description summary;
- taxonomy verbalization;
- native paraphrase;
- colloquial/no-diacritic augmentation ở train only.

Augmentation phải giữ semantic intent. Phủ định không được thêm/xóa ngẫu nhiên.

### Training order

1. Train language-side projector/adapters.
2. Evaluate RQ1 validation overall và slices.
3. Tune sampling ratios trên validation.
4. Optional controlled unfreeze.
5. Lock Stage 2 checkpoint để mine hard negatives.

### Exit

- RQ1 validation win hoặc justified null result.
- No major English/fashion retention regression.
- Stage 2 miner checkpoint immutable.

## Stage 3 Composed retrieval

### Input tuple

```text
(anchor image, modification text, target image, intent card, split ID)
```

### Architecture ladder

- image-only;
- text-only;
- equal-weight alpha 0.5;
- fixed scalar alpha;
- adaptive scalar gate.

Panel A encoder freeze. Adaptive gate input có thể gồm image/text embeddings, norms trước normalization, text length hoặc encoded interaction features nếu được predeclared. Output vẫn là scalar alpha trong [0,1].

### Query representation

```text
ei = L2Norm(image_encoder(anchor))
et = L2Norm(text_encoder(modification))
alpha = gate(ei, et)
q = L2Norm(alpha*ei + (1-alpha)*et)
```

### Data safeguards

- Pair within split.
- Target title unseen by test author.
- Holdout template family.
- Human-authored final test.
- Lexical overlap audit.
- Multi-positive handling.

### Exit

Panel A table complete; adaptive gate only selected if validation supports it. Alpha diagnostics saved even if model loses.

## Stage 4 Fine-grained hard negatives

### Miner freeze

Use Stage 2 checkpoint, not current evolving Stage 4 model, for curated list v1. This prevents feedback loop where model defines its own truth.

### Candidate algorithm

```text
retrieve similar same-category products
 -> exclude target/product group/known positives/full-hard-match
 -> compute gold/silver constraint violations
 -> keep violation_count == 1
 -> sort by similarity
 -> sample by attribute balance
```

### Provenance

Each record:

```yaml
query_id:
negative_product_id:
violated_attribute:
provenance: gold_facet_based | silver_fallback
miner_checkpoint:
taxonomy_version:
list_version:
```

### Fair comparison

Between B0 and B1 hold as close as possible:

- architecture;
- initialization;
- batch/effective negatives count;
- optimizer and schedule;
- steps/examples seen;
- evaluation intervals;
- seeds.

Mining preprocessing cost được báo riêng.

### Audit

After pooling, intersect negative IDs with grade>=1. Report contamination by provenance and attribute. Above 5 percent curated contamination invalidates v1 for final claim.

## Stage 5 Joint consolidation

### Purpose

Thử kết hợp short joint fine-tune sau curriculum để các objective hỗ trợ nhau mà không làm model quên capability trước.

### Package

- initialize from best Stage 4;
- short schedule;
- balanced replay RQ1/RQ2 data;
- retention distillation;
- lower learning rate;
- validation on primary and guardrail suites.

### Promotion rule

Stage 5 được promote chỉ khi:

1. Primary validation metric tăng vượt minimum practical threshold đã chốt.
2. RQ1 strict metric không regression quá guardrail.
3. RQ2 TargetRecall/ConstraintSatisfied không regression quá guardrail.
4. No slice catastrophic failure.
5. Compute cost được chấp nhận.

Nếu không, production/research model giữ Stage 4. Null result vẫn được báo như ablation.

## Attribute Tagger training

### Bootstrap phase

- Vision-capable LLM hoặc zero-shot classifier tạo initial labels.
- Seller metadata làm weak evidence, không tự động là gold.
- Prompt/rules được versioned.
- Human review tập trung ambiguity và class coverage.

### Calibration phase

- Train/validation split theo product group.
- Reliability diagram per attribute/class.
- Chọn auto-accept, review và reject/unknown thresholds.
- Báo precision tại auto-accept coverage.

### Fine-tune trigger

Fine-tune local khi mỗi attribute group có đủ class support chất lượng và rule/prompt đã đạt plateau. Model nhỏ có thể dùng frozen image embedding cộng classifier head trước LoRA/full fine-tune.

## Intent Parser

### Output contract

Parser phải trả JSON valid theo intent schema, canonical taxonomy IDs và per-constraint confidence. Temperature thấp/deterministic khi dùng external LLM; raw response và parsed response đều freeze.

### Development loop

1. Rules/aliases cho lexical patterns rõ.
2. LLM structured mapping cho câu tự do.
3. Validation against gold intent cards.
4. Calibrate/abstain threshold.
5. Error slices: code-switch, no-diacritic, lexical/compositional negation, relative operator.
6. Local fine-tune chỉ khi có đủ gold intent tuples.

## Outfit Compatibility

### Named factors

Deterministic/taxonomy-derived factor functions tạo scalar có tên. GA2M học univariate functions và limited pairwise interactions. Data split phải disjoint theo product groups.

### Latent challenger

Top/bottom embeddings vào MLP chỉ chạy shadow. Hybrid evidence phải ghi latent weight; explanation không được gán exact contribution cho latent branch.

### Evaluation

- AUC compatibility;
- FITB accuracy;
- calibration;
- factor ablation;
- counterfactual delta;
- human golden-pair sanity set.

## Checkpoint registry

Mỗi checkpoint có:

- model ID/version;
- parent checkpoint;
- stage;
- architecture/config hash;
- train/validation data hashes;
- code commit;
- seed;
- best metric and step;
- hardware/GPU-hours;
- license/dependency notes;
- embedding/index snapshots built from it;
- status candidate/promoted/rejected.

## Failure and rollback

| Failure | Action |
|---|---|
| Train loss NaN | Stop, inspect precision/logit scale/data, do not continue from corrupt state |
| Validation decreases | Restore best checkpoint, inspect sampling and overfit |
| Stage gain but slice collapse | Reject or document if guardrail breached |
| Index/model mismatch | Invalidate run, rebuild index |
| Hard-negative contamination >5 percent | Create v2 list and retrain affected arms |
| Stage 5 loses | Keep Stage 4, report result |
| Parser provider changed | Freeze new response artifact and create new RQ3 table |

## Pre-final checklist

- [ ] Hyperparameters selected only on train/validation.
- [ ] Final test access logged.
- [ ] Exact checkpoint and preprocessing hashes present.
- [ ] Index rebuilt and linked.
- [ ] At least primary comparison has paired CI.
- [ ] Seeds and GPU-hours reported.
- [ ] Failure cases retained.
- [ ] No fake accuracy inferred from train loss.
