# FaSearch — roadmap hoàn thiện đồ án tốt nghiệp

Revision1 · 05/10/2026 · Control. Đại diện yêu cầu roadmap đầy đủ và Implement tiếp tục khi vắng mặt; con người tập trung manual review/feedback. Mốc kế hoạch31/10, deadline thực tế “cuối tháng10”; PDF ghi08/11, không dùng mốc muộn hơn để trì hoãn. Đây là lịch mục tiêu, capacity/khả năng GPU chưa đo; không hứa hoàn tất bằng số giờ agent.

## 1. Đích nghiệm thu

Một đồ án hoàn chỉnh phải đồng thời có: (A) website/API chạy thật đủ chức năng đề cương; (B) thực nghiệm embedding/fusion và đánh giá có thể tái lập; (C) khảo sát, phân tích, thiết kế, báo cáo/slides/source; (D) triển khai, kiểm thử, bảo mật/quyền riêng tư, demo và phương án dự phòng. Demo600 hoặc nhiều tests không đồng nghĩa đạt cả bốn.

Authority: PDF7 trang `references/CNTT_KLCN198_Tìm kiếm sản phẩm thời trang bằng hình ảnh và mô tả tự nhiên.pdf` > Decision Register/contracts/schemas > Research Protocol > blueprint > packet. Đề cương pp.2–4 yêu cầu embedding/fusion/metrics, không trực tiếp bắt fine-tuning hoặc fullRQ1–RQ3. Repo research mở rộng vẫn Locked; không giảm/đổi ngầm, phải ghi quyết định của đại diện/GVHD. Ngoài core: mobile/outfit/VTON/commerce không làm chậm mandatory.

## 2. Hiện trạng đầu vào

- Integrated local preview có IMAGE/TEXT/COMPOSED, catalog list/detail, Draftcreate/revise/upload/list, login/logout/session/CSRF. Search UI mới clean `codex/search-input-ui`01104318; packet có reviewPASS, chưa shipping/manual toàn bộ.
- Frozen pretrainedCLIP+FAISS, pilot600 cân bằng3category,24pilotqueries. Chưa fine-tune appmodel. Week4 humanindependent sign-off vẫnPENDING; taskreviews không tự thay chữ ký này.
- Qdrant teammate-derived hardening đã localreview, shadowcandidate; không phục vụ app, lịch sử ancestorartifact không được push nguyên trạng.
- Accountfull, admin/productprocessing/publication, history/saved, release deployment, finalresearch/report chưa có đủ evidence để coi xong. Inventory phải rà branches/PRs trước khi giao, không code lại đồ đã có.
- Native clipboard manualpending; Catalog có acceptance evidence gaps lịch sử cần khép; mỗi gói ghi riêng code/review/manual/shipping.

## 3. Phase và step

### P0 — Kiểm kê, đóng scope và dựng đường chạy ·05–06/10

1. Map mọi bullet/rubric PDF vào feature, tài liệu, thí nghiệm và evidence; rà source nhiềubranch/PR thay vì dựa STATUS cũ.
2. Pin integrationbase, liệt kê reusablecommits, openfindings, owner/writer/dirtyfiles; chọn consolidationplan local không rewrite history.
3. Liệt kê quyết định đang mở: auth concern, publication protocol, saved vs selection/W5-O01, category/archive semantics, researchdepth, deploytarget. Tận dụng Lockeddecisions; chỉ hỏi phần consequential chưa chốt.
4. Chia hàng đợi tickets có scope/AC/design/commands/evidence; READY chỉ khi hợp đồng đủ. Chuẩn bị reportskeleton và requirementcoverage ngay.

GateG0: coverageledger không bỏ bullet, integrationpin và owner rõ, ít nhất một READYticket có writer/reviewer thật. Decisionsblocked không chặn lanes độc lập.

### P1 — Nền tích hợp và search ổn định ·05–08/10

1. Consolidate local reviewed app/tree, bảo toàn sourcebranch; sửa required Catalog/UI gaps theo evidence.
2. Verify3modes, productdetail/catalogcontext, CSRF/session, timeout/error/empty/loading, paste/manual checklist, responsive/keyboard/reducedmotion.
3. Fresh integratedchecks trên exactHEAD; runbook start/stop/restart với guardedPID, sharedDockerfasearch; create demo account/data qua approved setup.

GateG1: một appURL chung, navigation và3modes chạy với dữ liệu thật; standalone nativeclipboard manualpending ghi riêng. Không coi ranking chất lượng chỉ vìHTTP200.

