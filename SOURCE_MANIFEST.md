# SOURCE MANIFEST — codex/team-integration (Implement, 09/10/2026)

Base: `8f329f934c334fd81b36353f1d7bcda3e6e31ea6`
(`codex/ai-qdrant-web-integration`, includes R4 public-gate fix).

## Merges (ordinary merge commits, preserved ancestry)

- `868b752bd63dcf3c0e7dcd415624ca69a5d00e38`
  (`codex/catalog-operations-console`): 32 files — operations shell/
  dashboard, filtered drafts, conflict-safe editor, version timeline/
  compare, audit trail, additive OpenAPI. Merge base `1d0a2e6fc`;
  **zero overlapping files** with the 8f fix delta, merged clean with no
  conflict and no ours/theirs. Qdrant IMAGE-mapping fix verified intact
  after merge (`mapBadRequest` present in adapter).

## Cherry-picked paths (source: `ccdea2c9b`, `codex/vertical-slice`)

- `be/compose.yaml`, `be/compose.storage.yaml`: forwarding stubs to the
  shared `fasearch` Compose project (replaces 8f standalone stacks).
- `infra/fasearch/compose.yaml`, `manage.sh`, `README.md`, `.env.example`,
  `.gitignore`: shared PG/storage/Qdrant runtime (new to this tree).
- `be/README.md`: manual merge — kept 8f behavior docs (incl. composed
  endpoint), added the shared-runtime note block only.

## Root context snapshot (copied 09/10/2026, read-only copies)

From `/Users/khoado/Documents/ChatGPT/Graduate Bachelor` working tree
(root checkout untouched, no add-A/clean): current `AGENTS.md`,
`README.md`, `.gitignore` (adds proposal-PDF ignore only);
`.agent/PROJECT.md`, `oxk.json`, `workflow/`; consolidation packet
(TASK/BRANCH_INVENTORY/ARCHITECTURE_NOTE/STATUS, no REVIEW);
console delivery docs (TASK/API_DESIGN/DESIGN/STATUS/HANDOFF/RUNBOOK/
EVIDENCE/AC_COVERAGE, no REVIEW, no PNG binaries — see canonical packet
`evidence/`); Qdrant `RUNBOOK.md` + `PUBLIC_GATE_FIX_HANDOFF.md`;
`business-code-readability-audit/` packet; roadmaps + agent guides;
`tools/oxk/` adapter source.

Excluded everywhere: `cj.txt`, `.env`/secret files, cookies, venvs,
`node_modules`, model/index/vector/snapshot data, raw datasets, uploads,
private process logs, `.codex/`, `.pi/`, `.playwright-mcp/`, REVIEW.md
verdicts (live in canonical packets), evidence PNGs (referenced by path).

## Branch inventory disposition (all 22 refs, originals preserved)

- Already ancestor of 8f (in tree, nothing to do): account-completion,
  catalog-discovery, catalog-lifecycle-prototype, catalog-processing-spec,
  core-search-integration-2h, personal-library, real-pilot-integrated-demo,
  search-input-ui, swagger-api-groups, ui-stitch-alignment, ui-stitch-phase-b.
- Integrated above: catalog-operations-console, vertical-slice (compose).
- Provenance/reference only, never merged: ai-draft-hardening (generated
  vectors in ancestry), master (unrelated history, no merge-base).
- Superseded/transferred (equivalents verified in tree, excluded):
  api-prototype-swagger-3h (ApiDocsController present),
  catalog-draft-list (evolved list in console + base APIs),
  composed-search-contract (`parse_composed_form`/token-budget present),
  landing-composed-demo, landing-hero-prototype, stitch-search-ui
  (Stitch A+B already aligned; old prototype globals/pages not restored).
- Unknown/pending: teammate future backend push (not fetched, not merged).

## Conflict log

- Console merge: no conflicts (disjoint file sets, verified).
- be/README: content merge as described, no conflict markers.
- No blanket ours/theirs used anywhere.
