from .generate_and_build import build_cadmium
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
import json
import os

ALLOWED_ORIGINS = {
    "http://127.0.0.1:5500",
    "http://localhost:5500"
}


class CadmiumHandler(BaseHTTPRequestHandler):

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

        if self.path == "/simulation-output":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode("utf-8"))

            print("Received data:", data)
            print("Starting Cadmium build...")

            try:
                print("ABOUT TO CALL build_cadmium")
                print("data type =", type(data))
                print("data keys =", data.keys() if isinstance(data, dict) else "not dict")

                simulation_output = build_cadmium(data)

            except Exception as e:
                print("Error during build_cadmium:", e)
                simulation_output = f"ERROR:\n{str(e)}"

            self.send_response(200)
            self._set_cors_headers()
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()

            try:
                self.wfile.write(simulation_output.encode("utf-8"))
            except ConnectionAbortedError:
                print("Client disconnected before response could be sent.")

            print("Cadmium build finished.")


# -----------------------------
# Threaded HTTP server
# -----------------------------
class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


# -----------------------------
# Run server
# -----------------------------
if __name__ == "__main__":
    server = ThreadedHTTPServer(("localhost", 8001), CadmiumHandler)
    print("Cadmium_Builder server running on http://localhost:8001")
    server.serve_forever()