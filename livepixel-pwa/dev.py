#!/usr/bin/env python3
"""Local LivePixel server. Web Bluetooth requires localhost or HTTPS."""

import errno
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

SimpleHTTPRequestHandler.extensions_map[".webmanifest"] = "application/manifest+json"
SimpleHTTPRequestHandler.extensions_map[".js"] = "text/javascript"


if __name__ == "__main__":
    try:
        server = ThreadingHTTPServer(("127.0.0.1", 8080), SimpleHTTPRequestHandler)
    except OSError as err:
        if err.errno != errno.EADDRINUSE:
            raise
        print("http://127.0.0.1:8080 is already being served", file=sys.stderr)
        raise SystemExit(1) from err
    print("http://127.0.0.1:8080")
    server.serve_forever()
