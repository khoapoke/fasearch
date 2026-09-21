from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ml.retrieval.pipeline import create_encoder
from ml.retrieval.utils import write_json


def main() -> int:
    parser = argparse.ArgumentParser(description="Check frozen model finiteness, norm and repeat stability")
    parser.add_argument("--config", default="configs/baseline.v1.yaml")
    parser.add_argument("--image", required=True)
    parser.add_argument("--text", default="áo đỏ mặc mùa hè")
    parser.add_argument(
        "--output",
        default="artifacts/reports/week4-baseline-20260908-v1/model-stability.v1.json",
    )
    args = parser.parse_args()
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    with Path(args.config).open("r", encoding="utf-8") as handle:
        config = yaml.safe_load(handle)
    encoder = create_encoder("hf_clip", config)
    image_a = encoder.encode_images([Path(args.image)])
    image_b = encoder.encode_images([Path(args.image)])
    text_a = encoder.encode_texts([args.text])
    text_b = encoder.encode_texts([args.text])
    payload = {
        "schema_version": "1.0.0",
        "check_id": "week4-model-stability-v1",
        "model_version": encoder.manifest["model_version"],
        "dimension": encoder.dimension,
        "image_finite": bool(np.isfinite(image_a).all()),
        "text_finite": bool(np.isfinite(text_a).all()),
        "image_l2_norm": float(np.linalg.norm(image_a)),
        "text_l2_norm": float(np.linalg.norm(text_a)),
        "image_repeat_max_abs_delta": float(np.max(np.abs(image_a - image_b))),
        "text_repeat_max_abs_delta": float(np.max(np.abs(text_a - text_b))),
        "norm_tolerance": float(config["reproducibility"]["norm_tolerance"]),
        "repeat_atol": float(config["reproducibility"]["repeat_atol"]),
        "status": "PASS",
    }
    assert payload["image_finite"] and payload["text_finite"]
    assert abs(payload["image_l2_norm"] - 1.0) <= payload["norm_tolerance"]
    assert abs(payload["text_l2_norm"] - 1.0) <= payload["norm_tolerance"]
    assert payload["image_repeat_max_abs_delta"] <= payload["repeat_atol"]
    assert payload["text_repeat_max_abs_delta"] <= payload["repeat_atol"]
    write_json(Path(args.output), payload)
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
