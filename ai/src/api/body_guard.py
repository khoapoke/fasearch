"""Cap actual ASGI bytes before FastAPI JSON/multipart parsers run."""
import json
from src.api.validation import error_response


class BoundedBodyMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path = scope.get("path", "")
        search = "/search/" in path
        async def no_store(message):
            if search and message["type"] == "http.response.start":
                message["headers"] = [(k, v) for k, v in message.get("headers", [])
                                      if k.lower() != b"cache-control"]
                message["headers"].append((b"cache-control", b"no-store"))
            await send(message)
        if not search or scope.get("method") != "POST":
            return await self.app(scope, receive, no_store)
        headers = dict(scope.get("headers", []))
        content_type = headers.get(b"content-type", b"").lower().split(b";", 1)[0]
        json_route = path.endswith("/text")
        expected = b"application/json" if json_route else b"multipart/form-data"
        if content_type != expected:
            return await error_response(415, "UNSUPPORTED_MEDIA_TYPE",
                                        "Content-Type không được hỗ trợ.")(scope, receive, no_store)
        cap = 16384 if json_route else 11 * 1024 * 1024
        try:
            declared = headers.get(b"content-length")
            if declared is not None and (not declared.isdigit() or int(declared) > cap):
                return await error_response(413, "PAYLOAD_TOO_LARGE",
                                            "Envelope vượt giới hạn.")(scope, receive, no_store)
        except ValueError:
            return await error_response(413, "PAYLOAD_TOO_LARGE",
                                        "Envelope vượt giới hạn.")(scope, receive, no_store)
        chunks, total = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            total += len(chunk)
            if total > cap:
                return await error_response(413, "PAYLOAD_TOO_LARGE",
                                            "Envelope vượt giới hạn.")(scope, receive, no_store)
            chunks.append(chunk)
            if not message.get("more_body", False):
                break
        body = b"".join(chunks)
        if json_route:
            def unique_object(pairs):
                result = {}
                for key, value in pairs:
                    if key in result:
                        raise ValueError("duplicate JSON field")
                    result[key] = value
                return result
            def reject_constant(value):
                raise ValueError("nonfinite JSON value")
            try:
                json.loads(body.decode("utf-8", errors="strict"),
                           object_pairs_hook=unique_object, parse_constant=reject_constant)
            except (ValueError, RecursionError):
                return await error_response(422, "INVALID_REQUEST", "JSON không hợp lệ.")(scope, receive, no_store)
        delivered = False
        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()
        await self.app(scope, replay, no_store)
