# Phase 5 RQ3 Taxonomy Explainability

## Outcome

Đo taxonomy-aware retrieval trong oracle và production conditions, bao gồm parser/tagger degradation, candidate ceiling, result lanes, evidence và latency.

## Inputs

- Promoted retrieval checkpoint/index.
- Frozen judged candidate pool và qrels.
- Gold intent cards/facets.
- Production parser/tagger versions.
- Taxonomy/relaxation/evidence schemas.

## Steps

### P5.1 Candidate baseline

Với N 50, 100, 200:

- Run dense D.
- Compute CandidateRecall@N.
- Compute Ideal@N using qrels ordering.
- Freeze candidate sets for matrix comparison.

### P5.2 Parser freeze

- Run parser on all queries.
- Validate JSON/schema/canonical values.
- Save raw response, parsed response, model/prompt/schema version, date/hash.
- Do not rerun selected failed queries selectively.

### P5.3 Product facet snapshot

- Gold facets from judged pool.
- Production facets from tagger/review version.
- Confidence threshold table.
- UNKNOWN source computation.

### P5.4 Run matrix

For every N and selected query set run:

- T_GG.
- T_PG.
- T_GP.
- T_PP.

Same reranker code/config/candidates. Store table provenance separately for each snapshot.

### P5.5 Interaction and degradation

Compute:

- taxonomy headroom;
- parser loss;
- facet loss;
- deployment gain;
- difference-in-differences interaction.

Do not call raw main effects causal without conditioning statement.

### P5.6 Lanes and relaxation

Unit/integration test:

- SATISFIED/VIOLATED/UNKNOWN mapping.
- must_not behavior.
- category/must_not never relax.
- priority order.
- inferred-before-explicit tie-break.
- one constraint per relaxation step.
- Exact/Substitute/Unverified labeling.
- answerable/unanswerable behavior.

Run metrics before fallback masks exact shortfall.

### P5.7 Evidence gate

1. Schema completeness over top-K.
2. Deterministic recomputation within epsilon.
3. If any inconsistency, invalidate run and fix code.
4. Regenerate evidence and rerun checks.

### P5.8 Faithfulness study

- Sample approximately 100 explanations stratified by constraint/lane/mode.
- Split into factual claims.
- Two blind assessors mark Entailed/Unsupported/Contradicted.
- Compute claim rates and explanation min-rule pass.
- Keep raw disagreement and pre-adjudication agreement.

### P5.9 Parser metrics

- Intent exact match.
- Constraint tuple micro/macro F1.
- Bucket/attribute/value/operator/reference.
- Negation detection/scope.
- Calibration/risk-coverage.
- Slice results.

### P5.10 Repair and corruption

Gold repair:

- Identify predicted error.
- Replace one field with Gold.
- Rerun with same facets/candidates.
- Measure downstream delta.

Gold corruption:

- Start Gold intent.
- Corrupt one field by predefined error type.
- Rerun.
- Measure sensitivity.

Do not use corruption examples to retrain final test parser.

### P5.11 Latency curve

- Fix hardware/catalog/concurrency/cache state.
- Warm-up then repeated requests.
- Component and wall-clock p50/p95.
- External parser calls uncached with retries logged.
- Plot quality/coverage versus p95 for N.
- Select N on validation, freeze, then one test run.

## Deliverables

- Dense and Ideal/CandidateRecall artifacts.
- Parser/tagger snapshots.
- Matrix 2x2 tables with interaction.
- Lane/relaxation test report.
- Coverage metrics by answerability.
- Evidence assertion report.
- Claim-level faithfulness judgments.
- Parser metrics and repair/corruption results.
- Latency Pareto figure and N decision.
- RQ3 answer and limitations.

## Gate 5 checklist

- [ ] T_GG called oracle-input, not global ceiling.
- [ ] Matrix cells share frozen candidates/reranker.
- [ ] Provenance complete and no overwritten table.
- [ ] UNKNOWN thresholds from validation.
- [ ] Exact zero/shortfall measured before fallback.
- [ ] Unanswerable slice retained.
- [ ] Consistency assertion 100 percent deterministic branch.
- [ ] Faithfulness claim-level protocol followed.
- [ ] Correlation not mislabeled causation.
- [ ] N selected without test peeking.
