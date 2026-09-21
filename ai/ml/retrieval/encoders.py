from __future__ import annotations

import importlib.metadata
import re
import time
import unicodedata
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Sequence

import numpy as np
from PIL import Image

from .utils import assert_unit_norm, canonical_json_hash, l2_normalize


class MultimodalEncoder(ABC):
    @property
    @abstractmethod
    def dimension(self) -> int: ...

    @property
    @abstractmethod
    def manifest(self) -> dict[str, Any]: ...

    @abstractmethod
    def encode_images(self, paths: Sequence[Path]) -> np.ndarray: ...

    @abstractmethod
    def encode_texts(self, texts: Sequence[str]) -> np.ndarray: ...


class HFClipEncoder(MultimodalEncoder):
    """Frozen Hugging Face CLIP adapter with exact revision pinning."""

    def __init__(
        self,
        model_id: str,
        revision: str,
        device: str = "cpu",
        precision: str = "float32",
        batch_size: int = 16,
        norm_tolerance: float = 1e-4,
    ) -> None:
        try:
            import torch
            from transformers import AutoProcessor, CLIPModel
        except ImportError as exc:
            raise RuntimeError(
                "HF CLIP dependencies are missing. Install requirements.lock in Python 3.12."
            ) from exc
        self._torch = torch
        self.model_id = model_id
        self.revision = revision
        self.device = torch.device(device)
        self.precision = precision
        self.batch_size = batch_size
        self.norm_tolerance = norm_tolerance
        self.processor = AutoProcessor.from_pretrained(model_id, revision=revision)
        self.model = CLIPModel.from_pretrained(model_id, revision=revision).to(self.device)
        self.model.eval()
        for parameter in self.model.parameters():
            parameter.requires_grad_(False)
        self._dimension = int(self.model.config.projection_dim)
        if precision == "float16" and self.device.type != "cpu":
            self.model.half()
        self._manifest = self._build_manifest()

    @property
    def dimension(self) -> int:
        return self._dimension

    @property
    def manifest(self) -> dict[str, Any]:
        return dict(self._manifest)

    def _build_manifest(self) -> dict[str, Any]:
        processor_config = {
            "image_processor": self.processor.image_processor.to_dict(),
            "tokenizer_class": type(self.processor.tokenizer).__name__,
        }
        manifest = {
            "schema_version": "1.0.0",
            "adapter": "hf_clip",
            "model_id": self.model_id,
            "checkpoint_revision": self.revision,
            "embedding_dimension": self.dimension,
            "preprocessing": processor_config,
            "normalization": "L2 after projection",
            "device": str(self.device),
            "precision": self.precision,
            "batch_size": self.batch_size,
            "frozen": True,
            "torch_version": importlib.metadata.version("torch"),
            "transformers_version": importlib.metadata.version("transformers"),
        }
        manifest["config_hash"] = canonical_json_hash(manifest)
        manifest["model_version"] = (
            f"{self.model_id}@{self.revision[:12]}+{manifest['config_hash'][:12]}"
        )
        return manifest

    def encode_images(self, paths: Sequence[Path]) -> np.ndarray:
        outputs: list[np.ndarray] = []
        for start in range(0, len(paths), self.batch_size):
            images = []
            for path in paths[start : start + self.batch_size]:
                with Image.open(path) as image:
                    images.append(image.convert("RGB").copy())
            inputs = self.processor(images=images, return_tensors="pt")
            pixel_values = inputs["pixel_values"].to(self.device)
            if self.precision == "float16" and self.device.type != "cpu":
                pixel_values = pixel_values.half()
            with self._torch.inference_mode():
                features = self.model.get_image_features(pixel_values=pixel_values)
            outputs.append(features.float().cpu().numpy())
        result = l2_normalize(np.concatenate(outputs, axis=0))
        assert_unit_norm(result, self.norm_tolerance)
        return result

    def encode_texts(self, texts: Sequence[str]) -> np.ndarray:
        outputs: list[np.ndarray] = []
        for start in range(0, len(texts), self.batch_size):
            batch = list(texts[start : start + self.batch_size])
            inputs = self.processor(text=batch, return_tensors="pt", padding=True, truncation=True)
            inputs = {key: value.to(self.device) for key, value in inputs.items()}
            with self._torch.inference_mode():
                features = self.model.get_text_features(**inputs)
            outputs.append(features.float().cpu().numpy())
        result = l2_normalize(np.concatenate(outputs, axis=0))
        assert_unit_norm(result, self.norm_tolerance)
        return result


