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
from .composed_request import (
    ALLOWED_IMAGE_TYPES,
    DECODED_IMAGE_FORMATS,
    MAX_IMAGE_BYTES,
    ComposedHttpError,
    parse_composed_form,
)
from .models import (
    ComposedProvenance,
    ComposedSearchResponse,
    ComposedSearchResult,
    ErrorResponse,
    HealthResponse,
    ImageSearchResponse,
    ImageSearchResult,
    PublicationRef,
)
from .module import (
    ComposedSearchModule,
    FusionVersionMismatchError,
    ImageSearchModule,
    ModuleUnavailableError,
    PublicationIdentity,
    PublicationMismatchError,
    TokenBudgetExceededError,
)
from .runtime import provide_composed_search_module, provide_image_search_module


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

    @app.exception_handler(FusionVersionMismatchError)
    async def fusion_version_mismatch_handler(
        request: Request,
        exc: FusionVersionMismatchError,
    ) -> JSONResponse:
        trace_id = request.headers.get("x-trace-id")
        return _error(
            409,
            "FUSION_VERSION_MISMATCH",
            "Requested fusion version does not match the loaded AI fusion version",
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
        "/internal/v1/search/composed",
        response_model=ComposedSearchResponse,
        responses={
            400: {"model": ErrorResponse},
            409: {"model": ErrorResponse},
            413: {"model": ErrorResponse},
            415: {"model": ErrorResponse},
            422: {"model": ErrorResponse},
            503: {"model": ErrorResponse},
        },
        tags=["search"],
    )
    async def search_composed(
        request: Request,
        module: ComposedSearchModule = Depends(provide_composed_search_module),
    ) -> ComposedSearchResponse | JSONResponse:
        header_trace = request.headers.get("x-trace-id")
        try:
            form = await request.form()
        except Exception:
            return _error(400, "INVALID_REQUEST", "Multipart body cannot be parsed", header_trace)
        try:
            parsed = parse_composed_form(form, header_trace)
        except ComposedHttpError as exc:
            return _error(exc.status_code, exc.code, str(exc), exc.trace_id)

        if parsed.image_file.content_type not in ALLOWED_IMAGE_TYPES:
            return _error(
                415, "INVALID_IMAGE", "Unsupported image content type", parsed.trace_id
            )
        try:
            contents = await parsed.image_file.read(MAX_IMAGE_BYTES + 1)
        finally:
            await parsed.image_file.close()
        if not contents:
            return _error(400, "INVALID_IMAGE", "Image is empty", parsed.trace_id)
        if len(contents) > MAX_IMAGE_BYTES:
            return _error(
                413, "IMAGE_TOO_LARGE", "Image exceeds the 10 MiB limit", parsed.trace_id
            )
        try:
            with Image.open(BytesIO(contents)) as decoded:
                if decoded.format != DECODED_IMAGE_FORMATS[parsed.image_file.content_type]:
                    return _error(
                        415,
                        "INVALID_IMAGE",
                        "Image content does not match the declared content type",
                        parsed.trace_id,
                    )
                decoded.verify()
        except (UnidentifiedImageError, OSError):
            return _error(
                400, "INVALID_IMAGE", "Image content cannot be decoded", parsed.trace_id
            )

        expected = PublicationIdentity(
            catalog_snapshot_id=parsed.catalog_snapshot_id,
            model_version=parsed.model_version,
            index_version=parsed.index_version,
        )
        suffix = ALLOWED_IMAGE_TYPES[parsed.image_file.content_type]

        try:
            with TemporaryDirectory(prefix="fasearch-query-") as directory:
                image_path = Path(directory) / f"query{suffix}"
                image_path.write_bytes(contents)
                outcome = await run_in_threadpool(
                    module.search_composed,
                    image_path,
                    parsed.modification_text,
                    parsed.k,
                    expected,
                    parsed.fusion_version,
                    parsed.exclude_product_id,
                )
        except PublicationMismatchError:
            return _error(
                409,
                "PUBLICATION_MISMATCH",
                "Requested publication does not match the loaded AI publication",
                parsed.trace_id,
            )
        except FusionVersionMismatchError:
            return _error(
                409,
                "FUSION_VERSION_MISMATCH",
                "Requested fusion version does not match the loaded AI fusion version",
                parsed.trace_id,
            )
        except TokenBudgetExceededError as exc:
            return _error(400, "TEXT_TOO_LONG", str(exc), parsed.trace_id)
        except ValueError:
            return _error(
                400, "INVALID_REQUEST", "Modification text is empty", parsed.trace_id
            )
        return ComposedSearchResponse(
            trace_id=parsed.trace_id,
            publication=PublicationRef(
                catalog_snapshot_id=outcome.publication.catalog_snapshot_id,
                model_version=outcome.publication.model_version,
                index_version=outcome.publication.index_version,
            ),
            requested_k=parsed.k,
            returned_k=len(outcome.results),
            provenance=ComposedProvenance(
                model_config_hash=outcome.model_config_hash,
                text_overflow_policy=outcome.text_overflow_policy,  # type: ignore[arg-type]
                self_match_policy=outcome.self_match_policy,  # type: ignore[arg-type]
                fusion={
                    "fusion_version": outcome.fusion_version,
                    "strategy": "WEIGHTED_SUM",
                    "image_weight": 0.5,
                    "text_weight": 0.5,
                    "component_normalization": "L2",
                    "output_normalization": "L2",
                    "similarity_metric": "NORMALIZED_INNER_PRODUCT",
                },
            ),
            results=[
                ComposedSearchResult(
                    product_id=item.product_id,
                    product_version_id=item.product_version_id,
                    rank=item.rank,
                    similarity_score=item.similarity_score,
                )
                for item in outcome.results
            ],
            ai_latency_ms=outcome.ai_latency_ms,
        )

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