### P2 — Tài khoản và quyền ·06–11/10

1. Register/login/logout/profile/change-password: own-data allowlist, duplicate/validation, sessionexpire/error states.
2. Reuse approved display-name migration, username/email read-only, newpassword≥15chars/currentpasswordcheck/logoutallsessions; session/JDBC/CSRF theoD056, khôngJWTmigration.
3. Admin user/role/status và immediate session revocation theo allowedpermissions; lastactiveSuperAdminprotection, auditevents, IDOR/403negatives.
4. FE Stitch account/admin direction, không fakeMFA/emailverification/resetpassword. Mỗi feature chưa chốt contract được scout trước.

GateG2: real browseraccountlifecycle, rolematrix server-side, sessions revoked đúng, contracts/migrations/tests/review. AccountSPEC cũ cònDRAFT và authconcern mở; không nângREADY chỉ do roadmap.

### P3 — Quản trị sản phẩm và sản phẩm tìm được ·07–15/10

1. Reuse Draft; complete create/read/update/archive và category/image/description management trong TOP/BOTTOM/ONE_PIECE.
2. Pin semantics/version/ownership/archivevisibility; multiimage/primary/bounds/storagecleanup phù hợp sources.
3. Background processingquality/dedupe/tagging/embedding, retries/idempotency/failurestates; humanreview khi uncertain, lưu raw/reviewed riêng.
4. Atomicpublication product/model/index/catalog đồngversion, chỉActive searchable; re-embed changes, rollback và crash/restart drills; không tự chọn newarchitecture/Qdrant.
5. Admin/operations real screens, permissiondeny flows và audit. Không dựngCRUD giả chỉ để đủscreen.

GateG3: create→upload→process/review→Active→search/detail, update→newversion→searchconsistent, archive không lộ public; staleversion/retry/failure/recovery có evidence. Packet processingSCOUT_READY cần quyết định trước code.

### P4 — Trải nghiệm người dùng hoàn chỉnh ·09–16/10

1. Own searchhistory view/delete, authenticated retention rõ; Guest không persist history.
2. Interested/savedproducts add/remove/list; resultselect/deselect semantics theoW5-O01 đã chốt trước ticket.
3. Catalogfilter/pagination/detail→composedanchor→results; backcontext, expired/missingpublication, loading/empty/failure; ownership và unauthorizedtests.
4. Sharednavigation responsive/accessibility, khôngdeadlinks; consistentVietnamese labels. Polish phục vụ usability, không redesignStitch.

GateG4: account→search→interact→history/saved→detail journey; crossuserdenied; no fakecommerce; manualpack8–12steps.

### P5 — Data và evaluation nền ·05–11/10, chạy song song product

1. Audit rawsmall/full manifests, imagequality/metadata/missing/duplicates; catalogexpansion trong approved3category. Không tự thêmSocks/accessories từ44k.
2. Productgroup/near-duplicatesplit trước trainingpairs; separate train/validation/test, leakageaudit và data/licensingcard.
3. Authoredqueries/intent/qrels có judgingrules và owner; metadata/automaticlabels không giả làm humanGold. Independenthumanlabeling là dependency thật cần nhóm thực hiện.
4. Frozenbaseline notebook dùng lạicore,3modes/perqueryoutputs/metrics/slices; environment/data/model/index/confighashes và independentrerun.

GateG5: reusablebenchmarkinput và runnablebaseline, labeling/splitsaccepted; chưa đủ thì không train để lấp chỗtrống. Pilotmetrics khôngfinalbenchmark.

### P6 — Model, fusion và thực nghiệm ·10–18/10

1. Frozenencodercomparison theoRQ1sources, ưu tiênTiếngViệt/fashion; officialpreprocessing, samecandidatepool/qrels và pinnedcheckpoint.
2. FusionablationIMAGE/TEXT/equalweight và approvedweighted/adaptivearms; alpha/trainingchoices dùngtrain/validation, khôngfitfinaltest.
3. Fine-tuning chỉ khi dữ liệu/loss/negatives/splits/compute budget và experimentplan đủ; báo đại diện trước, giaoKaggle/Colabnotebook; userrun, no autonomouscompute spend.
4. PreserveRQ1→RQ2→RQ3dependency; fullpanels/miner/400query/100judged/matrix/evidence theoprotocol là internalextensioncommitments, feasibilityreview sớm vớiGVHD; không tựwaive.
5. ReportPrecision@K/Recall@K và composedtargetmetrics thích hợp, pairedcomparison/CI khi áp dụng, slices/failures/negative/nullresults. No improvementclaim from parity.
6. Promote model chỉ sau evidence/decision; regenerateembeddings/indexpublication nhấtquán, oldbaselinefallback có version; khônghot-swap unreviewedcheckpoint.

