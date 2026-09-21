# Week 4 independent rerun sign-off

Purpose: close the only human-dependent Week 4 Gate item. The reviewer must be a team member other than the author of the current run. Do not edit the query set or use any final-test data during this check.

## Reviewer procedure

From a fresh local checkout or Colab T4 workspace, follow `WEEK4_BASELINE_RUNBOOK.md`, then run:

```bash
./scripts/run_cpu_smoke.sh
./scripts/run_week4_baseline.sh
```

Confirm all of the following:

- 14 tests pass and offline smoke status is `PASS`;
- the real catalog contains 600 rows with 200 TOP, 200 BOTTOM and 200 ONE_PIECE;
- model revision is `092a3b7e31726acc3a0207eea00f6040ac8b03a7`;
- index is `IndexFlatIP`, has 600 rows and row-to-product verification passes;
- text, image and composed pilot modes all return Top-K;
- every real evaluation query has `pilot_only: true`;
- no raw data, model weight, embedding or index file is staged for Git.

If the raw Dataset A snapshot differs, do not overwrite the current manifest. Record the new Kaggle revision/content hash and create a new bundle version before comparing results.

## Sign-off record

Leave this section unchanged until a real independent rerun has completed.

- Reviewer: `PENDING`
- Date/timezone: `PENDING`
- Environment: `PENDING`
- Git revision or shared snapshot: `PENDING`
- Bundle ID: `week4-baseline-20260908-v1`
- Catalog SHA-256: `PENDING`
- Model config hash: `PENDING`
- Index SHA-256: `PENDING`
- Test/smoke result: `PENDING`
- Differences or blockers: `PENDING`
- Decision: `PENDING`

After a successful sign-off, update `WEEK4_GATE_STATUS.md` from 13/14 to 14/14 before opening Track B Week 5.