class FixtureEncoder(MultimodalEncoder):
    """Deterministic plumbing-only encoder for offline tests; never a research baseline."""

    _COLORS = {
        "đỏ": (1.0, 0.0, 0.0), "do": (1.0, 0.0, 0.0), "red": (1.0, 0.0, 0.0),
        "xanh": (0.0, 0.3, 1.0), "blue": (0.0, 0.3, 1.0),
        "đen": (0.05, 0.05, 0.05), "den": (0.05, 0.05, 0.05), "black": (0.05, 0.05, 0.05),
        "trắng": (1.0, 1.0, 1.0), "trang": (1.0, 1.0, 1.0), "white": (1.0, 1.0, 1.0),
        "vàng": (1.0, 0.85, 0.0), "vang": (1.0, 0.85, 0.0), "yellow": (1.0, 0.85, 0.0),
        "hồng": (1.0, 0.2, 0.6), "hong": (1.0, 0.2, 0.6), "pink": (1.0, 0.2, 0.6),
    }

    def __init__(self, norm_tolerance: float = 1e-4) -> None:
        self.norm_tolerance = norm_tolerance
        manifest = {
            "schema_version": "1.0.0",
            "adapter": "fixture_encoder",
            "model_id": "deterministic-fixture-encoder",
            "checkpoint_revision": "fixture-v1",
            "embedding_dimension": 12,
            "preprocessing": "RGB 96x96 region statistics + deterministic Unicode keyword view",
            "normalization": "L2",
            "device": "cpu",
            "precision": "float32",
            "batch_size": 1,
            "frozen": True,
            "scientific_use": "PROHIBITED",
        }
        manifest["config_hash"] = canonical_json_hash(manifest)
        manifest["model_version"] = f"fixture-v1+{manifest['config_hash'][:12]}"
        self._manifest = manifest

    @property
    def dimension(self) -> int:
        return 12

    @property
    def manifest(self) -> dict[str, Any]:
        return dict(self._manifest)

    @staticmethod
    def _image_vector(path: Path) -> np.ndarray:
        with Image.open(path) as image:
            rgb = np.asarray(image.convert("RGB").resize((96, 96)), dtype=np.float32) / 255.0
        # Saturated/non-white pixels encode the synthetic garment shape and color.
        foreground = np.min(rgb, axis=2) < 0.92
        if not np.any(foreground):
            foreground = np.ones((96, 96), dtype=bool)
        mean_color = rgb[foreground].mean(axis=0)
        ys, xs = np.nonzero(foreground)
        y_mean = float(ys.mean() / 95.0)
        y_std = float(ys.std() / 95.0)
        x_std = float(xs.std() / 95.0)
        top_mass = float(foreground[:32].mean())
        mid_mass = float(foreground[32:64].mean())
        bottom_mass = float(foreground[64:].mean())
        # Three learned-space category anchors are represented explicitly for fixture QA.
        category = np.zeros(3, dtype=np.float32)
        if top_mass > bottom_mass * 1.35:
            category[0] = 1.0
        elif bottom_mass > top_mass * 1.35:
            category[1] = 1.0
        else:
            category[2] = 1.0
        return np.array([
            *mean_color, *category, y_mean, y_std, x_std, top_mass, mid_mass, bottom_mass
        ], dtype=np.float32)

    @staticmethod
    def _normalize_text(text: str) -> str:
        normalized = unicodedata.normalize("NFC", text).lower()
        return re.sub(r"[^\w\s]", " ", normalized)

    def _text_vector(self, text: str) -> np.ndarray:
        view = self._normalize_text(text)
        color = np.array([0.45, 0.45, 0.45], dtype=np.float32)
        for token, rgb in self._COLORS.items():
            if token in view:
                color = np.asarray(rgb, dtype=np.float32)
                break
        category = np.zeros(3, dtype=np.float32)
        if any(token in view for token in ("áo", "ao", "shirt", "top", "polo")):
            category[0] = 1.0
        elif any(token in view for token in ("quần", "quan", "váy ngắn", "jeans", "shorts", "skirt")):
            category[1] = 1.0
        elif any(token in view for token in ("đầm", "dam", "váy liền", "jumpsuit", "dress")):
            category[2] = 1.0
        else:
            category[:] = 1.0 / 3.0
        shape = np.array([0.5, 0.2, 0.2, 0.2, 0.2, 0.2], dtype=np.float32)
        if category[0]:
            shape = np.array([0.30, 0.18, 0.24, 0.52, 0.22, 0.06], dtype=np.float32)
        elif category[1]:
            shape = np.array([0.70, 0.18, 0.18, 0.05, 0.20, 0.50], dtype=np.float32)
        elif category[2]:
            shape = np.array([0.55, 0.30, 0.30, 0.20, 0.35, 0.20], dtype=np.float32)
        return np.concatenate([color, category, shape])

    def encode_images(self, paths: Sequence[Path]) -> np.ndarray:
        result = l2_normalize(np.stack([self._image_vector(Path(path)) for path in paths]))
        assert_unit_norm(result, self.norm_tolerance)
        return result

    def encode_texts(self, texts: Sequence[str]) -> np.ndarray:
        result = l2_normalize(np.stack([self._text_vector(text) for text in texts]))
        assert_unit_norm(result, self.norm_tolerance)
        return result


def timed_encode(callable_: Any, *args: Any) -> tuple[np.ndarray, float]:
    started = time.perf_counter()
    result = callable_(*args)
    return result, (time.perf_counter() - started) * 1000.0
