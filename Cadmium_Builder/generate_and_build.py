import json
import subprocess
import re
import platform
from pathlib import Path


def build_cadmium(code):
    """
    Build and run the Cadmium simulation.
    Works on Windows (via WSL), Linux, and macOS.
    """
    print("ENTERED build_cadmium")
    files_dict = code if isinstance(code, dict) else json.loads(code)

    BASE_DIR = Path(__file__).resolve().parent / "cadmium_project"
    main_dir = BASE_DIR / "main"
    include_dir = main_dir / "include"

    print("BASE_DIR =", BASE_DIR)
    print("main_dir =", main_dir)
    print("include_dir =", include_dir)

    # -----------------------------
    # CLEAN OLD FILES
    # -----------------------------

    # Delete main.cpp
    main_cpp = main_dir / "main.cpp"
    if main_cpp.exists():
        print("Deleting:", main_cpp)
        main_cpp.unlink()
    else:
        print("main.cpp not found")

    # Delete all .hpp files inside main/include recursively
    if include_dir.exists():
        for file in include_dir.rglob("*.hpp"):
            try:
                print("Deleting:", file)
                file.unlink()
            except Exception as e:
                print("Failed to delete:", file, e)
    else:
        print("include_dir does not exist")

    # -----------------------------
    # WRITE NEW FILES
    # -----------------------------
    for key, value in files_dict.items():
        if key == "main.cpp":
            file_path = main_dir / key
        else:
            file_path = include_dir / key

        file_path.parent.mkdir(parents=True, exist_ok=True)

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(value)

        print("Wrote file:", file_path)

    # -----------------------------
    # Detect and delete old executable if it exists
    # -----------------------------
    exe_path = BASE_DIR / "bin" / "Executable1"
    if exe_path.exists():
        print("Deleting old executable:", exe_path)
        exe_path.unlink()

    # -----------------------------
    # Build and run commands
    # -----------------------------
    csv_path = BASE_DIR / "experiment_log.csv"
    if csv_path.exists():
        print("Deleting old CSV:", csv_path)
        csv_path.unlink()

    build_cmd = ". ./build_sim.sh"
    run_cmd = "./bin/Executable1"
    full_cmd = f"{build_cmd} && {run_cmd}"

    system = platform.system()

    if system == "Windows":
        result = subprocess.run(
            ["wsl", "bash", "-c", full_cmd],
            cwd=BASE_DIR,
            capture_output=True,
            text=True
        )
    else:
        result = subprocess.run(
            full_cmd,
            cwd=BASE_DIR,
            shell=True,
            capture_output=True,
            text=True
        )

    output = result.stdout
    errors = result.stderr

    # Clean stdout for diagnostics only
    regex = re.compile(r'\x1B\[[0-?]*[ -/]*[@-~]')
    clean_output = regex.sub('', output)

    prefixes = ["--", "[", "Compilation"]
    clean_output = "\n".join(
        line for line in clean_output.splitlines()
        if not any(line.startswith(p) for p in prefixes)
    )

    print("Output:\n", clean_output)
    print("Errors:\n", errors)

    if result.returncode != 0:
        return (
            "Build/run failed.\n\n"
            f"STDOUT:\n{clean_output}\n\n"
            f"STDERR:\n{errors}"
        )

    # Read the CSV after a successful run
    csv_path = BASE_DIR / "experiment_log.csv"

    if csv_path.exists():
        return csv_path.read_text(encoding="utf-8")

    return (
        "Simulation completed, but experiment_log.csv was not found.\n\n"
        f"STDOUT:\n{clean_output}\n\n"
        f"STDERR:\n{errors}"
    )
