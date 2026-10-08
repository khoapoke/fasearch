"""Fashion AI Search API (hardened local shadow prototype).

- Lifespan validates model + collection/manifest readiness; search routes
  fail closed (503) while not ready.
- No public mount serves query-upload temp files. Only known catalogue
  identities resolve under ``/catalogue/images``.
- CORS is an explicit local-dev allowlist (default none); credentials are
  only enabled when an explicit origin list is configured.
- JSON bodies on API routes are capped (16 KiB) before full buffering;
  search responses carry ``Cache-Control: no-store``.
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from src.api.body_guard import BoundedBodyMiddleware
from src.db.schemas import HealthResponse

from src.api.endpoints import router as search_router
from src.api.validation import ApiError, error_response
from src.core.ai_model import check_model_ready, get_ai_model, shutdown_model
from src.core.config import load_shadow_config
from src.core.qdrant_client import check_qdrant_ready, close_qdrant

log = logging.getLogger("fashion-ai-shadow")


def _cors_origins() -> list[str]:
    try:
        origins = load_shadow_config()["api"].get("cors_allow_origins") or []
        return [o for o in origins if isinstance(o, str) and o]
    except Exception:
        return []


def _concurrency() -> int:
    try:
        return max(1, int(load_shadow_config()["api"]
                          .get("max_concurrent_inference", 4)))
    except Exception:
        return 4


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n[+] Đang khởi động Server...")
    app.state.readiness = {"model": {"ok": False, "reason": "not-started"},
                           "qdrant": {"ok": False, "reason": "not-started"}}
    app.state.inference_sem = asyncio.Semaphore(_concurrency())
    app.state.workers = set()
    try:
        await asyncio.to_thread(get_ai_model)
        app.state.readiness["model"] = check_model_ready()
    except Exception as exc:
        app.state.readiness["model"] = {"ok": False,
                                        "reason": f"init-error: {type(exc).__name__}"}
    app.state.readiness["qdrant"] = await asyncio.to_thread(check_qdrant_ready)
    model_ok = app.state.readiness["model"].get("ok")
    qdrant_ok = app.state.readiness["qdrant"].get("ok")
    if model_ok and qdrant_ok:
        print("[+] Hệ thống AI và Database đã sẵn sàng nhận Request!\n")
    else:
        print(f"[!] Khởi động với readiness hạn chế: model={model_ok} "
              f"qdrant={qdrant_ok} (search trả 503 cho tới khi sẵn sàng)\n")
    yield
    print("\n[-] Đang tắt Server, dọn dẹp tài nguyên...")
    if app.state.workers:
        await asyncio.gather(*app.state.workers, return_exceptions=True)
    shutdown_model()
    close_qdrant()


app = FastAPI(
    title="Fashion AI Search API (shadow prototype)",
    description="Backend thử nghiệm local: CLIP + Qdrant shadow (không phải backend công khai).",
    version="1.1.0",
    lifespan=lifespan,
)

_origins = _cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=bool(_origins),
    allow_methods=["GET", "POST"] if _origins else [],
    allow_headers=["Content-Type", "X-Trace-Id"] if _origins else [],
)


app.add_middleware(BoundedBodyMiddleware)


@app.exception_handler(RequestValidationError)
async def invalid_request(request, exc):
    # FastAPI's default errors echo rejected raw inputs.
    return error_response(422, "INVALID_REQUEST", "Yêu cầu không hợp lệ.")


@app.exception_handler(ApiError)
async def typed_error(request, exc):
    return error_response(exc.status_code, exc.code, str(exc), exc.trace_id)


@app.exception_handler(Exception)
async def unexpected_error(request, exc):
    log.error("request failure: %s", type(exc).__name__)
    return error_response(500, "INTERNAL_ERROR", "Yêu cầu thất bại.")


app.include_router(search_router, prefix="/api", tags=["Search API"])
# Internal probes share the router but keep canonical /internal paths.
app.include_router(search_router, prefix="", tags=["Internal probes"])


@app.get("/", tags=["Trang chủ"])
async def root():
    return {"message": "Server Fashion Search AI (shadow) đang chạy. Mở /docs để xem API."}


@app.get("/health", tags=["Lifecycle"])
async def health():
    return {"status": "ok"}


@app.get("/internal/v1/health", response_model=HealthResponse,
           tags=["Internal probes"])
async def internal_health():
    """Canonical internal liveness (no model inference; never 503s on data)."""
    return JSONResponse(status_code=200,
                        content=HealthResponse(version="1.1.0").model_dump(),
                        headers={"Cache-Control": "no-store"})


@app.get("/ready", tags=["Lifecycle"])
async def ready(request: Request):
    state = {"model": await asyncio.to_thread(check_model_ready),
             "qdrant": await asyncio.to_thread(check_qdrant_ready)}
    request.app.state.readiness = state
    model = state.get("model", {"ok": False, "reason": "unknown"})
    qdrant = state.get("qdrant", {"ok": False, "reason": "unknown"})
    ok = bool(model.get("ok") and qdrant.get("ok"))
    return JSONResponse(status_code=200 if ok else 503,
                        content={"ready": ok, "model": model, "qdrant": qdrant})
