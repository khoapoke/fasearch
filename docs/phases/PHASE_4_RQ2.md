# Phase 4 RQ2 Composed Retrieval

## Outcome

Trả lời giá trị của từng modality, fusion expressiveness, hard negatives và Stage 5 package trên composed fashion retrieval.

## Inputs

- Frozen Stage 2 encoder/miner.
- 400 composed queries và gold intent cards.
- 100-query judged-subset plan.
- Product group split.
- Panel protocol.

## Steps

### P4.1 Validate composed data

- Anchor/target same split.
- No target title exposure.
- Primary/all edit attributes present.
- Query complexity present.
- Template family holdout pass.
- Known alternate positives not mislabeled.

### P4.2 Panel A

Run A0 to A4 with encoder frozen:

1. Image-only.
2. Text-only.
3. Equal alpha 0.5.
4. Fixed alpha fit on train.
5. Adaptive scalar gate.

Use same candidate catalog and evaluation code. Save alpha per query.

### P4.3 Health gates

L1:

- Compute text-only TargetRecall on validation.
- If above frozen threshold, audit target/title/template leakage.
- Resolve before final test without rewriting frozen test.

L2:

- Plot alpha distribution overall/by primary attribute.
- Check mean/variance/extreme fraction.
- Inspect cases alpha goes image-only on strong text edit.
- Reject collapsed gate even if one aggregate metric looks good unless justified.

### P4.4 Hard-negative list v1

- Mine with frozen Stage 2.
- Apply exclusions.
- Keep one-violation candidates.
- Balance attributes.
- Version and provenance each record.
- Human/sample audit before training.

### P4.5 Panel B

- B0 random/in-batch control.
- B1 hard-negative intervention with near-equal budget.
- B2 short joint consolidation challenger.
- Select/promote on validation only.
- Log GPU-hours and three B2 sub-changes.

### P4.6 Automatic full evaluation

Run TargetRecall@K on all 400. Report per primary attribute from 240 controlled queries, 40 each.

### P4.7 Judged pool

- Build multi-run pool for selected approximately 100 queries.
- Two assessors and adjudication per protocol.
- Product facet confirmation as byproduct.
- Compute nDCG/ConstraintSatisfied and strict/relaxed metrics.

### P4.8 Contamination audit

Intersect curated negatives with grade>=1 and facet-gold full-hard-match. If >5 percent, create negatives v2 and rerun affected arms. Report v1 issue and v2 change.

## Interpretation map

| Comparison | Trả lời |
|---|---|
| A4 minus A0 | Text modification thêm giá trị bao nhiêu |
| A4 minus A1 | Anchor đóng vai trò bao nhiêu, có lưu ý text dependency |
| A3 minus A2 | Tune một global weight có đủ không |
| A4 minus A3 | Input-dependent weighting có lợi không |
| B1 minus B0 | Curated hard negatives có lợi không |
| B2 minus B1 | Consolidation package có lợi không, không biết sub-component nào |

## Deliverables

- Panel A/B manifests and tables.
- 400-query TargetRecall report.
- 100-query qrels/facet-gold artifacts.
- Alpha plots and L1/L2 gate report.
- Hard-negative v1/v2 and contamination report.
- Promoted Stage 4 or Stage 5 checkpoint/index.
- RQ2 answer and failure examples.

## Gate 4 checklist

- [ ] Query budget correct.
- [ ] RQ2 uses Gold intent.
- [ ] Encoder frozen in Panel A.
- [ ] Fixed alpha fit on train.
- [ ] Adaptive output scalar only.
- [ ] B0/B1 budget comparable.
- [ ] Alternate positives excluded from negatives.
- [ ] Contamination <=5 percent for final curated list.
- [ ] B2 claim limited to package.
- [ ] Final test did not choose alpha/regime.
