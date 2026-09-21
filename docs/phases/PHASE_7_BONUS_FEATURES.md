# Phase 7 Bonus Features

## Outcome

Thêm tối đa một bonus chính có benchmark riêng mà không làm yếu core. Ưu tiên General Outfit Compatibility trước VTON/3D nếu thời gian hạn chế.

## Entry gate

- RQ1-RQ3 gates xanh.
- Product demo core ổn.
- Báo cáo core đã có draft.
- Có owner/time box/definition of done.
- Feature flag cho phép tắt bonus.

## Track A Outfit Compatibility

### Step A1 Data

- Polyvore/disjoint hoặc curated outfit source.
- Map TOP/BOTTOM taxonomy.
- Positive/negative generation.
- Small human gold evaluation set.

### Step A2 Named factors

- Color harmony.
- Pattern balance.
- Formality gap.
- Silhouette match.
- Material/season.
- Occasion alignment.

Unit test mỗi factor trên synthetic cases.

### Step A3 GA2M

- Train/validation/test product-disjoint.
- Calibration.
- Factor/pairwise interaction limits.
- AUC/FITB.

### Step A4 Explainability

- Logit contributions.
- Ablation.
- Faithfulness test.
- Real-catalog counterfactual.

### Step A5 Optional latent shadow

- Train MLP challenger.
- Compare AUC/FITB.
- Do not enable hybrid unless promotion gate.

## Track B Virtual Try-On

### Step B1 Input flow

- Consent.
- Safe clothing guidance.
- Pose/frame/quality validator.
- PASS/SOFT_WARNING/HARD_FAIL.
- Delete/retention.

### Step B2 Single garment

- Integrate pretrained VTON after license/hardware audit.
- Top and bottom separate success/failure tests.
- Preserve input/output version.

### Step B3 Multi-garment

- Top plus bottom.
- Full job first.
- Explicit single-item fallback.
- No outerwear layering.

### Step B4 Evaluation

- Success/artifact taxonomy.
- Garment/person preservation.
- Latency/memory.
- Human qualitative sample.

## Track C 3D Avatar

### Option C1 Manual avatar

Fastest and privacy-friendly: user enters measurements/uses sliders. Good for product demo, weak personalization fidelity.

### Option C2 Guided SMPL-X fitting

More novel but heavier. Require front/optional side photo, quality checks and manual correction. Do not promise accurate measurements from one view.

### Option C3 Imported avatar/garment asset

Allows seller or user to import prepared assets. Demonstrates pipeline without solving automatic 3D reconstruction.

### Recommended slice

Manual/sample avatar plus one supported garment representation or a guided SMPL-X proof of concept. Time-box automatic garment reconstruction.

## Bonus evaluation separation

```text
Retrieval qrels != Outfit labels != VTON human ratings != 3D fidelity
```

Do not report one module's metric as another module's quality.

## Gate 7 checklist

- [ ] Core remains stable with bonus disabled.
- [ ] Separate dataset/split/metric.
- [ ] User promise scoped.
- [ ] Failure behavior visible.
- [ ] Privacy controls for body images.
- [ ] Limitations written before defense.

## Stop conditions

- Core regression.
- No reproducible inference path.
- License/dependency blocks distribution.
- GPU cost makes live demo unreliable.
- No meaningful evaluation possible within time box.

Khi stop, giữ prototype screenshots/lessons như future work, không đổ thêm thời gian để che failure.
