"""Pin only the Catalog task containers; never register other stacks."""
import json
from pathlib import Path
import subprocess
import sys

RECORD = Path("/private/tmp/fasearch-catalog-discovery-containers.identity.json")
EXPECTED = {
    "fasearch-postgres": ("postgres:16-alpine", "5432/tcp", "55732"),
    "fasearch-storage": ("chrislusf/seaweedfs:4.47", "8333/tcp", "38535"),
}


def observe():
    records = {}
    for name, (image, inner, outer) in EXPECTED.items():
        item = json.loads(subprocess.check_output(["docker", "inspect", name]))[0]
        bindings = item["HostConfig"]["PortBindings"]
        if (item["Name"] != "/" + name or item["Config"]["Image"] != image or
            (item["Config"].get("Labels") or {}).get("com.docker.compose.project") != "fasearch" or
            bindings.get(inner) != [{"HostIp": "127.0.0.1", "HostPort": outer}]):
            raise RuntimeError("REFUSE: container task identity/binding mismatch")
        records[name] = {"id": item["Id"], "image_id": item["Image"], "bindings": bindings,
                         "mounts": [{key: mount.get(key) for key in ("Type", "Name", "Source", "Destination")}
                                    for mount in item["Mounts"]]}
    return records


def main():
    observed = observe()
    if sys.argv[1:] == ["adopt"]:
        temp = RECORD.with_suffix(".tmp")
        temp.write_text(json.dumps(observed, indent=2))
        temp.replace(RECORD)
    elif sys.argv[1:] == ["check"]:
        if not RECORD.exists() or json.loads(RECORD.read_text()) != observed:
            raise RuntimeError("REFUSE: missing/changed container ownership record; adopt explicitly")
    else:
        raise SystemExit("usage: container_guard.py adopt|check")
    print("CONTAINER GUARD PASS: exact IDs/images/loopback ports/mounts")


if __name__ == "__main__":
    main()
