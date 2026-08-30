from __future__ import annotations

import os
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from word_bank.errors import DatabaseError, ValidationError
from word_bank.http import ApiError, read_json_body, send_json, serve_static
from word_bank.store import WordStore

MAX_JSON_BYTES = 64_000
PORT = 8000

PROJECT_ROOT = Path(__file__).resolve().parent.parent
GALLERY_DIR = Path(__file__).resolve().parent / "web"
TYPING_DIR = PROJECT_ROOT / "typing_engine" / "web"
SHARED_DIR = PROJECT_ROOT / "shared"
DEFAULT_DATA_DIR = PROJECT_ROOT / "data"
DATA_DIR = Path(os.environ.get("JAPANESE_WORD_BANK_DIR", DEFAULT_DATA_DIR))

STORE = WordStore(str(DATA_DIR))


class WordBankHandler(BaseHTTPRequestHandler):
    server_version = "JapaneseWordBankWeb/1.0"

    def do_GET(self) -> None:  # noqa: N802
        self._dispatch("GET")

    def do_POST(self) -> None:  # noqa: N802
        self._dispatch("POST")

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"{self.address_string()} - {fmt % args}")

    def _dispatch(self, method: str) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        try:
            if path.startswith("/api/"):
                self._handle_api(method, path)
                return
            if method != "GET":
                raise ApiError("method not allowed", HTTPStatus.METHOD_NOT_ALLOWED)
            self._handle_static(path)
        except ApiError as exc:
            send_json(self, {"ok": False, "error": str(exc)}, exc.status)
        except (ValidationError, DatabaseError, ValueError) as exc:
            send_json(self, {"ok": False, "error": str(exc)}, HTTPStatus.BAD_REQUEST)
        except Exception as exc:
            send_json(
                self,
                {"ok": False, "error": f"unexpected server error: {exc}"},
                HTTPStatus.INTERNAL_SERVER_ERROR,
            )

    def _handle_api(self, method: str, path: str) -> None:
        if path == "/api/words" and method == "GET":
            send_json(self, {"ok": True, "words": STORE.list_words()})
            return
        if path == "/api/words" and method == "POST":
            payload = read_json_body(self, MAX_JSON_BYTES)
            word = STORE.create_word(payload)
            send_json(self, {"ok": True, "word": word}, HTTPStatus.CREATED)
            return
        raise ApiError("not found", HTTPStatus.NOT_FOUND)

    def _handle_static(self, path: str) -> None:
        if path.startswith("/shared/"):
            serve_static(self, SHARED_DIR, path[len("/shared/") :])
            return
        if path == "/typing" or path.startswith("/typing/"):
            rel = path[len("/typing") :]
            serve_static(self, TYPING_DIR, rel)
            return
        serve_static(self, GALLERY_DIR, path)


def run(host: str = "127.0.0.1", port: int = PORT) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((host, port), WordBankHandler)
    print(f"http://{host}:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
    finally:
        server.server_close()


if __name__ == "__main__":
    run()
