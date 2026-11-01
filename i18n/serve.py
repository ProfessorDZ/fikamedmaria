#!/usr/bin/env python3
"""Fika med Maria — local preview with the same addresses as Vercel.

    python3 i18n/serve.py [port]     # default 8000 -> http://localhost:8000

Serves the site root. Addresses have no ".html" (vercel.json cleanUrls): /kursy
answers with kursy.html, /blog with blog.html (not the blog/ folder), /en/ with
en/index.html. An address that matches nothing gets 404.html with status 404,
like production. Plain `python3 -m http.server` can do neither.
"""
import io
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent


class Handler(SimpleHTTPRequestHandler):
    def send_head(self):
        raw = self.path.split("?", 1)[0].split("#", 1)[0]
        path = Path(self.translate_path(raw))
        page = path.with_name(path.name + ".html")
        if not raw.endswith("/") and not path.is_file() and page.is_file():
            self.path = raw + ".html"
        elif not path.exists() or (path.is_dir() and not (path / "index.html").is_file()):
            body = (SITE / "404.html").read_bytes()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            return io.BytesIO(body) if self.command == "GET" else None
        return super().send_head()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"http://localhost:{port}")
    ThreadingHTTPServer(("", port), partial(Handler, directory=str(SITE))).serve_forever()
