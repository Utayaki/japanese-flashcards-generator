#!/usr/bin/env python3
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "web"
PORT = 8000


def main():
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    with ThreadingHTTPServer(("127.0.0.1", PORT), handler) as server:
        print(f"http://127.0.0.1:{PORT}", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
