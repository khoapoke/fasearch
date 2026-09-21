# Phase 3 RQ1 Vietnamese Adaptation

## Outcome

Trả lời RQ1 bằng frozen baselines, adaptation variants, graded metrics, paired confidence intervals và language slice analysis.

## Inputs

- Frozen RQ1 query/qrels version.
- Catalog test snapshot.
- B0/B1 checkpoint manifests.
- Stage 1/2 training data.
- Research Protocol version.

## Steps

### P3.1 Lock comparison design

- Decide 2-way or 3-way from Stage 1 data audit.
- Pin exact B0/B1 checkpoints.
- If claiming language-specific effect, decide English-continuation control.
- Pre-register primary comparison/metric and bootstrap method.

### P3.2 Frozen baselines

- Encode catalog independently per model.
- Run query set.
- Store per-query ranked output.
- Validate product/index mapping.

### P3.3 Stage 1 training if applicable

- Run fashion-domain configs.
- Select best on validation.
- Record retention guardrails.
- Rebuild index.

### P3.4 Stage 2 Vietnamese training

- Run data-mixture/config candidates on validation.
- Inspect overall and slice validation.
- Select one final checkpoint without test access.
- Freeze checkpoint and miner copy.

### P3.5 Final test

- One approved run per locked arm.
- Compute nDCG@10, MRR strict/relaxed, Recall@10/50.
- Paired bootstrap deltas.
- No retuning after result.

### P3.6 Slice analysis

Report support and CI for:

- standard/colloquial;
- clean/no-diacritic/abbreviation/teencode/typo;
- no mix/loanword/true code-switch;
- no negation/lexicalized/compositional;
- simple/multi-constraint if available.

Do not imply independent causal effect when slices overlap.

### P3.7 Error analysis

- Sample wins/losses paired by query.
- Assign reason codes.
- Identify vocabulary, attribute, negation, candidate or annotation issues.
- Feed only post-test limitations/future work, not model tuning.

## Deliverables

- RQ1 run manifests and per-query outputs.
- Overall table with CI.
- Slice support/metric table.
- Error matrix/examples.
- Chosen Stage 2 checkpoint and FAISS index.
- Written RQ1 answer and limitations.

## Gate 3 checklist

- [ ] 2-way/3-way claim matches actual data.
- [ ] No parser/reranker in pipeline.
- [ ] Exact checkpoints and preprocessing recorded.
- [ ] Separate indexes built.
- [ ] Primary/secondary metrics correct.
- [ ] Paired CI and support N shown.
- [ ] Test not used for retraining.
- [ ] Stage 2 hard-negative miner frozen.

## RQ answer template

```text
Compared with [baselines], [model] changed nDCG@10 by [delta, CI].
The clearest improvement occurred in [slice, N], while [slice, N] remained weak.
The result supports/does not support H1 under [catalog/query scope].
```

Không viết `model hiểu hoàn hảo tiếng Việt`.
