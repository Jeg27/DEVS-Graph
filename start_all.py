import subprocess
import sys
import os
import platform

# -----------------------------
# Base directory (repo root)
# -----------------------------
REPO_ROOT = os.path.dirname(os.path.abspath(__file__))

processes = []

# -----------------------------
# Build Oracle binary if needed
# -----------------------------
oracle_dir = os.path.join(REPO_ROOT, "Oracle")
oracle_binary = "oracle_runner.exe" if platform.system() == "Windows" else "oracle_runner"
oracle_binary_path = os.path.join(oracle_dir, oracle_binary)

if not os.path.exists(oracle_binary_path):
    print("Oracle binary not found. Building it now...")

    cpp_files = [
        "oracle_runner.cpp",
        "parse_output.cpp",
        "read_logs.cpp",
        "validator.cpp"
    ]

    compile_cmd = ["g++", "-std=c++17", *cpp_files, "-o", oracle_binary]

    result = subprocess.run(
        compile_cmd,
        cwd=oracle_dir,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        print("Failed to build Oracle binary.")
        print(result.stderr)
        sys.exit(1)

    print("Oracle binary built successfully.")


# -----------------------------
# Start Python server 1 (Parser)
# -----------------------------
server1_module = "DEVSMap_to_Cadmium_Parser.server"
processes.append(subprocess.Popen(
    [sys.executable, "-m", server1_module],
    cwd=REPO_ROOT  # MUST be repo root for module imports
))

# -----------------------------
# Start Python server 2 (Cadmium_Builder)
# -----------------------------
server2_module = "Cadmium_Builder.server"
processes.append(subprocess.Popen(
    [sys.executable, "-m", server2_module],
    cwd=REPO_ROOT  # MUST be repo root for module imports
))


# -----------------------------
# Start Oracle server
# -----------------------------
oracle_dir = os.path.join(REPO_ROOT, "Oracle")

processes.append(subprocess.Popen(
    [sys.executable, "oracle_server.py"],
    cwd=oracle_dir
))


# -----------------------------
# Start GUI server (Python HTTP server)
# -----------------------------
gui_dir = os.path.join(REPO_ROOT, "GUI")  # your GUI folder
gui_port = "5500"

processes.append(subprocess.Popen(
    [sys.executable, "-m", "http.server", gui_port],
    cwd=gui_dir
))

# -----------------------------
# Print info
# -----------------------------
print("All servers started:")
print(f"- Parser server running")
print(f"- Cadmium_Builder server running")
print(f"- GUI server running at http://localhost:{gui_port}")
print("Press Ctrl+C to stop all servers.")

# -----------------------------
# Wait for processes / handle Ctrl+C
# -----------------------------
try:
    for p in processes:
        p.wait()
except KeyboardInterrupt:
    print("Shutting down servers...")
    for p in processes:
        p.terminate()


