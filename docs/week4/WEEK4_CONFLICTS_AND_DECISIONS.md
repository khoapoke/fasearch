# Week 4 conflicts and decisions

## C-W4-001 - Phase 1 scope versus current Week 4 gate

- Existing Master Blueprint/Phase 1: 100-200 products; text mandatory; image/composed may be sanity checks; two frozen candidates.
- Current Week 4 execution requirement: 300-1,000 products; all three modes mandatory; at least one frozen CLIP-compatible model, challenger optional.
- Resolution: use the current Week 4 gate for this vertical slice: 600 balanced products, all three modes and one pinned CLIP baseline. Keep the two-model multilingual requirement for later RQ1 rather than inventing a rushed challenger.
- Impact: Master Blueprint roadmap, Phase 1 playbook and Decision Register are updated together. No final-test policy changes.
- Follow-through on 10/09/2026: the summary Gate 1 in `docs/08_EXECUTION_ROADMAP.md` still contained the old 100–200/B0–B1 wording. It is now aligned with the already-approved D053; no new experiment or gate decision is introduced.

## C-W4-002 - Website/mobile wording

- Official lecturer brief: a website and backend/API are required; mobile is not explicitly required.
- Historical D005/Master Blueprint as of 08/09/2026: Flutter Web, Android and iOS were described as core clients.
- Instruction as of 08/09/2026: do not expand to mobile before website/search core; Week 5 asks what stack still needs lecturer confirmation.
- Safe action recorded on 08/09/2026: Week 4 contains no UI work. Website remains mandatory; mobile is deferred and must not delay rubric items.
- Question recorded on 08/09/2026: ask GVHD whether mobile is graded core or optional extension, and whether Flutter Web + FastAPI is acceptable versus the brief's Next.js/Spring Boot stack.
- Resolution on 10/09/2026: the team selected Next.js/TypeScript for the website and Java Spring Boot for the public business backend/API. Python/FastAPI remains an internal AI adapter reusing `ai/ml/`, PyTorch, FAISS and a Python worker. Spring Boot owns authentication, catalog, history, authorization and orchestration; Next.js and the AI service do not duplicate these responsibilities.
- Scope resolution: website is mandatory; mobile is optional after website/search core, testing, deployment and reporting are ready. The mobile framework is undecided. D054/D055 supersede D005 and resolve O007/O008 via `CP-20260910-STACK` in the [Decision Register](../10_DECISION_REGISTER.md).
- Approval record: the team authorized the change on 10/09/2026. It will present the architecture at the next GVHD meeting; this record does not assert lecturer approval.
- Trade-off and impact: fewer client platforms to deliver, with an added Java–Python contract and deployment boundary. Delivery speed depends on team experience. Markdown and diagrams are updated; Word/ZIP v1 remain historical snapshots. Week 4 artifacts, pilot metrics and the 13/14 Gate status are unchanged; no Week 5 package is opened by this documentation update.

## C-W4-003 - Metric schedule

- Official weekly plan places Precision@K, Recall@K and response-time evaluation in Week 11.
- Current Week 4 gate requires pilot metrics now.
- Resolution: Week 4 outputs are explicitly pilot-only harness validation. They neither replace nor consume the frozen final benchmark. Week 11 remains the formal evaluation period.

## C-W4-004 - Dataset numeric revision

- Requirement: pin the dataset version.
- Anonymous Kaggle download supplied the current public archive but authenticated numeric metadata was unavailable.
- Resolution: pin the snapshot using source slug, date, full raw file manifest SHA-256 and canonical raw content hash. This is sufficient to reproduce exact bytes. If a numeric Kaggle revision is later available, append it in manifest v2; never rewrite v1.
