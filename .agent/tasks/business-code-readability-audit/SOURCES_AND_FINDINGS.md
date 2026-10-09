# First-pass reconciliation — evidence and limits

09/10/2026 Control. Sources inspected read-only; no full source correctness review or production change. Teacher/teammate comments came via representative and remain reported concerns; inspected branch is not known. No inference that teammate is incapable, that lecturer approved existing layers, or that many folders automatically mean poor architecture.

## Primary business source

Original `references/CNTT_KLCN198_Tìm kiếm sản phẩm thời trang bằng hình ảnh và mô tả tự nhiên.pdf`, all7pages read directly:

- p1 goals explicitly include survey of website business process, functional/nonfunctional analysis, architecture, responsibility and team coordination.
- p2–4 rubric includes organization/process/forms survey, business/system use cases with specifications, analysis/design class+data models, user/admin interfaces, basic auth/permissions, product/category/image/description management, personal data/history/interested products/result interaction and three actual search modes.
- p4 evaluationPrecision@K/Recall@K/response time, actual testing/deployment; website/demo/test counts are not substitutes for these or business analysis.
- p7 explicitly requires integrating members' assigned contents into a shared document/software before each lecturer report. Multiple isolated feature branches do not automatically establish this integrated deliverable.
- The PDF does not prescribe hexagonal folders, exact five-role hierarchy, immutable Product Version/Catalog Publication naming, or a full asynchronous tag/review/index pipeline by those names. These are project design choices; each needs a comprehensible rationale/status, not citation as direct PDF wording.

## Observed findings

| ID | Observation / source | Impact / disposition |
| --- | --- | --- |
| B1 | `docs/week5/WEEK5_REQUIREMENTS_SPECIFICATION.md:3–11` explicitly0.1-draft/notApproved; `WEEK5_USE_CASE_INVENTORY_FOR_REVIEW.md` calls itself working proposal and preserves pending relations/IDs | Technical task completion must not imply shared group/GVHD agreement. Reconcile plain user goals first; don't retroactively stamp approval. |
| B2 | Inventory and requirements retain W5-O01 result selection meaning, seller_id meaning, ownership/publication/category/archive policy discussions | “Save product”, transient result selection and feedback cannot silently become one business flow. Distinguish confirmed source requirement from chosen implementation and open decision. |
| B3 | Code heads mainccdea2c9, Qdrant8f329f93 and Console868b752 differ. Root main dirty/untracked packet/evidence; Console derivesolderQdrant1d0a2e6, not latest8f329f93 | Teammates may inspect a different snapshot than Control's reports. Agree which source to read/demo and record branches; do not pretend a single integrated app or assume peer examined current candidate. |
| B4 | Week5/compliance/05Octroadmap still label some auth/search/publiccatalog work planned/unstarted; actual feature branches implement them | Old intended/current/status prose is mixed. A new reader cannot rely on the root roadmap to locate active code. Add a small truthful status/index, don't bulkedit historical evidence or generate another inconsistent fullbook. |
| B5 | AI contains `ml/retrieval` research, `fasearch_ai` oldercanonical/FAISS runtime and `src` teammate-derivedQdrant runtime; multiple requirement/config variants and `shadow`-named functions remain in active web serving | Legitimate retained baseline/provenance also produces navigation debt. Explain active imports/config vs research/compatibility explicitly; later consider name/config consolidation without deleting baseline or changing ranking/contract. Multiple folders are evidence of coexistence, not proof all are redundant. |
| B6 | Backend `identity/catalog/library` largely flat; `search` uses api/application/infrastructure, UseCase/Module/Port/Adapter/interface-heavy reading path | Different styles and several layers increase new-reader effort. Source behavior is traceable; whether every interface earns its complexity needs deeper caller/variation assessment. Don't remove security/version guards merely to reduce class count. |
| B7 | Current Console CRUD creates immutable DRAFTversions/audit/image objects; public reader serves frozen pilot catalog and no complete Draft→active publication path is implemented | Product-management→usersearch business story remains incomplete. “Admin adds product; when does user find it?” cannot be answered as automatic today. Pilot600lookup works independently of Draft creation. This gap matters more than another polished admin panel. |
| B8 | Root `.agent/`, `.agents/`, `.pi/`, `.playwright-mcp/` and many `tools/<old-task>` coexist with productsource/docs/artifacts | Team can mistake workflow/test/demo history for application architecture. Codeguide must mark these as support artifacts, not force peers to read them before understanding a feature. Preserve untracked work; no cleanup/delete as diagnosis. |
| B9 | Recent reviews provided real contract/privacy/parity/race/failure proof, but those verdicts did not establish group members can explain business goals/source ownership | Tests are valuable engineering evidence. Add group walkthrough/ownership/teacher-feedback trace, not more passes as response to readability concerns. No claim fewer tests or less AI alone fixes business analysis. |

## What is not established yet

No complete line-by-line review of all modules, no conclusion all code is overengineered, no verified direct teacherfeedback artifact/inspectedSHA, no approved new domain simplification. The current current-source guide and three traces are an initial diagnosis. A chosen final refactor must be based on actual caller/invariant/test evidence and accepted group business scope; separate Implement changes source.

## Proposed next decisions, not imposed restrictions

1. Group agrees plain actor goals/core scenario definitions and discusses actual lecturerfeedback against originalPDF. Keep confirmed search/auth/product/user goals visible.
2. Identify who inspected whichSHA/branch; select one readable walkthrough source and distinguish currently running candidates. No destructive merge/cleanup required to agree a map.
3. Classify each extra flow/module: required business; necessary technical support; research/compatibility; optional design. Have team members demonstrate their owned goal from screen→controller→behavior→data/AI.
4. Propose precise simplifications (naming/onboarding/DTO/config/unusedpass-throughs) with keptinvariants and behavior checks. A whole-repo rewrite or deletion is not approved merely because teacher asked for clearer code.
5. Update business/system flows and minimal current architecture together; then assign approved code cleanup to separateImplement. Original proposal/decisions/history preserved, no false teacherapproval.
