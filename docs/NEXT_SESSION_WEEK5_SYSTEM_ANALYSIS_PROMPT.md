# Prompt bàn giao session kế tiếp — Week 5 phân tích nghiệp vụ và hệ thống

> Dùng bằng cách copy toàn bộ phần **PROMPT COPY-PASTE** vào một session Codex mới.
> Ngày soạn: 20/09/2026.
> Mục tiêu: chuyển trọng tâm từ baseline AI Week 4 sang đúng phân công Week 5 trong đề cương chính thức.

## PROMPT COPY-PASTE

```text
Làm việc trực tiếp trong project:

/Users/khoado/Documents/ChatGPT/Graduate Bachelor

## 1. Bối cảnh và chỉ đạo mới từ GVHD

Đây là đồ án CNTT-KLCN198: “Tìm kiếm sản phẩm thời trang bằng hình ảnh và mô tả tự nhiên”.

Week 4 baseline đã hoàn thành về mặt kỹ thuật và được đóng băng để chuyển trọng tâm sang Week 5. Baseline hiện có catalog pilot 600 sản phẩm, frozen CLIP, FAISS IndexFlatIP, ba search mode, 24 pilot queries, metric, tests và artifact versioned.

Trạng thái kiểm chứng cần ghi trung thực:

- Week 4 đã xong phần triển khai của người thực hiện.
- Gate tài liệu hiện vẫn ghi 13/14 vì independent rerun cần một teammate khác chạy và ký.
- Independent rerun là việc xác nhận song song, không được âm thầm sửa thành 14/14 khi chưa có chữ ký.
- Không tiếp tục mở rộng AI, multilingual/Vietnamese model hoặc fine-tuning trong session này.

GVHD hiện không ưu tiên hoàn thành AI trước. Phải bám đúng phân công Week 5 trong đề cương chính thức:

1. Phân tích yêu cầu hệ thống.
2. Lập sơ đồ use-case nghiệp vụ và đặc tả.
3. Lập sơ đồ use-case hệ thống và đặc tả.
4. Xây dựng sơ đồ lớp phân tích.
5. Thiết kế mô hình dữ liệu.

Việt hóa/model multilingual vẫn có thể là hướng nghiên cứu sau này, nhưng không phải ưu tiên Week 5. Không xóa mục tiêu này khỏi toàn bộ đồ án; chỉ điều chỉnh thứ tự thực hiện theo GVHD và đề cương.

## 2. Nguồn sự thật và thứ tự thẩm quyền

Trước khi sửa tài liệu, phải đọc đầy đủ các nguồn sau:

1. PDF đề cương chính thức:
   CNTT_KLCN198_Tìm kiếm sản phẩm thời trang bằng hình ảnh và mô tả tự nhiên.pdf
2. docs/README.md
3. docs/10_DECISION_REGISTER.md
4. docs/01_PROJECT_SCOPE_AND_REQUIREMENTS.md
5. docs/06_SYSTEM_ARCHITECTURE_AND_DEPLOYMENT.md
6. docs/00_MASTER_BLUEPRINT.md
7. docs/08_EXECUTION_ROADMAP.md
8. docs/PROJECT_BRIEFING.md
9. docs/TEAM_HANDOFF_CURRENT_STATUS_AND_NOTEBOOK_PLAN.md
10. docs/week4/WEEK4_GATE_STATUS.md
11. docs/week4/WEEK4_PILOT_REPORT.v1.md
12. docs/phases/PHASE_6_PRODUCT_WEB_MOBILE.md
13. schemas/product.schema.json
14. schemas/experiment-manifest.schema.json
15. configs/baseline.v1.yaml

Thứ tự thẩm quyền:

1. Đề cương chính thức và chỉ đạo mới của GVHD.
2. Decision Register và schema đã khóa.
3. Research Protocol nếu nội dung liên quan nghiên cứu.
4. Master Blueprint, roadmap và phase playbook.
5. Tài liệu briefing/handoff dẫn xuất.

Nếu phát hiện mâu thuẫn, không âm thầm chọn một bên. Phải:

- ghi conflict cụ thể;
- chỉ rõ nguồn nào có thẩm quyền cao hơn;
- đề xuất cách giải quyết;
- ghi tác động đến use case, class model, ERD, API và roadmap;
- cập nhật Decision Register/change record nếu quyết định đã đủ rõ;
- nếu cần GVHD xác nhận thì đưa vào open-question list, không tự bịa kết luận.

## 3. Kết luận bắt buộc rút ra từ đề cương

Đề cương chính thức yêu cầu website, Backend API và các chức năng chính sau:

- đăng ký;
- đăng nhập, đăng xuất;
- đổi mật khẩu;
- phân quyền người dùng;
- quản trị sản phẩm: thêm, xem, sửa, xóa/quản lý;
- quản lý danh mục, ảnh và mô tả sản phẩm;
- cập nhật thông tin cá nhân;
- xem danh sách và chi tiết sản phẩm;
- xem lịch sử tìm kiếm;
- xem/lưu sản phẩm quan tâm;
- tương tác chọn/hủy chọn với kết quả;
- tìm kiếm bằng ảnh;
- tìm kiếm bằng mô tả tự nhiên;
- tìm kiếm đa phương thức ảnh + văn bản;
- xếp hạng và hiển thị Top-K.

Đề cương xếp lịch:

- Week 5: phân tích yêu cầu, business use case, system use case, analysis class diagram, data model.
- Week 6: quản trị sản phẩm, chức năng người dùng, tìm kiếm bằng ảnh.
- Week 7: tìm kiếm bằng mô tả tự nhiên, tìm kiếm đa phương thức, hiển thị/tích hợp kết quả.
- Week 8: đăng nhập/đăng ký.
- Week 9: phân quyền và chức năng admin/user.
- Week 10: hoàn thiện, kiểm thử và tích hợp search vào website.
- Week 11: Precision@K, Recall@K, response time và triển khai thực tế.

Không được để roadmap nghiên cứu mở rộng làm che khuất lịch bắt buộc này.

## 4. Mục tiêu session

Hoàn thiện một Week 5 review package có thể đưa cho GVHD xem, tập trung vào phân tích nghiệp vụ/hệ thống và thiết kế dữ liệu, chưa triển khai website/backend trong session này.

Ưu tiên một mô hình rõ, đúng rubric và có thể triển khai hơn là một domain quá lớn.

## 5. Việc đầu tiên phải làm

1. Kiểm tra git status và giữ nguyên mọi thay đổi hiện có của người dùng.
2. Audit tài liệu hiện tại, không tạo file trùng nội dung nếu đã có nguồn phù hợp.
3. Trích yêu cầu từ đề cương thành compliance matrix có dẫn chiếu mục/trang.
4. So sánh phạm vi bắt buộc với phạm vi mở rộng đang có trong docs.
5. Lập kế hoạch ngắn, sau đó trực tiếp tạo artifact, render diagram và kiểm tra.

Không dừng ở kế hoạch nếu có thể tiếp tục an toàn.

## 6. Conflict cần xử lý công khai

### Conflict A — actor trong rubric và actor mở rộng

Đề cương/rubric tập trung vào người dùng và quản trị viên. Tài liệu hiện tại còn có Seller, Reviewer và Researcher.

Hướng xử lý đề xuất:

- Primary/core actors trong Week 5: Guest, Registered User, Administrator/Product Manager, AI/Search System, Background Processing Worker.
- Seller có thể được gộp vào Administrator/Product Manager trong phạm vi rubric chính.
- Reviewer chỉ giữ nếu thật sự cần cho metadata review và không làm use-case chính rối.
- Researcher là actor hỗ trợ artifact/benchmark, không chi phối sơ đồ nghiệp vụ website chính.
- Nếu giữ actor mở rộng, phải đánh dấu “extension ngoài rubric” trong compliance matrix.

Không tự động biến đồ án thành marketplace nhiều seller.

### Conflict B — Việt hóa và lịch thực hiện

Một số docs hiện nhấn mạnh Vietnamese adaptation/RQ1 sớm. GVHD hiện yêu cầu hoàn thành Week 5 system analysis trước và nói Việt hóa chưa quan trọng ở thời điểm này.

Hướng xử lý:

- Giữ tiếng Việt là hướng/khả năng của search text trong phạm vi dài hạn.
- Không mở multilingual model selection, Vietnamese Gold benchmark hoặc fine-tuning trong Week 5.
- Cập nhật roadmap/briefing nếu chúng mô tả thứ tự ưu tiên trái với đề cương/GVHD.
- Không hạ thấp ba search mode bắt buộc của sản phẩm cuối.

### Conflict C — Week 4 Gate

Người dùng cho phép chuyển sang Week 5 vì phần kỹ thuật Week 4 đã xong; teammate chỉ còn rerun.

Hướng xử lý:

- Gọi Week 4 là “implementation complete; independent verification pending”.
- Cho phép Week 5 bắt đầu.
- Không ghi “14/14 verified” cho đến khi teammate ký.
- Không chạy lại hoặc thay đổi baseline trừ khi phát hiện artifact hỏng.

## 7. Deliverable bắt buộc

Tạo thư mục `docs/week5/` nếu chưa tồn tại, với các artifact sau. Có thể điều chỉnh tên file nhỏ nếu repository đã có convention rõ hơn, nhưng phải giữ mapping dễ hiểu.

### 7.1 Compliance matrix

File đề xuất:

`docs/week5/WEEK5_COMPLIANCE_MATRIX.md`

Mỗi dòng tối thiểu có:

- requirement ID;
- yêu cầu nguyên văn hoặc paraphrase sát đề cương;
- nguồn/trang;
- artifact đáp ứng;
- trạng thái;
- owner;
- deadline/tuần;
- bằng chứng;
- core rubric hay extension.

Phải làm rõ:

- website bắt buộc;
- mobile chỉ là mở rộng;
- ba search mode bắt buộc;
- Precision@K, Recall@K và response time bắt buộc nhưng theo lịch Week 11;
- VTON/3D/outfit compatibility không nằm trong rubric chính;
- stack hiện hành: Next.js + Spring Boot + Python/FastAPI internal AI;
- điểm nào còn cần xác nhận với GVHD.

### 7.2 Requirement specification

File đề xuất:

`docs/week5/WEEK5_REQUIREMENTS_SPECIFICATION.md`

Bao gồm:

- mục tiêu hệ thống;
- stakeholder/actor;
- functional requirements có ID;
- non-functional requirements có ID;
- business rules;
- assumptions;
- constraints;
- out-of-scope;
- acceptance criteria;
- traceability về đề cương và use case.

Phân biệt rõ yêu cầu bắt buộc với extension nghiên cứu.

Không thiết kế payment, order, shipping, POS, loyalty hoặc inventory phức tạp.

### 7.3 Business use-case package

Files đề xuất:

- `docs/week5/WEEK5_BUSINESS_USE_CASES.md`
- source diagram dưới `tools/diagrams/week5/`
- rendered SVG hoặc PNG có version.

Bao phủ tối thiểu:

- quản trị catalog sản phẩm;
- người dùng tìm kiếm và xem sản phẩm;
- cập nhật embedding/index khi sản phẩm thay đổi;
- quản lý tài khoản/quyền ở mức nghiệp vụ;
- đánh giá/duyệt metadata chỉ khi giữ trong core/extension có lý do.

Mỗi use case quan trọng có:

- ID và tên;
- mục tiêu;
- actor;
- precondition;
- trigger;
- main flow;
- alternative flow;
- failure/exception flow;
- postcondition;
- related requirements;
- dữ liệu bị đọc/ghi;
- core hay extension.

### 7.4 System use-case package

Files đề xuất:

- `docs/week5/WEEK5_SYSTEM_USE_CASES.md`
- source diagram dưới `tools/diagrams/week5/`
- rendered SVG hoặc PNG có version.

Bao phủ:

- đăng ký;
- đăng nhập/đăng xuất;
- đổi mật khẩu;
- phân quyền;
- CRUD sản phẩm;
- upload/quản lý ảnh;
- quản lý danh mục;
- xem danh sách/chi tiết;
- cập nhật profile;
- lịch sử tìm kiếm;
- sản phẩm quan tâm;
- chọn/hủy chọn kết quả nếu giữ theo đề cương;
- image search;
- text search;
- multimodal search;
- Top-K result display.

Dùng include/extend có chủ đích, không lạm dụng để làm sơ đồ rối.

### 7.5 Analysis class model

Files đề xuất:

- `docs/week5/WEEK5_ANALYSIS_CLASS_MODEL.md`
- source diagram dưới `tools/diagrams/week5/`
- rendered SVG hoặc PNG có version.

Phân biệt boundary, control/service và entity/value object. Không biến sơ đồ lớp phân tích thành code Spring Boot.

Domain tối thiểu cần xem xét:

- User;
- Role;
- Product;
- ProductVersion;
- ProductImage;
- Category;
- ProductFacet nếu thật sự nằm trong scope;
- Embedding;
- IndexPublication;
- SearchRequest;
- SearchResult;
- SearchHistory;
- SavedProduct/InterestedProduct;
- ProcessingJob.

Ghi rõ trách nhiệm, quan hệ và cardinality quan trọng. External model/index artifact phải được phân biệt với entity nghiệp vụ.

### 7.6 Data model

Files đề xuất:

- `docs/week5/WEEK5_DATA_MODEL.md`
- ERD source dưới `tools/diagrams/week5/`
- rendered SVG hoặc PNG có version.

Bao gồm:

- ERD;
- data dictionary sơ bộ;
- primary key;
- foreign key;
- cardinality;
- nullable/required;
- unique constraint;
- version field;
- timestamps;
- state/lifecycle;
- ownership;
- model/index/catalog provenance;
- deletion/archive strategy ở mức phân tích.

Không mô hình hóa payment, order, shipping, POS hoặc inventory phức tạp.

### 7.7 Open questions và review checklist

File đề xuất:

`docs/week5/WEEK5_OPEN_QUESTIONS_AND_REVIEW.md`

Phải có các câu hỏi cần GVHD xác nhận, ví dụ:

- Admin có kiêm toàn bộ product manager hay cần Seller actor riêng?
- Reviewer/metadata approval có bắt buộc hay là extension?
- “chọn/hủy chọn” trong đề cương được hiểu là saved/interested product hay selection trong màn hình kết quả?
- Xóa sản phẩm là hard delete hay archive/soft delete?
- Có cần quản lý danh mục động trong MVP hay taxonomy cố định?
- Stack Next.js + Spring Boot + internal Python/FastAPI đã được GVHD chấp thuận chính thức chưa?
- Diagram source GVHD ưu tiên Draw.io hay chấp nhận PlantUML/Mermaid kèm ảnh render?

Kèm checklist dùng trong buổi review với GVHD.

## 8. Yêu cầu chất lượng diagram

- Mỗi diagram phải có source có thể chỉnh sửa và bản render để xem nhanh.
- Chọn một notation/tool nhất quán sau khi kiểm tra tool hiện có; ưu tiên notation UML/ERD rõ ràng.
- Nếu dùng PlantUML/Mermaid/Graphviz, pin hoặc ghi version/render command.
- Nếu dùng Draw.io, giữ file `.drawio` và export SVG/PNG.
- Render và kiểm tra trực quan: không chữ bị cắt, không đường nối đè nhau, font đọc được, actor/entity không trùng.
- Diagram phải khớp với đặc tả text và requirement ID.
- Không chỉ tạo Mermaid source mà không kiểm tra render nếu diagram là deliverable chính.

## 9. Nguyên tắc mô hình hóa

- Bám rubric trước, extension sau.
- Một khái niệm dùng một tên thống nhất giữa requirement, use case, class và ERD.
- Phân biệt nghiệp vụ với chi tiết triển khai.
- Phân biệt product catalog metadata với AI artifact.
- Spring Boot sở hữu user, role, catalog, history và business workflow.
- Python AI service sở hữu encode/search execution và model/index artifact; không lặp auth/CRUD.
- Next.js là client website, không tạo business backend thứ hai.
- FAISS không phải database nghiệp vụ.
- PostgreSQL không thay model/index artifact.
- Background job phải thể hiện vì embedding/index update không nhất thiết chạy đồng bộ trong request CRUD.
- Không đưa RQ1/RQ2/RQ3 chi tiết vào sơ đồ nghiệp vụ chính nếu không cần.

## 10. Cách xử lý tài liệu hiện có

- Không xóa hoặc ghi đè snapshot Week 4.
- Không sửa baseline code/model/index nếu không liên quan Week 5.
- Nếu docs/01, docs/06, docs/08, docs/PROJECT_BRIEFING hoặc Decision Register mâu thuẫn với lịch mới, cập nhật có kiểm soát và ghi change record.
- Word/ZIP cũ có Flutter là historical snapshot; không dùng làm yêu cầu hiện hành.
- Cập nhật docs/README.md để dẫn tới Week 5 package sau khi artifact hoàn tất.
- Tạo một Week 5 status/gate file nếu giúp người khác kiểm tra package.

## 11. Gate Week 5

Chỉ coi session hoàn thành khi:

- [ ] Compliance matrix đối chiếu đầy đủ rubric/đề cương.
- [ ] Requirement specification có ID và traceability.
- [ ] Business use-case diagram và đặc tả khớp nhau.
- [ ] System use-case diagram và đặc tả bao phủ chức năng bắt buộc.
- [ ] Analysis class diagram phân biệt boundary/control/entity.
- [ ] ERD và data dictionary nhất quán với class/use case.
- [ ] Tất cả diagram có editable source và rendered artifact đã xem trực quan.
- [ ] Open-question list cho GVHD tồn tại.
- [ ] Core rubric và extension được phân biệt rõ.
- [ ] Không có payment/order/shipping/POS/full e-commerce scope creep.
- [ ] Không mở rộng sang fine-tuning, Vietnamese benchmark, VTON, 3D hoặc mobile.
- [ ] Docs index và các liên kết nội bộ không hỏng.
- [ ] Git diff được review; thay đổi người dùng được giữ nguyên.

## 12. Cách báo cáo tiến độ trong session

Sau mỗi milestone, cập nhật ngắn:

1. file nào được tạo/sửa;
2. quyết định hoặc conflict nào vừa xử lý;
3. diagram/test/link check nào đã chạy;
4. blocker hoặc câu hỏi nào cần GVHD;
5. milestone tiếp theo.

Khi kết thúc, báo cáo:

- Week 5 Gate đạt bao nhiêu mục;
- danh sách artifact và đường dẫn;
- requirement/use-case/class/entity counts;
- diagram nào đã render và kiểm tra;
- conflicts đã giải quyết và open questions còn lại;
- file nào cập nhật vì thay đổi thứ tự ưu tiên;
- ba việc tiếp theo theo đúng lịch đề cương.

Không commit hoặc push nếu người dùng chưa yêu cầu.
```

