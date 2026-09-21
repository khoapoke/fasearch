# Week 4 baseline runbook v1

## Local CPU bootstrap

Requirements: macOS/Linux, Python 3.12 and enough disk for the 565 MB archive plus extracted files/model cache. Model weights, raw data and generated indexes stay outside Git.

```bash
cd "/Users/khoado/Documents/ChatGPT/Graduate Bachelor"
/Users/khoado/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock
```

Download Dataset A small. Public download worked anonymously on 08/09/2026; if Kaggle later requires authentication, place `kaggle.json` in `.kaggle/` or set `KAGGLE_USERNAME`/`KAGGLE_KEY` locally. Never commit it.

```bash
.venv/bin/python scripts/download_dataset_a.py --variant small --output-dir data/raw/dataset_a
```

Run the reproducible pipeline:

```bash
./scripts/run_week4_baseline.sh
```

The script performs, in order: catalog audit/cleaning, frozen CLIP image encoding, exact FAISS index build, 24-query pilot evaluation and provenance verification.

The real run uses one bundle ID, `week4-baseline-20260908-v1`, under `ai/artifacts/embeddings/`, `ai/artifacts/indexes/` and `ai/artifacts/reports/`. Its catalog snapshot is `catalog-20260908-pilot-v1`. The commit-safe checksum summary is `ai/data/manifests/week4-baseline-20260908-v1.json`.

## Offline CPU smoke test

This path needs no Kaggle data or model checkpoint. It uses a 30-product generated fixture and a deterministic test-only encoder; it validates plumbing, never model quality.

```bash
./scripts/run_cpu_smoke.sh
```

Expected result: 14 tests pass, smoke status `PASS`, three search modes execute and all output is marked `scientific_claim_allowed: false`.

## Individual commands

```bash
.venv/bin/python -m ml.retrieval.cli prepare --pilot-size 600
.venv/bin/python -m ml.retrieval.cli encode --encoder hf_clip
.venv/bin/python -m ml.retrieval.cli build-index
.venv/bin/python -m ml.retrieval.cli search --encoder hf_clip --mode text --text "áo đỏ mặc mùa hè"
.venv/bin/python -m ml.retrieval.cli evaluate --encoder hf_clip --queries evaluation/pilot_queries.dataset_a.v1.jsonl
.venv/bin/python scripts/verify_week4_artifacts.py
```

For image search, pass `--image /absolute/path/to/image.jpg`. For composed search, pass both `--image` and `--text`. Add `--exclude-product-id ID` when the query image is drawn from the indexed catalog.

## Colab T4

Colab is a reproducible training/inference environment, not a production server.

1. Select a T4 runtime and copy/clone the repository into `/content/Graduate Bachelor`.
2. Put Dataset A under `ai/data/raw/dataset_a/`, or add Kaggle credentials through Colab Secrets and run the downloader. Do not write a token into notebook cells.
3. Install `ai/requirements.lock`; record the resolved environment with `python -m pip freeze`.
4. Set the pinned runtime overrides before encoding:

```bash
export FASHION_SEARCH_DEVICE=cuda
export FASHION_SEARCH_PRECISION=float16
export HF_HOME=/content/hf-cache
export TOKENIZERS_PARALLELISM=false
```

5. Run `./scripts/run_week4_baseline.sh` and download only manifests/reports/index artifacts needed for review. Do not add raw data or model weights to Git.

The same core package is used locally and on Colab. The only intended differences are `device=cuda` and `precision=float16`, both recorded in the model manifest and therefore produce a distinct model/index config version. Never reuse the CPU index manifest as if it came from the T4 configuration.

## macOS OpenMP note

PyTorch 2.4.1 and FAISS 1.8.0.post1 can load incompatible OpenMP runtimes in one macOS process. Production CLIP search therefore invokes FAISS lookup in a separate worker process. This preserves the exact vectors and `IndexFlatIP` index and avoids the unsafe `KMP_DUPLICATE_LIB_OK` workaround. Linux/Colab can later use an optional persistent worker for lower latency without changing retrieval semantics.
