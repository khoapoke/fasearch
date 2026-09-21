from __future__ import annotations

from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from . import __version__
from .models import (
    ErrorResponse,
    HealthResponse,
    ImageSearchResponse,
    ImageSearchResult,
    PublicationRef,
)
from .module import (
    ImageSearchModule,
    ModuleUnavailableError,
    PublicationIdentity,
    PublicationMismatchError,
)
from .runtime import provide_image_search_module


MAX_IMAGE_BYTES = 10 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _error(status_code: int, code: str, message: str, trace_id: str | None) -> JSONResponse:
    payload = ErrorResponse(code=code, message=message, trace_id=trace_id)
    return JSONResponse(status_code=status_code, content=payload.model_dump())


def create_app() -> FastAPI:
    app = FastAPI(
        title="FaSearch Internal AI",
        version=__version__,
        docs_url="/internal/docs",
        openapi_url="/internal/openapi.json",
    )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        trace_id = request.headers.get("x-trace-id")
        return _error(422, "INVALID_REQUEST", "Request validation failed", trace_id)

    @app.exception_handler(PublicationMismatchError)
    async def publication_mismatch_handler(
        request: Request,
        exc: PublicationMismatchError,
    ) -> JSONResponse:
        trace_id = request.headers.get("x-trace-id")
        return _error(
            409,
            "PUBLICATION_MISMATCH",
            "Requested publication does not match the loaded AI publication",
            trace_id,
        )

    @app.exception_handler(ModuleUnavailableError)
    async def module_unavailable_handler(
        request: Request,
        exc: ModuleUnavailableError,
    ) -> JSONResponse:
        trace_id = request.headers.get("x-trace-id")
        return _error(503, exc.code, str(exc), trace_id)

    @app.get("/internal/v1/health", response_model=HealthResponse, tags=["operations"])
    async def health() -> HealthResponse:
        return HealthResponse(version=__version__)

    @app.post(
        "/internal/v1/search/image",
        response_model=ImageSearchResponse,
        responses={
            400: {"model": ErrorResponse},
            409: {"model": ErrorResponse},
            415: {"model": ErrorResponse},
            422: {"model": ErrorResponse},
            503: {"model": ErrorResponse},
        },
        tags=["search"],
    )
    async def search_image(
        image: Annotated[UploadFile, File(description="JPEG, PNG or WebP query image")],
        trace_id: Annotated[str, Form(min_length=1, max_length=128)],
        catalog_snapshot_id: Annotated[str, Form(min_length=1)],
        model_version: Annotated[str, Form(min_length=1)],
        index_version: Annotated[str, Form(min_length=1)],
        k: Annotated[int, Form(ge=1, le=100)] = 10,
        module: ImageSearchModule = Depends(provide_image_search_module),
    ) -> ImageSearchResponse | JSONResponse:
        if image.content_type not in ALLOWED_IMAGE_TYPES:
            return _error(415, "INVALID_IMAGE", "Unsupported image content type", trace_id)

        contents = await image.read(MAX_IMAGE_BYTES + 1)
        await image.close()
        if not contents:
            return _error(400, "INVALID_IMAGE", "Image is empty", trace_id)
        if len(contents) > MAX_IMAGE_BYTES:
            return _error(400, "IMAGE_TOO_LARGE", "Image exceeds the 10 MiB limit", trace_id)

        try:
            with Image.open(BytesIO(contents)) as decoded:
                decoded.verify()
        except (UnidentifiedImageError, OSError):
            return _error(400, "INVALID_IMAGE", "Image content cannot be decoded", trace_id)

        expected = PublicationIdentity(
            catalog_snapshot_id=catalog_snapshot_id,
            model_version=model_version,
            index_version=index_version,
        )
        suffix = ALLOWED_IMAGE_TYPES[image.content_type]

        try:
            with TemporaryDirectory(prefix="fasearch-query-") as directory:
                image_path = Path(directory) / f"query{suffix}"
                image_path.write_bytes(contents)
                outcome = await run_in_threadpool(
                    module.search_image,
                    image_path,
                    k,
                    expected,
                )
        except PublicationMismatchError:
            return _error(
                409,
                "PUBLICATION_MISMATCH",
                "Requested publication does not match the loaded AI publication",
                trace_id,
            )
        return ImageSearchResponse(
            trace_id=trace_id,
            publication=PublicationRef(
                catalog_snapshot_id=outcome.publication.catalog_snapshot_id,
                model_version=outcome.publication.model_version,
                index_version=outcome.publication.index_version,
            ),
            results=[
                ImageSearchResult(
                    product_id=item.product_id,
                    product_version_id=item.product_version_id,
                    rank=item.rank,
                    similarity_score=item.similarity_score,
                )
                for item in outcome.results
            ],
            ai_latency_ms=outcome.ai_latency_ms,
        )

    return app


app = create_app()
