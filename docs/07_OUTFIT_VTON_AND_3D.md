# Outfit compatibility virtual try on và 3D

## Vị trí trong đồ án

Core research vẫn là retrieval. Các module trong tài liệu này chỉ bắt đầu sau khi RQ1 đến RQ3 có baseline và evaluation harness. Mỗi module giữ dataset, split, metric và claim riêng.

# Phần A Outfit compatibility

## MVP decision

- Input: một TOP và một BOTTOM.
- Output: general compatibility score, named factor evidence và optional context/vibe adjustment.
- ONE_PIECE không cần pair compatibility trong MVP; có thể dùng context score riêng.
- Outerwear, footwear, accessories và multi-layer graph là future work.
- Personalization từ lịch sử user là future work.

## Scoring architecture

### General core

Named factors được tính từ approved taxonomy facets:

```yaml
color_harmony: 0.80
pattern_balance: 0.90
formality_gap: 0.10
silhouette_match: 0.70
material_season: 0.65
occasion_alignment: 0.75
```

GA2M học:

```text
logit(score) = beta0 + sum f_i(x_i) + limited sum f_ij(x_i, x_j)
```

Giới hạn pairwise interactions được chọn trên validation để vẫn giải thích được.

### Context or vibe affinity

MVP có thể dùng context vector do user chọn cho request hiện tại, không cần behavioral profile:

```text
final_score = base_compatibility + alpha * context_affinity
```

Alpha nhỏ, tune trên validation. Evidence tách base và context contribution.

### Personalized rerank future

Lịch sử view/save/purchase tạo vibe profile. Cần consent, cold-start handling, temporal split và recommendation evaluation riêng. Không đưa vào MVP chỉ để có thêm feature.

## Explainability modes

### EXPLAINABLE default

Chỉ GA2M/named factors. Evidence contribution exact trong logit space.

### LATENT shadow

Top/bottom embeddings concat hoặc interaction vào MLP. Không ảnh hưởng user result, chỉ đánh AUC/FITB challenger.

### HYBRID experiment

Chỉ bật khi latent thắng đủ rõ. Evidence bắt buộc:

```json
{
  "mode": "hybrid",
  "latent_weight": 0.2,
  "factor_version": "v1.3",
  "named_logit_contributions": {},
  "latent_component_explanation": "not decomposed"
}
```

Không nói evidence 100 percent exact cho toàn final score khi latent_weight lớn hơn 0.

## Data

### Positives

Ưu tiên:

1. Curated lookbook/outfit sets.
2. Outfit datasets như Polyvore disjoint.
3. Human-created team outfits cho local taxonomy.
4. Co-purchase chỉ là weak positive vì mua cùng không chắc mặc cùng.

### Negatives

- random incompatible;
- same-slot conflict;
- shuffle item từ outfit khác;
- taxonomy contradiction;
- hard near-compatible nhưng fail một factor;
- counterfactual change.

Training negatives không cần human label toàn bộ, nhưng final gold eval cần người chấm.

## Evaluation

- Compatibility AUC.
- Fill-in-the-blank accuracy.
- Calibration/Brier.
- Per-factor ablation.
- Local explanation faithfulness.
- Human rating trên golden set.
- Counterfactual success: item thật, hard constraints giữ, score tăng đúng delta.

## Counterfactual

1. Chọn factor gây giảm điểm.
2. Sinh facet change candidate, không sinh product tưởng tượng.
3. Filter active catalog bằng locked constraints.
4. Rerank bằng cùng compatibility scorer.
5. Chỉ hiển thị item có thật và score cải thiện.
6. Không có candidate thì silent fallback hoặc nói không tìm thấy, không fabricate.

# Phần B Virtual try on

## User promise được phép

Cho user hình dung tương đối một garment/outfit trên ảnh hoặc avatar. Không cam kết:

- size vừa chính xác;
- measurement y khoa;
- cloth physics thật;
- màu trên mọi màn hình chính xác;
- identity/garment detail luôn được bảo toàn.

## Input capture UX

### Không phải ảnh nude

User mặc quần áo gọn, trung tính, đủ che phủ; mục tiêu là giảm occlusion và hiểu silhouette. UI phải nói rõ bằng ví dụ hình ảnh an toàn.

### Guided capture

Flow giống identity capture về mặt hướng dẫn, không claim biometric FaceID:

