from __future__ import annotations

import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote


class ApiError(Exception):
    def __init__(self, message: str, status: HTTPStatus = HTTPStatus.BAD_REQUEST) -> None:
        super().__init__(message)
        self.status = status


def read_json_body(handler: BaseHTTPRequestHandler, max_bytes: int) -> dict[str, object]:
    length_text = handler.headers.get("Content-Length") or "0"
    try:
        length = int(length_text)
    except ValueError as exc:
        raise ApiError("invalid Content-Length") from exc
    if length > max_bytes:
        raise ApiError("request is too large", HTTPStatus.REQUEST_ENTITY_TOO_LARGE)

    raw = handler.rfile.read(length)
    try:
        data = json.loads(raw.decode("utf-8") or "{}")
    except json.JSONDecodeError as exc:
        raise ApiError(f"invalid JSON: {exc.msg}") from exc
    if not isinstance(data, dict):
        raise ApiError("JSON body must be an object")
    return data


def send_json(
    handler: BaseHTTPRequestHandler,
    payload: dict[str, object],
    status: HTTPStatus = HTTPStatus.OK,
) -> None:
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    handler.send_response(status.value)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def _content_type(path: Path) -> str:
    return {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".ico": "image/x-icon",
    }.get(path.suffix.lower(), "application/octet-stream")


def serve_static(handler: BaseHTTPRequestHandler, web_dir: Path, rel: str) -> None:
    clean = unquote(rel).lstrip("/")
    resolved_root = web_dir.resolve()
    if clean in {"", "."}:
        file_path = resolved_root / "index.html"
    else:
        file_path = (resolved_root / clean).resolve()
        if resolved_root not in file_path.parents and file_path != resolved_root:
            handler.send_error(HTTPStatus.FORBIDDEN.value)
            return

    if file_path.is_dir():
        file_path = file_path / "index.html"

    if not file_path.is_file():
        handler.send_error(HTTPStatus.NOT_FOUND.value)
        return

    body = file_path.read_bytes()
    handler.send_response(HTTPStatus.OK.value)
    handler.send_header("Content-Type", _content_type(file_path))
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-cache")
    handler.end_headers()
    handler.wfile.write(body)
