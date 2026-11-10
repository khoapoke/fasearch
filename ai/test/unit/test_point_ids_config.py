"""Test ID số/UUID của point và ghi đè collection bằng biến môi trường."""

import os
import subprocess
import sys
import uuid
from pathlib import Path

import pytest

from src.core.exceptions import InvalidInputError
from src.utils.point_id import normalize_point_id

AI_DIR = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize("raw,expected", [(806, 806), ("806", 806), (" 12 ", 12), (0, 0)])
def test_numeric_ids(raw, expected):
    assert normalize_point_id(raw) == expected


def test_uuid_ids_are_canonical():
    u = uuid.uuid4()
    assert normalize_point_id(str(u).upper()) == str(u)
    assert normalize_point_id(u.hex) == str(u)


@pytest.mark.parametrize("raw", ["abc", "", "-1", -5, "12.5", None, True, "1" * 30])
def test_invalid_ids(raw):
    with pytest.raises(InvalidInputError):
        normalize_point_id(raw)


def test_point_service_numeric_and_uuid_lifecycle(mem_repo, fake_processor, tmp_path):
    from src.services.point_service import PointService
    from conftest import make_image_bytes

    img = tmp_path / "a.png"
    img.write_bytes(make_image_bytes())
    srv = PointService()
    assert srv.create_point(img, point_id="806", product_id="806") == 806
    auto = srv.create_point(img)
    assert uuid.UUID(auto)  # vẫn tự sinh UUID khi không chỉ định
    given = str(uuid.uuid4())
    assert srv.create_point(img, point_id=given) == given

    assert mem_repo.get_by_id("806").id == 806
    assert srv.update_point_payload("806", {"product_id": "806-b"})
    assert mem_repo.get_by_id(806).payload["product_id"] == "806-b"
    assert srv.delete_point("806")  # xóa mềm
    assert mem_repo.get_by_id(806).payload["status"] == "DELETED"
    assert srv.delete_point(806, hard_delete=True)
    assert mem_repo.get_by_id(806) is None
    with pytest.raises(InvalidInputError):
        srv.create_point(img, point_id="not-an-id")


def _collection_in_subprocess(env_value):
    env = {k: v for k, v in os.environ.items() if k != "QDRANT_COLLECTION"}
    if env_value is not None:
        env["QDRANT_COLLECTION"] = env_value
    out = subprocess.run(
        [sys.executable, "-c", "from src.core.config import settings; print(settings.qdrant.collection_name)"],
        cwd=AI_DIR, env=env, capture_output=True, text=True, check=True,
    )
    return out.stdout.strip()


def test_env_collection_overrides_yaml():
    assert _collection_in_subprocess(None) == "image_gallery"  # configs/database.yaml
    assert _collection_in_subprocess("storefront_r4_v1") == "storefront_r4_v1"
    assert _collection_in_subprocess("   ") == "image_gallery"  # rỗng -> dùng YAML


def test_max_search_limit_default_is_24():
    env = {k: v for k, v in os.environ.items() if k != "MAX_SEARCH_LIMIT"}
    out = subprocess.run(
        [sys.executable, "-c", "from src.core.config import settings; print(settings.app.max_search_limit)"],
        cwd=AI_DIR, env=env, capture_output=True, text=True, check=True,
    )
    assert out.stdout.strip() == "24"

