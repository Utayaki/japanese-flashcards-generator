from __future__ import annotations

import os
import re
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from word_bank.errors import DatabaseError, ValidationError
from word_bank.http import (
    ApiError,
    query_value,
    read_json_body,
    send_json,
    send_redirect,
    serve_static,
)
from word_bank.store import LEXICAL_ITEM_TYPES, WordStore

MAX_JSON_BYTES = 64_000
PORT = 8000
SEARCH_PREVIEW_LIMIT = 5
WORD_ID_RE = re.compile(r"^/api/words/([^/]+)$")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = Path(__file__).resolve().parent / "web"
TYPING_DIR = PROJECT_ROOT / "typing_engine" / "web"
SHARED_DIR = PROJECT_ROOT / "shared"
DEFAULT_DATA_DIR = PROJECT_ROOT / "data"
DATA_DIR = Path(os.environ.get("JAPANESE_WORD_BANK_DIR", DEFAULT_DATA_DIR))
DUMP_PATH = PROJECT_ROOT / "word_bank.json"

STORE = WordStore(str(DATA_DIR), dump_path=DUMP_PATH)


class WordBankHandler(BaseHTTPRequestHandler):
    server_version = "JapaneseWordBankWeb/1.0"

    def do_GET(self) -> None:  # noqa: N802
        self._dispatch("GET")

    def do_POST(self) -> None:  # noqa: N802
        self._dispatch("POST")

    def do_PUT(self) -> None:  # noqa: N802
        self._dispatch("PUT")

    def do_DELETE(self) -> None:  # noqa: N802
        self._dispatch("DELETE")

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"{self.address_string()} - {fmt % args}")

    def _dispatch(self, method: str) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        try:
            if path.startswith("/api/"):
                self._handle_api(method, path, query)
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

    def _handle_api(self, method: str, path: str, query: dict[str, list[str]]) -> None:
        if path == "/api/meta" and method == "GET":
            send_json(self, {"ok": True, "lexical_item_types": LEXICAL_ITEM_TYPES})
            return
        if path == "/api/search" and method == "GET":
            self._api_search(query)
            return
        if path == "/api/words" and method == "GET":
            send_json(self, {"ok": True, "words": STORE.list_words()})
            return
        if path == "/api/words" and method == "POST":
            payload = read_json_body(self, MAX_JSON_BYTES)
            word = STORE.create_word(payload)
            send_json(self, {"ok": True, "word": word}, HTTPStatus.CREATED)
            return

        match = WORD_ID_RE.fullmatch(path)
        if match is None:
            raise ApiError("not found", HTTPStatus.NOT_FOUND)
        word_id = match.group(1)
        if method == "GET":
            word = STORE.get_word(word_id)
            if word is None:
                raise ApiError("not found", HTTPStatus.NOT_FOUND)
            send_json(self, {"ok": True, "word": word})
            return
        if method == "PUT":
            payload = read_json_body(self, MAX_JSON_BYTES)
            word = STORE.update_word(word_id, payload)
            if word is None:
                raise ApiError("not found", HTTPStatus.NOT_FOUND)
            send_json(self, {"ok": True, "word": word})
            return
        if method == "DELETE":
            if not STORE.delete_word(word_id):
                raise ApiError("not found", HTTPStatus.NOT_FOUND)
            send_json(self, {"ok": True})
            return
        raise ApiError("method not allowed", HTTPStatus.METHOD_NOT_ALLOWED)

    def _api_search(self, query: dict[str, list[str]]) -> None:
        lexical_item_type = query_value(query, "lexical_item_type")
        headword = query_value(query, "q", default="")
        load_all = query_value(query, "all", default="0") == "1"
        if lexical_item_type not in LEXICAL_ITEM_TYPES:
            raise ValidationError(f"invalid lexicalItemType: {lexical_item_type}")
        if load_all:
            results = STORE.search_words(lexical_item_type, headword, limit=None)
            has_more = False
        else:
            results = STORE.search_words(
                lexical_item_type,
                headword,
                limit=SEARCH_PREVIEW_LIMIT + 1,
            )
            has_more = len(results) > SEARCH_PREVIEW_LIMIT
            results = results[:SEARCH_PREVIEW_LIMIT]
        send_json(self, {"ok": True, "results": results, "has_more": has_more})

    def _handle_static(self, path: str) -> None:
        if path.startswith("/shared/"):
            serve_static(self, SHARED_DIR, path[len("/shared/") :])
            return
        if path in {"/typing", "/typing/", "/typing/index.html"}:
            send_redirect(self, "/")
            return
        if path.startswith("/typing/"):
            rel = path[len("/typing") :]
            serve_static(self, TYPING_DIR, rel)
            return
        serve_static(self, WEB_DIR, path)


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
