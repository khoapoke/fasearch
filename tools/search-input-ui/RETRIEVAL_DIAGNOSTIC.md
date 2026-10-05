# RETRIEVAL_DIAGNOSTIC — Q1 read-only (revision2)

Không đổi model/dịch/rerank/index/dataset. Chỉ quan sát + metadata.

## Routing/pins (live)

FE `/search/text` → FE proxy `/api/search/text` (CSRF session) → Boot
`/api/v1/search/text` → AI 18031 `internal/v1/search/text` (TEXT) → FAISS
`faiss-flatip-week4-v1`. Model `openai/clip-vit-base-patch32@092a3b7e…`,
catalog `catalog-20260908-pilot-v1`. Raw JSON 4 query lưu `/tmp/q1/*.json`
(phiên này; top10 bảng dưới).

Public vs internal: `pink dress` public top3 = internal top3, IDs + scores
đồng nhất (35432/0.2687, 18166/0.2679, 43659/0.2570) → **không phân kỳ
public/internal**.

## Coverage metadata (proxy, không phải ground truth ảnh)

600 rows, 24 article_type — **không có Socks/Jackets**. Title counts:
sock 0, jacket 0, crimson 0, shirt 142, dress 175, pink 28, pink+dress 14,
red 45, black 132.

## Actual top10 (internal, scores thô)

- **red shirt**: 9/10 áo/top đỏ (4836, 19153, 37721, 6986, 40388, 11739,
  39717, 34320 + 33952 peach; #10 quần jeans xanh 51475). Scores .247–.285.
  → plausible.
- **crimson jacket**: đỉnh là áo thun đỏ/legging maroon/jeans trắng…
  (11739, 28453, 30453…). Không có jacket trong catalog → engine chỉ có thể
  trả đồ đỏ/maroon gần nhất. → **absence**, không phải lỗi xếp hạng chứng
  minh được.
- **black sock**: đỉnh quần dài/short/legging tối màu (44290 navy trousers,
  37172/32648 black shorts…). Ảnh thực top1 đã xem: quần dài tối màu, không
  phải socks. → **absence** (màu khớp, article lệch).
- **pink dress**: 10/10 dresses (7 pink + 3 red), scores .250–.269; 6/10 là
  đồ trẻ em/girls. → metadata-plausible; cảm quan "poor" có thể do mix
  kids/women — quan sát, **không claim nguyên nhân**.

## Tách absence / ranking / wiring

- Absence: crimson jacket, black sock (không có article trong catalog).
- Ranking trong coverage: red shirt, pink dress trả đúng nhóm, thứ tự là
  hành vi encoder hiện tại — không suy nguyên nhân từ điểm thấp, không fix
  bằng UI.
- Wiring: không bug (public == internal; IDs/provenance/detail context đúng).

## Proposal bounded (representative quyết)

1. Chấp nhận + document hành vi absence-driven (rẻ nhất, khuyến nghị mặc định).
2. Nếu muốn UX: nhãn coverage trung thực khi query rơi vào article vắng
   (quyết định sản phẩm, cần DESIGN riêng) — không đụng model.
3. Mọi can thiệp encoder/index/dataset đều ngoài scope ticket này.
