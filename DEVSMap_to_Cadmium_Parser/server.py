from .DEVSMap_parser import generate_code
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
import json
import traceback

ALLOWED_ORIGINS = {
    "http://localhost:5500",
    "http://127.0.0.1:5500"
}


class ParserHandler(BaseHTTPRequestHandler):

    # -----------------------------
    # Common CORS headers
    # -----------------------------
    def _set_cors_headers(self):
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")

    # -----------------------------
    # Handle preflight OPTIONS
    # -----------------------------
    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    # -----------------------------
    # Handle POST requests
    # -----------------------------
    def do_POST(self):
        origin = self.headers.get("Origin")
        if origin not in ALLOWED_ORIGINS:
            self.send_response(403)
            self.end_headers()
            return

        if self.path == "/parse":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode("utf-8"))

            print("Received data:", data)
            print("Starting generate_code...")

            try:
                
                cadmiumCode = generate_code(data)
            except Exception as e:
                print("Error in generate_code:", e)
                traceback.print_exc()
                cadmiumCode = {"error": str(e)}

            self.send_response(200)
            self._set_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.end_headers()

            try:
                if isinstance(cadmiumCode, str):
                    self.wfile.write(cadmiumCode.encode("utf-8"))
                else:
                    self.wfile.write(json.dumps(cadmiumCode).encode("utf-8"))
            except ConnectionAbortedError:
                print("Client disconnected before response could be sent.")

            print("generate_code finished.")


# -----------------------------
# Threaded HTTP server
# -----------------------------
class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


# -----------------------------
# Run server
# -----------------------------
if __name__ == "__main__":
    server = ThreadedHTTPServer(("localhost", 8000), ParserHandler)
    server.serve_forever()
