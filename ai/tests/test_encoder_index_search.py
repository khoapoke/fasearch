import json
from pathlib import Path

import numpy as np
import pytest

from ml.retrieval.catalog import prepare_catalog
from ml.retrieval.encoders import FixtureEncoder
from ml.retrieval.fixtures import create_dataset_a_fixture
from ml.retrieval.pipeline import build_index, encode_catalog
from ml.retrieval.search import SearchEngine, normalized_model_view
from ml.retrieval.vector_index import FaissFlatIPIndex


def _pipeline(tmp_path: Path):
    raw = tmp_path / "raw"
    processed = tmp_path / "processed"
    embeddings = tmp_path / "embeddings"
    index_dir = tmp_path / "index"
    create_dataset_a_fixture(raw)
    catalog = prepare_catalog(raw, processed, 30, 42, "fixture-test-v1")
    encoder = FixtureEncoder()
    encode_catalog(catalog.catalog_path, embeddings, encoder)
    build_index(catalog.catalog_path, embeddings, index_dir, "fixture-index-v1")
    index = FaissFlatIPIndex.load(index_dir)
    manifest = json.loads((index_dir / "index-manifest.v1.json").read_text(encoding="utf-8"))
    return catalog, encoder, index, manifest


def test_encoder_is_normalized_and_stable(tmp_path: Path) -> None:
    raw = tmp_path / "raw"
    create_dataset_a_fixture(raw)
    encoder = FixtureEncoder()
    paths = [raw / "images/1001.jpg", raw / "images/1011.jpg"]
    first = encoder.encode_images(paths)
    second = encoder.encode_images(paths)
    assert first.shape == (2, encoder.dimension)
    assert np.allclose(np.linalg.norm(first, axis=1), 1.0, atol=1e-4)
    assert np.allclose(first, second, atol=1e-7)
    text = encoder.encode_texts(["áo đỏ", "ao do"])
    assert np.isfinite(text).all()
    assert np.allclose(np.linalg.norm(text, axis=1), 1.0, atol=1e-4)


def test_faiss_mapping_and_three_modes(tmp_path: Path) -> None:
    catalog, encoder, index, manifest = _pipeline(tmp_path)
    engine = SearchEngine(encoder, index, manifest)

    text = engine.search_text("áo đỏ", k=5)
    assert text["mode"] == "TEXT"
    assert all(result["mapped_category"] in {"TOP", "BOTTOM", "ONE_PIECE"} for result in text["results"])
    assert all("latency_ms" in result for result in text["results"])
    required = {"product_id", "rank", "similarity_score", "image_path", "product_title", "mapped_category", "model_version", "index_version", "latency_ms"}
    assert required <= set(text["results"][0])

    image = engine.search_image(Path(index.mapping[0]["image_path"]), k=5, exclude_product_id=index.mapping[0]["product_id"])
    assert image["mode"] == "IMAGE"
    assert index.mapping[0]["product_id"] not in [result["product_id"] for result in image["results"]]

    composed = engine.search_composed(Path(index.mapping[0]["image_path"]), "đổi sang màu xanh", k=5)
    assert composed["mode"] == "COMPOSED"
    assert composed["query"]["fusion"]["image_weight"] == 0.5


def test_wrong_model_config_is_rejected(tmp_path: Path) -> None:
    _, encoder, index, manifest = _pipeline(tmp_path)
    manifest["model_config_hash"] = "different"
    with pytest.raises(ValueError, match="different model"):
        SearchEngine(encoder, index, manifest)


def test_unicode_model_view_preserves_diacritics() -> None:
    assert normalized_model_view("  a\u0301o   đỏ ") == "áo đỏ"