GateG6: requirementembedding/fusioncomparison và metrics táilập; exactresearchscopeverified riêng; modeltrain khôngphải mandatory riêng trongPDF. Reportfullydiscloses partialarms nếu chưa được chấp nhận điều chỉnh.

### P7 — Kiểm thử và triển khai ·16–23/10

1. Functional/ownership/security/contract/migration/E2Etests; actualend-to-endp50/p95 vớihardware/concurrency/cold/warm và measuredfailures.
2. Approveddeploytarget, HTTPS/cookie/CSRF/proxy boundaries, uploadprivacy/retention/deletion/no-trainingdefault; secrets outsideGit.
3. DB/storage/indexbackup+actualrestore, readiness/publicationcoverage, boundedrequests/workerlifetime, observability khônglộ sensitivepayload.
4. Deploymentrunbook/rollback, realdeployedbrowserchecks, no hardcodedlocalhostdependencies; representativeauthorizesexternaldeploy/cost.

GateG7: deployedreleasecandidate kiểm thực tế, reproducibleinstallation, measuredlatency+securitynegative+restoreevidence. LocalURL khôngthay deployrequirement.

### P8 — Báo cáo, source và bảo vệ ·bắt đầu05/10, hoàn tất24–28/10

1. Khảo sátbusiness, mục tiêu/phạm vi, phâncông/kếhoạch; business/systemusecases+specs; analysis/designclasses; datamodel và architecture trace tớiimplementation.
2. Backgroundembedding/fusion, dataset/preprocess/splits, experimentalsetup/results/comparison/erroranalysis/limitations; sourcefigures/tables generated từartifacts.
3. Systemfeatures/screens/testing/deployment/security; requirementcoverage và remaininglimits; citations đúngnguồn, no fabricatednumbers/claims.
4. Reportformat/numbering/references/figures, sourcepack cleanclone/prereqs/runcommand/dataaccess/manifests; no secrets/rawdatasets/generatedweightsinGit.
5. Slidesdemo và Q&A, cả3thành viên giải thích phầnmình/sharedcore; live/offlinevideo/backup, rehearse internetfailure.

GateG8: report/slides/source/demo matchonepinnedrelease; installationrerun và reviewerclaimcheck; rubriccoverage khôngchỉcode.

### P9 — Freeze và nộp ·29–31/10

Featurefreeze dựkiến19/10;29–31 chỉboundedblockingfixes córegression, no newmodel/architecture. Finalbackup/rehearsal, manualsignoff, nộp theo lịchthật. Scopeoverflow escalation trước11/10(data) và18/10(core/results), khôngđợi29/10.

## 4. Lanes và phụ thuộc

- LaneA AI/data/eval: P5→P6→researchtables; cloud/humanjudging dependencies bật cờ cầnuser, vẫnlàm notebook/tests/docsđộc lập.
- LaneB BE/dataoperations: P2/P3/P7; ownershipcontracts, migrations/publicOpenAPI/sharedsecurity cóoneintegrationowner.
- LaneC FE/product: P1/P2/P4/adminUI; sharedlayout/header/globals chỉonewriter.
- LaneD report/integration/review: P0/P8 và review perpackage, viếtđồngthời vớiartifact. Lane là trách nhiệm, không khẳngđịnh4người/harness đãchạy.

Một productionwriter mỗi ticket/worktree; parallel leafwork chỉdisjointfiles+integrationowner, tránhmultiplecontainers/fullmodelprocesses. Independentreview ởfixedSHA, reviewer khôngmerge/self-review.

## 5. Hàng đợi điều hành ban đầu

| Ưu tiên | Gói | State của kế hoạch | Vì sao |
| --- | --- | --- | --- |
|0|Proposalcoverage/releaseinventory/decisionledger|READY: read-only scout +docs|Biết đúng gaps và tránhduplicatework|
|1|Integratedsearch/UIclosure +manualhandoff|Inspect currentpackets first|Reuse01104318, khôngrepeatdonework|
|2|Accountbundle contract +implementation|NEEDS_DECISION/contractfreeze|Approvedfields có, nhưng oldpacketDRAFT/authconcern cầnreconcile|
|2|Data/evalbaseline readiness|SCOUT_READY|Đườnggăng research; khôngđợiUI|
|3|Productoperations/publication|SCOUT_READY|Nghiệpvụchưa đủcontract; cầnprepareconcreteplan|
|3|History/saved/resultinteraction|NEEDS_DECISION forW5-O01|Đềcươngmandatory, semanticschưachốt|
|4|Cloudexperiments/research|DependsG5 +approvedscope; userlaunch|TránhGPUrun vôích/leakage|
|5|Deploy/security/restore|Plan/testsready; externaldeploypending|Đềcươngkiểmthựctế|
|Continuous|Report/modeling/evidenceintegration|READY forsource-backed drafts|Khôngdồncuốitháng|

