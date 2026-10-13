# Local web server for the game that tells the browser never to cache files,
# so every refresh loads the newest code. Run: python3 serve.py
import http.server

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

http.server.ThreadingHTTPServer(("", 8000), NoCacheHandler).serve_forever()