## Bộ ref rút gọn để gửi kèm session

Nếu không muốn paste toàn bộ đường dẫn trong prompt, gửi session mới các ref theo thứ tự sau:

### Bắt buộc đọc trước khi làm

1. `CNTT_KLCN198_Tìm kiếm sản phẩm thời trang bằng hình ảnh và mô tả tự nhiên.pdf`
   - Trang 1-4: mục tiêu, yêu cầu, rubric và chức năng bắt buộc.
   - Trang 5-6: lịch Week 1-12; Week 5 là system analysis package.
2. `docs/README.md`
   - Chỉ mục và thứ tự thẩm quyền.
3. `docs/10_DECISION_REGISTER.md`
   - D003, D004, D006, D051-D055; đặc biệt stack Web hiện hành.
4. `docs/01_PROJECT_SCOPE_AND_REQUIREMENTS.md`
   - Actor, functional/non-functional requirements và API mức cao hiện có; cần audit scope extension.
5. `docs/06_SYSTEM_ARCHITECTURE_AND_DEPLOYMENT.md`
   - Ownership giữa Next.js, Spring Boot và Python AI.
6. `docs/00_MASTER_BLUEPRINT.md`
   - Kiến trúc và research scope tổng thể; chỉ dùng sau nguồn trên.
7. `docs/08_EXECUTION_ROADMAP.md`
   - Cần đối chiếu lại thứ tự triển khai với lịch đề cương/GVHD.