Đây khôngphải blanketREADY tấtcảtickets. Dispatcher tạo packetsđúngscope và promote dựatrên nguồn/decision, khôngapproval bằngtemplate.

## 6. Autonomous loop và human-in-loop

Loop: pickunblockedapprovedticket → reproduce/scout → implement → relevantchecks → localcommit → independentSpec+Standardsreview → boundedfix→rereview → handoff/manualqueue → picknextticket. Completedmilestone khôngchờuser cho mọicomponent; tiếp tục localworkđãapproved, nhưng manualpending khôngđổiMANUAL_PASS và khôngshipping.

Control vẫn chỉpacket/design/review; productionwriter là separateImplementsession. Human cần: manualreview/feedback, newmaterialdecision chưasettled, genuineaccess/cost/deploy/cloudtraining, representative merge và humanannotation nếurequired. Goal giảm interruption thườngxuyên, khônggiả humanGold hay bỏ security/sourceauthority.

Routineimplementationchoices đượctựchọn vàrecord; permission đãcấp khônghỏilại. Ifblockedticket, recordrepro/evidence/precisequestion rồichuyểnunblockedlane. Khônggiả approval bằngtimeout. Transientcheckrerun tốiđa1; materialfix/review2rounds mỗislice, sauđórecordblocker+continueindependentscope, khôngwaive requiredchecks.

24/24 nghĩa session cóthểtiếptục lúcuservắngmặt nếuharness/app/host/quota cònhoạtđộng. Prompt khôngscheduler; khôngclaimbackgroundruntime đãbật. Khôngtạomonitor (userkhôngmuốn), khôngbypassquota/Warden, duplicatePisession hoặcgoalJSONedit. Finishedapprovedqueue thìdừng, khôngfiller; savecheckpoint khihostlimit.

Deliverylocalreviewed bydefault; no push/PR/merge/deploy/messages/cost until explicitshippinggrant. Manualmilestone feedback trởthànhversionedfixqueue, onewriter, retainhistory. Nếufeaturedependentmanual cònpending thìlocalnextwork chỉđượcproceed khi khôngdựa trên quyếtđịnh cònmở.

## 7. Bảng điều khiển tối thiểu

Mỗiitem: requirement/PDFpage,phase,priority,owner,ticketrevision,branch/base/HEAD,dependences,decisionstate,codegate,reviewgate,manualgate,shippinggate,evidence,blocker,nextaction. No global% nếukhôngcórequirementweighting/completeinventory.

Gom manualpacks sauverticalmilestone10–20phút: account; admincatalog; shopperhistory/saved; searchquality; deploy/demo. Tronglúcchờmanual tiếp tụcunblockedlocaltasks. Sáng/trưa/tối usermởhandoff đểthấy done/next/blocker, khôngrequiremonitor.

## 8. Definition of Done cuối

Mọibulletđềcương cóevidence/tracetoartifact; no requiredunresolvedblocker; codeindependentlyreviewed ởpinnedrelease; actualmanualaccepted; realdeploymentcheck; embedding/fusion/metricsreproduce; privacy/auth/backuprestore cóevidence; report/source/slides/demo nhấtquán; cleanhandoff. Researchextensions ghi rõapprovedscope/status, khôngtựđổi lời hứa. Khôngcamkết “productionready” từscreenshots/testcounts.


## 9. Goal phải khép vòng TDD / E2E / diagnose / review

Đại diện yêu cầu ngày05/10: mỗi approved production goal phải khép toàn bộ chu trình trước manual handoff. Hợp đồng chi tiết: [AUTONOMOUS_GOAL_CONTRACT](../.agent/tasks/graduation-delivery/AUTONOMOUS_GOAL_CONTRACT.md). TDD và diagnosing-bugs được dùng đúng public seams/feedback loop, independent Spec+Standards + runtime review ở exact commit, fix làm review cũ hết hiệu lực và cần re-review. Quy trình không tự bật harness hoặc biến DRAFT roadmap phases thành READY tickets.
