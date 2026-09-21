# Week 4 Gate status - 08/09/2026

Gate result: **13/14 verified; Week 4 remains open pending independent rerun by another team member.** Track B Week 5 was therefore not started.

| Gate item | Status | Evidence |
|---|---|---|
| Dataset manifest and cleaning report | PASS | Local versioned artifacts; stable hashes in `ai/data/manifests/week4-baseline-20260908-v1.json` |
| 300-1,000 pilot products | PASS | 600 products, 200 per root category |
| Frozen encoder runs | PASS | Pinned CLIP revision; 600x512 embeddings; finite/norm/stability checks pass |
| FAISS index and mapping valid | PASS | `IndexFlatIP`, 600 rows, checksum/model/catalog cross-check pass |
| Image-only | PASS | Six real image pilot queries; query product excluded |
| Vietnamese text-only | PASS | Twelve Unicode/no-diacritic/colloquial pilot queries execute |
| Equal-weight image-text fusion | PASS | Six composed queries; exact 0.5/0.5 formula recorded |
| 20-30 pilot queries | PASS | 24, all `pilot_only: true` |
| Precision/Recall/TargetRecall/latency exported | PASS | Overall, by-mode and per-query JSON/Markdown |
| Failure analysis | PASS | Five cases plus methodological limitations |
| CPU smoke test | PASS | 14 tests plus 30-product offline vertical slice |
| Colab T4 instructions | PASS | `docs/week4/WEEK4_BASELINE_RUNBOOK.md` |
| Another member can rerun from README | PENDING HUMAN | Commands and sign-off fields are in `docs/week4/WEEK4_INDEPENDENT_RERUN.md`; no independent signature exists yet |
| No final-test claim/title leakage hidden | PASS | Query/artifact flags and report limitations are explicit |

No scientific quality claim is made from the weak pilot metrics.