### Ref hiện trạng và bàn giao

8. `docs/PROJECT_BRIEFING.md`
9. `docs/TEAM_HANDOFF_CURRENT_STATUS_AND_NOTEBOOK_PLAN.md`
10. `docs/week4/WEEK4_GATE_STATUS.md`
11. `docs/week4/WEEK4_PILOT_REPORT.v1.md`

### Ref thiết kế triển khai về sau

12. `docs/phases/PHASE_6_PRODUCT_WEB_MOBILE.md`
13. `schemas/product.schema.json`
14. `schemas/experiment-manifest.schema.json`
15. `tools/assets/system_architecture.web-v1.1.dot`
16. `tools/assets/system_architecture.web-v1.1.png`

## Tóm tắt quyết định để session mới không hiểu sai

- Week 4: implementation complete, independent verification pending.
- Week 5: bắt đầu ngay theo phân công chính thức, không chờ Việt hóa AI.
- Deliverable trước mắt: yêu cầu + use case + class analysis + data model.
- Website là bắt buộc; mobile là optional.
- Stack: Next.js frontend, Spring Boot business/public API, internal Python/FastAPI AI.
- Core actor cần đơn giản theo rubric; Seller/Reviewer/Researcher là extension cần biện minh.
- Notebook baseline là việc demo tiếp theo của luồng AI, nhưng không được chen trước Week 5 system analysis trong session này.
- Vietnamese adaptation/fine-tuning để sau khi phần phân tích hệ thống và dữ liệu nền đạt yêu cầu.
