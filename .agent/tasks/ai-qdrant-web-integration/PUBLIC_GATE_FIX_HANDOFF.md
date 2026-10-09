# PUBLIC GATE FIX HANDOFF — R4-S1/S2/T1 → READY_FOR_REVIEW (Implement, 09/10/2026)

Final SHA: `8f329f934c334fd81b36353f1d7bcda3e6e31ea6` (clean, branch
`codex/ai-qdrant-web-integration`, worktree `/tmp/fasearch-ai-qdrant-web`).
Base `1d0a2e6fc97c90a2a92fd05f3b7a7a602b2a6caf`; TASK blob unchanged.
Console checkout/services/DB/bucket observe-only throughout (FE `:3280`
and Boot `:18780` verified alive at close-out, never signalled).

## R4-S1 — public malformed IMAGE mapping: CLOSED

- RED first: 5 new `HttpAiImageSearchAdapterTests` failed with genuine
  `AI_UNAVAILABLE` where `INVALID_IMAGE`/`INVALID_REQUEST`/
  `IMAGE_TOO_LARGE` were required; live repro (old JAR) returned 503 on
  both Boot-direct and FE-proxy paths for a malformed JPEG.
- Minimal Java fix in `HttpAiImageSearchAdapter` mirroring the approved
  `HttpAiComposedSearchAdapter` pattern: upstream 400 inspected via
  `readAiCode` → `INVALID_IMAGE`/`INVALID_REQUEST`/`IMAGE_TOO_LARGE` to
  public 400s, unknown 400 → `AI_CONTRACT_MISMATCH` 503; 409 mismatch,
  413, 415 mapped; other errors/timeout/contract-parse behavior preserved
  (timeout → `AI_TIMEOUT` 503, Jackson → contract mismatch, else
  `AI_UNAVAILABLE`). No canonical/AI contract change.
- GREEN: adapter suite 8/8; full search BE package 71/71; module suites
  14/14. Exact-source JAR rebuilt (`40b37a853c4ffebe` prefix) and guarded
  candidate-only Boot restart (PID 97152 → 65070, same env/cwd/listener).
- Live proof on the new JAR: malformed JPEG → **400 INVALID_IMAGE** (Boot
  + FE proxy, trace echoed, no-store schema); empty → 400; valid JPEG →
  200; AI stopped → **503 AI_UNAVAILABLE** preserved; AI restarted →
  ready 600 frozen-exact, valid search 200 again.
- Raw: `EVIDENCE/public-gate-fix/be-adapter-tests.log`,
  `live-public-mapping.log` (+ AI-down/recovery transcript in this handoff:
  `r4s1-down-1` → 503, `r4s1-rec-1` → 200).

## R4-S2 — self-contained recipes + split tests + counts: CLOSED

- `encode_probes.py` now creates `--out` parents (`os.makedirs(...,
  exist_ok=True)`); proven by writing 29 probes into a brand-new nested
  disposable path (exit 0). RUNBOOK §5 starts with explicit
  `mkdir -p "$W/tools/ai-draft-hardening/.runtime"` so the written
  sequence works in a genuinely clean export.
- RUNBOOK §6 rewritten as 5 exact split processes (faiss/torch never
  share a process): P1 candidate selection (no faiss-boundary file),
  P2 `test_internal_api` alone, P3 `test_encoder_index_search` alone,
  P4 faiss-importing research together, P5 schemas/light/torch-HF.
- Executed exactly as written: **84 + 9 + 4 + 18 + 15 = 130, all green**
  (raw logs `ai-p*.log`). A combined P4+P5 attempt aborted (faiss in the
  fault dump) — recorded as boundary confirmation, not a pass.
- §5 full drill executed: mkdir → encode 29 probes → adopt → genuine
  restore (600 ID/payload/vector equality, 29-query parity, owned
  `restore_*` target deleted).
- Dated count correction (09/10/2026): the residual-era "81+9=90"
  selection is superseded — Round4 established 84 candidate tests (incl.
  3 decode regressions) + 9 API = 93, and 84+13+30+3 = 130 total, now
  re-executed green in the written split. No fixture counts asserted as
  final totals beyond these dated runs.

## R4-T1 — secret-file permissions: CLOSED

- Intake: `/tmp/dbpass.txt` 0644 + `/tmp/webcand-admin.pass` 0600, both
  current-user owned (metadata only, never read). Applied `chmod 600` to
  `/tmp/dbpass.txt`; verified `0600/0600` via `ls -l` + `ls -le`
  (`EVIDENCE/public-gate-fix/secret-file-metadata.log`).
- No password rotation, no value/hash recorded anywhere, RUNBOOK keeps
  key-names/paths only. Shared DB credential value unchanged.

## Close-out state

- Healthy loopback triple: FE `:3270` → Boot `:18680` (new JAR, PID 65070)
  → AI `:18042` (restarted, ready 600/DOT/frozen-exact). Protected
  previews + Console runtimes untouched (verified listening).
- Leases: source/runtime/STATUS returned to Control with this handoff at
  READY_FOR_REVIEW. No self-PASS, no review spawned, no push/PR/merge.
  Independent new-SHA assessment owns the verdict; manual/adoption/merge
  remain representative-owned.
