from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


DATASETS = {
    "small": "paramaggarwal/fashion-product-images-small",
    "full": "paramaggarwal/fashion-product-images-dataset",
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Download immutable Dataset A snapshot from Kaggle")
    parser.add_argument("--variant", choices=DATASETS, default="small")
    parser.add_argument("--output-dir", default="data/raw/dataset_a")
    args = parser.parse_args()
    output = Path(args.output_dir).resolve()
    existing = [path for path in output.rglob("*") if path.is_file()] if output.exists() else []
    if existing:
        raise SystemExit(
            f"Refusing to modify non-empty raw snapshot {output}. Move it aside or choose a new directory."
        )
    output.mkdir(parents=True, exist_ok=True)
    environment = os.environ.copy()
    environment.setdefault("KAGGLE_CONFIG_DIR", str(Path(".kaggle").resolve()))
    kaggle_cli = Path(sys.executable).with_name("kaggle")
    if not kaggle_cli.exists():
        raise SystemExit("Kaggle CLI is unavailable. Install requirements.lock first.")
    subprocess.run(
        [str(kaggle_cli), "datasets", "download", "-d", DATASETS[args.variant], "--unzip", "-p", str(output)],
        check=True,
        env=environment,
    )
    print(f"Downloaded {DATASETS[args.variant]} to immutable raw snapshot: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
