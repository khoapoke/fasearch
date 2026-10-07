import copy
import importlib.util
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest

from src.core.config import load_shadow_config, task_repo_root
from src.core.publication import load_frozen_inputs, validate_records
from src.api.validation import ApiError

spec = importlib.util.spec_from_file_location("ingest", Path(__file__).resolve().parents[1] / "scripts/ingest_shadow.py")
ingest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ingest)


def test_real_preflight_rejects_config_publication_mismatch():
    cfg = copy.deepcopy(load_shadow_config())
    cfg["publication"]["model_version"] = "stale"
    with pytest.raises(ValueError, match="manifest/publication"):
        load_frozen_inputs(task_repo_root(), cfg)


def test_hash_verification_cannot_be_disabled():
    with pytest.raises(ValueError, match="cannot be disabled"):
        ingest.load_inputs(task_repo_root(), load_shadow_config(), verify_hash=False)


def test_ingest_rejects_unknown_collection_before_mutation():
    cfg = copy.deepcopy(load_shadow_config())
    cfg["qdrant"]["collection_name"] = "foreign"
    class NoCalls:
        def __getattr__(self, name):
            raise AssertionError("client must not be called")
    with pytest.raises(ValueError, match="chưa đăng ký"):
        ingest.ensure_collection(NoCalls(), cfg)


def test_reset_is_never_name_only_ownership():
    with pytest.raises(ValueError, match="reset disabled"):
        ingest.ensure_collection(object(), load_shadow_config(), reset=True)


def test_exact_records_reject_same_id_foreign_payload_and_duplicates():
    expected = {"1": {"product_id": "a", "product_version_id": "a-v1"}}
    good = SimpleNamespace(id="1", payload=expected["1"])
    assert validate_records([good], expected) == {"1"}
    with pytest.raises(ValueError):
        validate_records([SimpleNamespace(id="1", payload={"product_id": "b"})], expected)
    with pytest.raises(ValueError):
        validate_records([good, good], expected)


def test_batch_failure_retry_recovers_without_duplicate_ids():
    from qdrant_client.models import PointStruct
    points = [PointStruct(id=n, vector=[float(n)], payload={"n": n}) for n in range(5)]
    class Client:
        stored = {}
        calls = 0
        fail_once = True
        def upsert(self, collection_name, points, wait):
            self.calls += 1
            if self.calls == 2 and self.fail_once:
                self.fail_once = False
                raise OSError("simulated partial batch failure")
            self.stored.update({str(p.id): p.model_copy(deep=True) for p in points})
        def scroll(self, *args, **kwargs):
            return list(self.stored.values()), None
        def count(self, *args, **kwargs):
            return SimpleNamespace(count=len(self.stored))
    client = Client()
    with pytest.raises(OSError):
        ingest.ingest(client, load_shadow_config(), points, batch_size=2)
    assert len(client.stored) == 2
    assert ingest.ingest(client, load_shadow_config(), points, batch_size=2) == 5
    assert len(client.stored) == 5
    client.stored["0"].vector = [99.]
    with pytest.raises(ValueError, match="mismatch"):
        ingest.verify_ingested(client, load_shadow_config(), points)


def test_runtime_readiness_refreshes_after_upstream_failure(monkeypatch):
    from src.core import qdrant_client
    class Down:
        def collection_exists(self, *args):
            raise TimeoutError("secret upstream address")
    monkeypatch.setattr(qdrant_client, "get_qdrant_client", lambda: Down())
    assert qdrant_client.check_qdrant_ready() == {"ok": False, "reason": "qdrant-error: TimeoutError"}


def test_result_validation_rejects_nonfinite_and_foreign_hits(monkeypatch):
    from src.services import search_service
    monkeypatch.setattr(search_service, "validate_records", lambda _: None)
    with pytest.raises(ApiError) as exc:
        search_service._format_results([SimpleNamespace(score=float("nan"))])
    assert exc.value.status_code == 503


def test_missing_shadow_config_never_falls_back_to_shared_qdrant(monkeypatch):
    from src.core import qdrant_client
    monkeypatch.setattr(qdrant_client, "_client", None)
    def missing():
        raise FileNotFoundError("private config path")
    def must_not_connect(*args, **kwargs):
        raise AssertionError("must not construct legacy/shared client")
    monkeypatch.setattr(qdrant_client, "load_shadow_config", missing)
    monkeypatch.setattr(qdrant_client, "QdrantClient", must_not_connect)
    with pytest.raises(FileNotFoundError):
        qdrant_client.get_qdrant_client()
    assert qdrant_client.check_qdrant_ready()["ok"] is False
