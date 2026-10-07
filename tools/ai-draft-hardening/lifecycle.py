"""Guarded local lifecycle; no global kills, resets or volume deletion."""
import argparse
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / "tools/ai-draft-hardening/.runtime"
ENV = Path(os.environ.get("FASEARCH_SHADOW_VENV", "/private/tmp/ai-draft-venv"))
ASSETS = Path(os.environ.get("FASEARCH_REPO_ROOT", "/Users/khoado/Documents/ChatGPT/Graduate Bachelor"))
NAME = "fasearch-qdrant"
VOLUME = "ai-draft-hardening-qdrant"
IMAGE = "qdrant/qdrant:v1.12.4@sha256:241edb9d7778327516ef218f8c74e1bd61b5ea42cd4f193cb8d0896199705636"


def command(*args):
    return subprocess.check_output(args, text=True).strip()


def save(name, value):
    RUNTIME.mkdir(parents=True, exist_ok=True)
    path = RUNTIME / name
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, indent=2))
    temporary.replace(path)


def api_identity(pid):
    cmd = command("ps", "-p", str(pid), "-o", "command=")
    if (str(ENV / "bin/python") not in cmd or "-m uvicorn src.main:app" not in cmd or
        "--host 127.0.0.1 --port 18041" not in cmd):
        raise RuntimeError("API command ownership guard refused")
    cwd = command("lsof", "-a", "-p", str(pid), "-d", "cwd", "-Fn")
    if "n" + str((ROOT / "ai").resolve()) not in cwd.splitlines():
        raise RuntimeError("API cwd ownership guard refused")
    listeners = command("lsof", "-tiTCP:18041", "-sTCP:LISTEN").splitlines()
    if listeners != [str(pid)]:
        raise RuntimeError("API listener ownership guard refused")
    return {"pid": pid, "started": command("ps", "-p", str(pid), "-o", "lstart="),
            "command": cmd, "cwd": str(ROOT / "ai")}


def stop_api():
    path = RUNTIME / "api.json"
    if not path.exists():
        raise RuntimeError("No PID ownership record; use verified adopt-api first")
    record = json.loads(path.read_text())
    observed = api_identity(record["pid"])
    if observed != record:
        raise RuntimeError("API PID identity changed; refused")
    os.kill(record["pid"], signal.SIGTERM)
    for _ in range(60):
        if subprocess.run(["kill", "-0", str(record["pid"])], capture_output=True).returncode:
            path.unlink()
            print("API STOPPED", record["pid"])
            return
        time.sleep(.5)
    raise RuntimeError("Graceful stop still draining workers; no force kill")


def start_api():
    if subprocess.run(["lsof", "-tiTCP:18041", "-sTCP:LISTEN"], capture_output=True).returncode == 0:
        raise RuntimeError("API port occupied; refused duplicate start")
    if command(str(ENV / "bin/python"), "-c", "import sys;print(sys.version_info[:2])") != "(3, 12)":
        raise RuntimeError("Python3.12 required")
    RUNTIME.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, FASEARCH_REPO_ROOT=str(ASSETS), HF_HOME=str(ASSETS / ".cache/huggingface"),
               HF_HUB_OFFLINE="1", PYTHONPATH=str(ROOT / "ai"))
    with open(RUNTIME / "api.log", "ab") as log:
        process = subprocess.Popen([str(ENV / "bin/python"), "-m", "uvicorn", "src.main:app",
            "--host", "127.0.0.1", "--port", "18041"], cwd=ROOT / "ai", env=env,
            stdout=log, stderr=log, start_new_session=True)
    # Record startup PID immediately; only verified identity may be stopped later.
    save("api-starting.json", {"pid": process.pid})
    for _ in range(120):
        if process.poll() is not None:
            raise RuntimeError("API startup failed; inspect .runtime/api.log")
        try:
            with urllib.request.urlopen("http://127.0.0.1:18041/health", timeout=1) as response:
                if response.status == 200:
                    save("api.json", api_identity(process.pid))
                    (RUNTIME / "api-starting.json").unlink()
                    print("API STARTED", process.pid)
                    return
        except OSError:
            pass
        time.sleep(.5)
    raise RuntimeError("API startup pending; do not duplicate start")


def container_identity():
    item = json.loads(command("docker", "inspect", NAME))[0]
    bindings = item["HostConfig"]["PortBindings"]
    if (item["Name"] != "/" + NAME or item["Image"] != IMAGE.split("@")[1] or
        item["Config"]["Image"] not in (IMAGE, "qdrant/qdrant:v1.12.4")):
        raise RuntimeError("Container name/image guard refused")
    volumes = [m for m in item["Mounts"] if m["Destination"] == "/qdrant/storage"]
    if len(volumes) != 1 or volumes[0].get("Name") != VOLUME:
        raise RuntimeError("Container storage ownership guard refused")
    for inside, outside in (("6333/tcp", "16333"), ("6334/tcp", "16334")):
        if len(bindings.get(inside, [])) != 1 or bindings[inside][0]["HostPort"] != outside:
            raise RuntimeError("Container task-port guard refused")
    if (item["Config"].get("Labels") or {}).get("com.docker.compose.project") != "fasearch":
        raise RuntimeError("Container Compose project guard refused")
    return {"id": item["Id"], "image": item["Config"]["Image"], "volume": VOLUME,
            "bindings": bindings}


def guarded_container():
    record = json.loads((RUNTIME / "container.json").read_text())
    if container_identity() != record:
        raise RuntimeError("Container identity changed; refused")
    return record


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["adopt-api", "api-start", "api-stop", "api-restart",
        "adopt-qdrant", "qdrant-stop", "qdrant-start", "qdrant-loopback", "status"])
    parser.add_argument("--pid", type=int)
    args = parser.parse_args()
    if args.action == "adopt-api":
        save("api.json", api_identity(args.pid)); print("API ADOPTED", args.pid)
    elif args.action == "adopt-qdrant":
        save("container.json", container_identity()); print("CONTAINER ADOPTED", NAME)
    elif args.action in ("api-stop", "api-restart"):
        stop_api()
        if args.action == "api-restart": start_api()
    elif args.action == "api-start": start_api()
    elif args.action == "qdrant-stop":
        record = guarded_container(); command("docker", "stop", record["id"])
        print("QDRANT STOPPED", record["id"])
    elif args.action == "qdrant-start":
        record = guarded_container(); command("docker", "start", record["id"])
        print("QDRANT STARTED", record["id"])
    elif args.action == "qdrant-loopback":
        record = guarded_container()
        command("docker", "stop", record["id"])
        command("docker", "rm", record["id"])  # Retains the named volume.
        command("docker", "compose", "--profile", "shadow", "-f", str(ROOT / "ai/docker-compose.shadow.yml"), "up", "-d", "qdrant")
        observed = container_identity()
        if any(v[0]["HostIp"] != "127.0.0.1" for v in observed["bindings"].values()):
            raise RuntimeError("Qdrant loopback verification failed")
        save("container.json", observed); print("QDRANT LOOPBACK PASS", observed["id"])
    else:
        print(json.dumps({"api": api_identity(json.loads((RUNTIME / "api.json").read_text())["pid"]),
                          "qdrant": guarded_container()}, indent=2))


if __name__ == "__main__":
    main()
