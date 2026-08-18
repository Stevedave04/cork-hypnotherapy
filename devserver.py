#!/usr/bin/env python3
"""Local dev server that mirrors Cloudflare Pages routing.

Pages serves /about from about.html, and 308-redirects /about.html -> /about.
Python's stdlib http.server serves files literally, so extensionless links
would 404 locally even though they work in production. This shim closes that
gap so local preview behaves the same as the deployed site.

Usage: python3 devserver.py [port]
"""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3456


class PagesHandler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]

        # Mirror Pages: /about.html -> 308 -> /about
        if path.endswith(".html") and path != "/index.html":
            self.send_response(308)
            self.send_header("Location", path[:-5])
            self.end_headers()
            return None

        return super().send_head()

    def translate_path(self, path):
        clean = path.split("?", 1)[0].split("#", 1)[0]
        fs_path = super().translate_path(path)

        # Extensionless request -> serve the matching .html file
        if not os.path.isfile(fs_path) and clean not in ("", "/"):
            if not os.path.splitext(clean)[1]:
                candidate = super().translate_path(clean + ".html")
                if os.path.isfile(candidate):
                    return candidate
        return fs_path


if __name__ == "__main__":
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), PagesHandler) as httpd:
        print(f"Serving {os.getcwd()} on http://127.0.0.1:{PORT} (Pages-style routing)")
        httpd.serve_forever()
