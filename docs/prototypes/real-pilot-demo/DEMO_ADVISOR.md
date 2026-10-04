# Demo advisor 7–10 phút — Real-pilot integrated demo

Mở `http://localhost:3220/`. Đây là demo kỹ thuật PILOT_ONLY trên 600 sản phẩm thời trang thật, model CLIP frozen, không phải trang thương mại. Hiển thị similarity thô, không phải confidence/xác suất.

1. **IMAGE (2 phút):** Trang chủ, thả ảnh `11739.jpg`, nhấn tìm. Điểm nhấn: hạng 1 là chính ảnh truy vấn (self-match kỹ thuật ~1.0, chỉ chứng minh mapping), các hạng sau là đồ tương tự thật.
2. **TEXT (2 phút):** `/search/text`, nhập `red dress`. Điểm nhấn: 10 váy đỏ thật, hạng/rank/similarity giữ nguyên từ API, provenance PILOT_ONLY + REJECT_MODEL_LIMIT.
3. **COMPOSED (3 phút):** `/search/composed`, thả `11739.jpg` + nhập `doi sang mau xanh`. Điểm nhấn: kết hợp ảnh+chữ, reference UPLOAD; thử PRODUCT anchor để thấy loại trừ anchor.
4. **Giới hạn thật (2 phút):** Nhập text >77 tokens bị từ chối TEXT_TOO_LONG trước encode; ảnh sai MIME/quá lớn bị 415/413; snapshot sai bị 409.
5. **Kết (1 phút):** Hero đầu trang là MINH HỌA gắn nhãn, không gọi API. Draft tách khỏi catalog frozen. Hạn chế: CLIP baseline chưa kiểm chứng ngữ nghĩa tiếng Việt, self-retrieval không phải ground truth chất lượng.
