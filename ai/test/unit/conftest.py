"""Fixtures dùng chung cho unit test: Qdrant in-memory + CLIP giả (không cần Docker, GPU hay tải model).

Chạy từ thư mục `ai/`:  python -m pytest test/unit -v
"""

import io
import os
import sys
from pathlib import Path

import pytest
import torch
from PIL import Image
from qdrant_client import QdrantClient

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("HF_HUB_OFFLINE", "1")

from src.core.config import settings  # noqa: E402
import src.repositories.image_repository as image_repository_module  # noqa: E402
from src.repositories import ImageRepository  # noqa: E402
import importlib  # noqa: E402

# Lưu ý: src.services/__init__ re-export instance trùng tên (search_service, point_service) nên phải
# lấy module thật qua sys.modules / import_module.
point_service_module = importlib.import_module("src.services.point_service")
search_service_module = importlib.import_module("src.services.search_service")

TEST_COLLECTION = "unit_test_collection"


class FakeBatch(dict):
    def to(self, device):
        return self


class FakeProcessor:
    """Bộ xử lý CLIP giả: ghi lại tham số gọi để kiểm tra truncation."""

    def __init__(self):
        self.calls = []

    def __call__(self, text=None, images=None, **kwargs):
        self.calls.append({"has_text": text is not None, **kwargs})
        if text is not None:
            seed = sum(ord(c) for c in text[0]) % 100003
        else:
            seed = int(sum(images.resize((4, 4)).tobytes())) % 100003
        return FakeBatch(seed=torch.tensor([seed]))


class FakeModel:
    @staticmethod
    def _vec(seed):
        g = torch.Generator().manual_seed(int(seed[0]))
        return torch.randn(1, 512, generator=g)

    def get_text_features(self, seed):
        return self._vec(seed)

    def get_image_features(self, seed):
        return self._vec(seed)


@pytest.fixture
def fake_processor(monkeypatch):
    processor = FakeProcessor()
    fake = ("cpu", FakeModel(), processor)
    monkeypatch.setattr(search_service_module, "get_ai_model", lambda: fake)
    monkeypatch.setattr(point_service_module, "get_ai_model", lambda: fake)
    return processor


@pytest.fixture
def mem_repo(monkeypatch):
    """ImageRepository trên Qdrant in-memory, gắn vào registry cho cả collection test và collection mặc định."""
    client = QdrantClient(":memory:")
    repo = ImageRepository(collection_name=TEST_COLLECTION, client=client)
    repo.ensure_collection_exists()
    registry = image_repository_module._image_repositories
    monkeypatch.setitem(registry, TEST_COLLECTION, repo)

    default_name = settings.qdrant.collection_name
    default_repo = ImageRepository(collection_name=default_name, client=client)
    default_repo.ensure_collection_exists()
    monkeypatch.setitem(registry, default_name, default_repo)
    return default_repo


def make_image_bytes(color=(200, 30, 30), fmt="PNG", size=(32, 32)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, fmt)
    return buf.getvalue()


@pytest.fixture
def image_bytes():
    return make_image_bytes()


@pytest.fixture
def client(fake_processor, mem_repo):
    from fastapi.testclient import TestClient
    from src.main import app

    # Không dùng context manager -> không chạy lifespan (không nạp CLIP thật). Giả lập client loopback.
    return TestClient(app, client=("127.0.0.1", 50000))


@pytest.fixture
def seeded(mem_repo, fake_processor):
    """Seed 3 point: 2 point sản phẩm (id số) có product_id/metadata + 1 point ảnh dataset (UUID, không product_id)."""
    from src.services.point_service import PointService

    srv = PointService()
    srv.upsert_product_point(806, name="Áo sơ mi trắng", brand_slug="nowsaigon", model="SRC-1")
    srv.upsert_product_point(807, name="Quần jean xanh", brand_slug="rubies", model="SRC-2")
    mem_repo.create(
        point_id="b7363b77-af4c-5e58-8d43-1d5a9f9e8a51",
        vector=FakeModel._vec(torch.tensor([7])).numpy()[0].tolist(),
        payload={"image_path": "", "file_name": "x.jpg", "catalog": "nowsaigon", "status": "SEEDED"},
    )
    return mem_repo