1. Hiển thị outline toàn thân.
2. Kiểm distance và body-in-frame.
3. Yêu cầu pose frontal, tay hơi tách thân, chân nhìn rõ.
4. Kiểm lighting, blur, occlusion và background.
5. Optional side image.
6. Cho user review trước upload/processing.

### Quality states

- PASS: chạy inference.
- SOFT_WARNING: nêu lỗi, khuyên chụp lại, cho phép tiếp tục với low-confidence label.
- HARD_FAIL: không chạy vì crop/blur/occlusion/unsafe format làm kết quả vô nghĩa.

Warning phải có action. Không hiển thị cảnh báo rồi tiếp tục y hệt.

## Multi-garment policy

MVP user kỳ vọng top cộng bottom. Pipeline thử full outfit. Nếu fail:

1. Giữ record full-outfit failure.
2. Nếu single-item inference khả dụng, hiển thị rõ `Kết quả thử riêng áo` hoặc `Kết quả thử riêng quần`.
3. Không đặt single-item output dưới nhãn `outfit complete`.
4. Cho retry với ảnh/pose khác.

Outerwear layering là future feature vì occlusion và order complexity.

## Model paths

### 2D VTON

Person image cộng garment image tạo ảnh try-on. Đây là đường có demo trực quan nhanh nhất. Candidate references gồm VITON-HD và diffusion-based IDM-VTON, nhưng phải audit license, hardware và input preprocessing.

### SMPL-X parametric body

SMPL-X biểu diễn body, pose, hands và face parameters. Single-view fitting không bảo đảm body shape hoàn hảo; cần guided input và manual correction.

### Game-style manual avatar

User chọn chiều cao, cân nặng, shoulder/waist/hip proportions và shape sliders. Ưu điểm là privacy và controllability; hạn chế là ít giống cá nhân nếu user nhập không chính xác.

### Hybrid recommendation

Guided capture ước lượng initial avatar, sau đó user chỉnh measurement/slider. Garment visualization có thể dùng 2D VTON trước và 3D draping đơn giản sau.

## 3D asset pipeline future

```text
Product images/garment asset
 -> segmentation and garment category
 -> 2D pattern or approximate mesh
 -> rig/skin or cloth simulation setup
 -> avatar measurements/pose
 -> render views
```

Seller có thể import approved 3D garment asset. Tự động tạo accurate 3D garment từ một ảnh là research challenge riêng, không đưa vào MVP promise.

## Evaluation VTON/3D

Tách hoàn toàn khỏi retrieval qrels. Candidate evaluation:

- garment identity/detail preservation;
- person identity preservation;
- artifact/failure rate;
- pose robustness;
- top-only, bottom-only và top-bottom success;
- latency and GPU memory;
- human preference hoặc realism rating;
- consistency across retry/view nếu 3D.

No single automatic visual metric đủ để claim `hợp` hoặc `vừa`; cần qualitative failure taxonomy và human evaluation.

## Privacy and consent

### Required controls

- Purpose shown before capture.
- Explicit consent recorded with version/time.
- Raw photo retention default ngắn hoặc ephemeral.
- User can delete inputs/outputs.
- No training use by default; separate opt-in nếu bao giờ cần.
- Access limited to job owner/service.
- Encryption and signed access links.
- Avatar sample mode không cần ảnh thật.

### Shared responsibility statement

User chịu trách nhiệm chọn ảnh họ có quyền sử dụng và tuân thủ hướng dẫn. Hệ thống vẫn chịu trách nhiệm về purpose limitation, security, retention và xử lý dữ liệu theo quy định áp dụng. Disclaimer không chuyển toàn bộ trách nhiệm sang user.

## Scope gates

### Gate OUTFIT

- RQ1-RQ3 evaluation harness chạy.
- Catalog facets đủ coverage.
- Team còn capacity.

### Gate VTON

- Core website/search demo ổn; mobile là mở rộng tùy thời gian theo D055, không phải điều kiện của gate này.
- Có GPU inference plan.
- Input/consent/delete flow sẵn sàng.
- Có success/failure evaluation set.

### Gate 3D

- VTON/Avatar goal được xác định là prototype.
- Chọn manual/import/SMPL-X path.
- Có time-box và fallback demo.
- Không ảnh hưởng report completion.
