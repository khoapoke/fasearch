"""Pinned CLIP singleton: explicit device, revision, lifecycle ownership.

- Model/provenance pinned to the frozen week-4 baseline
  (openai/clip-vit-base-patch32 @ 092a3b7e3172...).
- Configured device is honored (``cpu`` default). ``auto`` resolves to
  CUDA only when actually available and logs the choice.
- Thread-safe lazy init; ``shutdown_model()`` releases ownership.
- ``check_model_ready()`` validates eval mode + frozen weights instead of
  trusting construction.
"""

from __future__ import annotations

import threading
from typing import Any

import torch
from transformers import CLIPModel, CLIPProcessor

from src.core.config import load_shadow_config, settings

_model = None
_processor = None
_device: str | None = None
_lock = threading.Lock()
_init_error: str | None = None

MODEL_ID = settings["model"]["id"]
MODEL_REVISION = "092a3b7e31726acc3a0207eea00f6040ac8b03a7"


def resolve_device(configured: str | None = None) -> str:
    """Honor the configured device instead of silently picking CUDA."""
    want = (configured or settings["model"].get("device", "cpu")).lower()
    if want == "auto":
        chosen = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[*] device=auto -> {chosen}")
        return chosen
    if want == "cuda" and not torch.cuda.is_available():
        print("[!] device=cuda yêu cầu nhưng CUDA không khả dụng; dùng cpu")
        return "cpu"
    if want not in ("cpu", "cuda"):
        raise ValueError(f"device không hỗ trợ: {configured!r}")
    return want


def get_ai_model():
    """Thread-safe singleton; loads once with pinned revision."""
    global _model, _processor, _device, _init_error
    if _model is not None:
        return _device, _model, _processor
    with _lock:
        if _model is not None:
            return _device, _model, _processor
        shadow = load_shadow_config()
        configured = shadow["model"]["device"]
        if (shadow["model"]["id"] != MODEL_ID or shadow["model"]["revision"] != MODEL_REVISION or
            shadow["publication"]["model_id"] != MODEL_ID or
            shadow["publication"]["model_revision"] != MODEL_REVISION):
            raise ValueError("Configured model does not match frozen checkpoint")
        _device = resolve_device(configured)
        print(f"[*] Đang nạp mô hình CLIP lên thiết bị: {_device} "
              f"(revision {MODEL_REVISION[:12]}...)...")
        model = CLIPModel.from_pretrained(MODEL_ID, revision=MODEL_REVISION).to(_device)
        processor = CLIPProcessor.from_pretrained(MODEL_ID, revision=MODEL_REVISION)
        model.eval()
        model.requires_grad_(False)
        # Publish only the complete initialized pair, never a half-built singleton.
        _processor, _model = processor, model
        print("[*] Khởi tạo mô hình AI thành công!")
        return _device, _model, _processor


def check_model_ready() -> dict[str, Any]:
    """Validate the loaded model instead of trusting construction."""
    if _model is None or _processor is None or _device is None:
        return {"ok": False, "reason": "model-not-initialized"}
    if not isinstance(_model, CLIPModel):
        return {"ok": False, "reason": "unexpected-model-type"}
    if _model.training:
        return {"ok": False, "reason": "model-not-in-eval-mode"}
    frozen = all(not p.requires_grad for p in _model.parameters())
    if not frozen:
        return {"ok": False, "reason": "weights-not-frozen"}
    return {"ok": True, "device": _device, "model_id": MODEL_ID,
            "revision": MODEL_REVISION}


def shutdown_model() -> None:
    """Release singleton ownership (called on server shutdown / tests)."""
    global _model, _processor, _device, _init_error
    with _lock:
        _model = None
        _processor = None
        _device = None
        _init_error = None
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
