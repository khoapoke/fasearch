"""Regressions at the real receive, tokenizer and cancelled-worker seams."""
import asyncio
import threading
from types import SimpleNamespace

import pytest

from src.api.validation import ApiError, check_token_budget


@pytest.mark.parametrize("path,content_type,cap", [
    ("/api/search/text", "application/json", 16384),
    ("/internal/v1/search/text", "application/json", 16384),
    ("/search/image", "multipart/form-data; boundary=a", 11 * 1024 * 1024),
])
@pytest.mark.parametrize("length", [None, b"1"])
def test_chunked_body_stops_before_parser(path, content_type, cap, length):
    from src.main import app
    async def probe():
        consumed = 0
        sent = []
        async def receive():
            nonlocal consumed
            consumed += 1
            # The second chunk crosses the cap; the third must never be read.
            return {"type": "http.request", "body": b"x" * (cap // 2 + 1),
                    "more_body": consumed < 3}
        async def send(message):
            sent.append(message)
        headers = [(b"content-type", content_type.encode())]
        if length is not None:
            headers.append((b"content-length", length))
        await app({"type": "http", "asgi": {"version": "3.0"},
                   "method": "POST", "path": path, "raw_path": path.encode(),
                   "query_string": b"", "headers": headers,
                   "scheme": "http", "server": ("test", 80),
                   "client": ("test", 1), "http_version": "1.1"}, receive, send)
        start = next(m for m in sent if m["type"] == "http.response.start")
        assert start["status"] == 413
        assert consumed == 2
        assert (b"cache-control", b"no-store") in start["headers"]
    asyncio.run(probe())


def test_tokenizer_failure_is_closed(monkeypatch):
    import src.core.ai_model as ai_model
    def broken():
        raise RuntimeError("private model path")
    monkeypatch.setattr(ai_model, "get_ai_model", broken)
    with pytest.raises(ApiError) as caught:
        check_token_budget("shirt", "test")
    assert caught.value.status_code == 503
    assert "private" not in str(caught.value)


def test_token_budget_uses_loaded_model(monkeypatch):
    import src.core.ai_model as ai_model
    model = SimpleNamespace(config=SimpleNamespace(
        text_config=SimpleNamespace(max_position_embeddings=5)))
    processor = SimpleNamespace(tokenizer=lambda *a, **kw: {"input_ids": list(range(6))})
    monkeypatch.setattr(ai_model, "get_ai_model", lambda: ("cpu", model, processor))
    with pytest.raises(ApiError) as caught:
        check_token_budget("shirt", "test")
    assert caught.value.code == "TEXT_TOO_LONG"


def test_cancelled_upload_retains_file_and_slot_until_worker_finishes(monkeypatch, tmp_path):
    from src.api import endpoints
    from starlette.requests import Request
    from starlette.datastructures import UploadFile, Headers
    import io
    from PIL import Image
    started, release = threading.Event(), threading.Event()
    seen = []
    def worker(path, limit):
        started.set()
        release.wait(3)
        seen.append(__import__("os").path.exists(path))
        return []
    async def ready(*args):
        return None
    monkeypatch.setattr(endpoints, "_require_ready", ready)
    monkeypatch.setattr(endpoints, "_task_temp_dir", lambda: str(tmp_path))
    monkeypatch.setattr(endpoints.search_service, "search_by_image", worker)
    data = io.BytesIO()
    Image.new("RGB", (2, 2)).save(data, format="PNG")
    async def run():
        sem = asyncio.Semaphore(1)
        app = SimpleNamespace(state=SimpleNamespace(inference_sem=sem, workers=set()))
        request = Request({"type": "http", "app": app, "headers": []})
        upload = UploadFile(io.BytesIO(data.getvalue()), filename="same.png",
                            headers=Headers({"content-type": "image/png"}))
        task = asyncio.create_task(endpoints.api_search_image(request, upload, 5))
        assert await asyncio.to_thread(started.wait, 2)
        task.cancel()
        await asyncio.sleep(.02)
        try:
            assert list(tmp_path.iterdir()), "cancel deleted an in-use query file"
            assert sem.locked(), "cancel released a slot while native worker still ran"
        finally:
            release.set()
            try:
                await task
            except asyncio.CancelledError:
                pass
            await asyncio.sleep(.05)
        assert seen == [True]
        assert not list(tmp_path.iterdir())
    asyncio.run(run())


def test_timeout_retains_slot_and_shutdown_tracks_native_worker(monkeypatch):
    from src.api import endpoints
    from starlette.requests import Request
    started, release = threading.Event(), threading.Event()
    monkeypatch.setattr(endpoints, "load_shadow_config", lambda: {"api": {"request_timeout_s": .02}})
    def blocking():
        started.set()
        release.wait(2)
        return "complete"
    async def run():
        sem = asyncio.Semaphore(1)
        app = SimpleNamespace(state=SimpleNamespace(inference_sem=sem, workers=set()))
        request = Request({"type": "http", "app": app, "headers": []})
        try:
            with pytest.raises(ApiError) as exc:
                await endpoints._run_worker(request, blocking)
            assert exc.value.status_code == 503 and started.is_set()
            assert sem.locked() and len(app.state.workers) == 1
        finally:
            release.set()
            await asyncio.gather(*app.state.workers)
            await asyncio.sleep(0)
        assert not sem.locked() and not app.state.workers
    asyncio.run(run())


def test_parallel_workers_never_exceed_configured_slots():
    from src.api import endpoints
    from starlette.requests import Request
    import time
    lock = threading.Lock()
    active = peak = 0
    def blocking():
        nonlocal active, peak
        with lock:
            active += 1
            peak = max(peak, active)
        time.sleep(.02)
        with lock:
            active -= 1
    async def run():
        app = SimpleNamespace(state=SimpleNamespace(inference_sem=asyncio.Semaphore(2), workers=set()))
        request = Request({"type": "http", "app": app, "headers": []})
        await asyncio.gather(*(endpoints._run_worker(request, blocking) for _ in range(8)))
        assert peak == 2 and active == 0
    asyncio.run(run())


@pytest.mark.parametrize("path", ["/api/search/image", "/internal/v1/search/image", "/internal/v1/search/composed"])
@pytest.mark.parametrize("content_type,body", [
    ("multipart/form-data", b"private-malformed-body"),
    ("multipart/form-data; boundary=a", b"invalid-boundary-private-body"),
])
def test_malformed_multipart_is_sanitized_typed_client_error(path, content_type, body):
    from fastapi.testclient import TestClient
    from src.main import app
    response = TestClient(app).post(path, content=body, headers={"content-type": content_type})
    assert response.status_code in (400, 422)
    assert response.json()["code"] == "INVALID_REQUEST"
    assert "private" not in response.text
    assert response.headers["cache-control"] == "no-store"


def test_concurrent_same_name_uploads_have_distinct_files_and_cleanup(monkeypatch, tmp_path):
    from src.api import endpoints
    from starlette.requests import Request
    from starlette.datastructures import UploadFile, Headers
    import io
    from PIL import Image
    barrier = threading.Barrier(2)
    paths, contents = [], []
    async def ready(*args): pass
    def worker(path, limit):
        paths.append(path)
        barrier.wait(timeout=2)
        contents.append(__import__("pathlib").Path(path).read_bytes())
        return []
    monkeypatch.setattr(endpoints, "_require_ready", ready)
    monkeypatch.setattr(endpoints, "_task_temp_dir", lambda: str(tmp_path))
    monkeypatch.setattr(endpoints.search_service, "search_by_image", worker)
    async def run():
        state = SimpleNamespace(inference_sem=asyncio.Semaphore(2), workers=set())
        request = Request({"type":"http", "app":SimpleNamespace(state=state), "headers":[]})
        uploads = []
        for color in ("red", "blue"):
            data = io.BytesIO(); Image.new("RGB", (2,2), color).save(data,format="PNG")
            uploads.append(UploadFile(io.BytesIO(data.getvalue()), filename="/../../same.png",
                                     headers=Headers({"content-type":"image/png"})))
        responses = await asyncio.gather(*(endpoints.api_search_image(request, upload, 5) for upload in uploads))
        assert all(response.results == [] for response in responses)
        assert len(set(paths)) == 2 and len(set(contents)) == 2
        assert all("same.png" not in path and __import__("pathlib").Path(path).parent == tmp_path for path in paths)
        assert not list(tmp_path.iterdir())
        assert all(upload.file.closed for upload in uploads)
    asyncio.run(run())


def test_failed_inference_removes_query_file_and_sanitizes_error(monkeypatch, tmp_path):
    from src.api import endpoints
    from starlette.requests import Request
    from starlette.datastructures import UploadFile, Headers
    import io
    from PIL import Image
    async def ready(*args): pass
    def worker(path, limit):
        assert __import__("pathlib").Path(path).exists()
        raise RuntimeError("private filesystem query secret")
    monkeypatch.setattr(endpoints, "_require_ready", ready)
    monkeypatch.setattr(endpoints, "_task_temp_dir", lambda: str(tmp_path))
    monkeypatch.setattr(endpoints.search_service, "search_by_image", worker)
    async def run():
        request = Request({"type":"http", "app":SimpleNamespace(state=SimpleNamespace(
            inference_sem=asyncio.Semaphore(1), workers=set())), "headers":[]})
        data = io.BytesIO(); Image.new("RGB",(2,2)).save(data,format="PNG")
        upload = UploadFile(io.BytesIO(data.getvalue()), filename="query.png", headers=Headers({"content-type":"image/png"}))
        response = await endpoints.api_search_image(request, upload, 5)
        assert response.status_code == 500 and b'"code":"INTERNAL_ERROR"' in response.body
        assert b"private" not in response.body and b"secret" not in response.body
        assert not list(tmp_path.iterdir()) and upload.file.closed
    asyncio.run(run())


def test_parser_failure_closes_partially_created_spooled_file(monkeypatch):
    from fastapi.testclient import TestClient
    from src.main import app
    from starlette import formparsers
    original = formparsers.SpooledTemporaryFile
    opened = []
    def tracked(*args, **kwargs):
        file = original(*args, **kwargs)
        opened.append(file)
        return file
    monkeypatch.setattr(formparsers, "SpooledTemporaryFile", tracked)
    payload = (b'--a\r\nContent-Disposition: form-data; name="file"; filename="same.png"\r\n'
               b'Content-Type: image/png\r\n\r\nx\r\n--a\r\nBadHeaderWithoutColon\r\n\r\nx\r\n--a--\r\n')
    response = TestClient(app).post("/api/search/image", content=payload,
                                   headers={"content-type":"multipart/form-data; boundary=a"})
    assert response.status_code == 422
    assert opened, "must reach real parser's file allocation before failure"
    assert all(file.closed for file in opened)
