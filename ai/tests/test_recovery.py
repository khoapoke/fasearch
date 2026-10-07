"""A5/A8: ingest preflight + repeat safety against the real server."""

import numpy as np
import pytest
from qdrant_client import QdrantClient

from src.core.config import load_shadow_config

qdrant_client = pytest.importorskip("qdrant_client")


@pytest.fixture(scope="module")
def server():
    cfg = load_shadow_config()["qdrant"]
    client = QdrantClient(url=f"http://{cfg['host']}:{cfg['http_port']}")
    yield client, cfg["collection_name"]
    client.close()


def test_collection_holds_frozen_600(server):
    client, collection = server
    assert client.collection_exists(collection)
    assert client.count(collection, exact=True).count == 600


def test_wrong_dimension_query_fails_closed(server):
    from qdrant_client.models import SearchParams
    client, collection = server
    with pytest.raises(Exception):
        client.query_points(collection_name=collection,
                            query=[0.0] * 513, limit=5,
                            search_params=SearchParams(exact=True))


def test_unknown_collection_fails_closed(server):
    client, _ = server
    with pytest.raises(Exception):
        client.query_points(collection_name="no_such_collection_xyz",
                            query=[0.0] * 512, limit=5)


def test_ingest_preflight_rejects_bad_snapshot(monkeypatch):
    import scripts.ingest_shadow as ing
    cfg = load_shadow_config()
    monkeypatch.setattr(np, "load", lambda *args, **kwargs: np.zeros((10, 512), dtype=np.float32))
    from src.core.config import task_repo_root
    with pytest.raises(ValueError, match="Invalid frozen vectors"):
        ing.load_inputs(task_repo_root(), cfg)
