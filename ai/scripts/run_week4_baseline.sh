#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON_BIN:-.venv/bin/python}"
export HF_HOME="${HF_HOME:-.cache/huggingface}"
export TOKENIZERS_PARALLELISM=false
export OMP_NUM_THREADS="${OMP_NUM_THREADS:-1}"

"${PYTHON_BIN}" -m ml.retrieval.cli prepare \
  --raw-dir data/raw/dataset_a \
  --output-dir data/processed/catalog-20260908-pilot-v1 \
  --pilot-size 600 \
  --snapshot-version catalog-20260908-pilot-v1

"${PYTHON_BIN}" -m ml.retrieval.cli encode \
  --catalog data/processed/catalog-20260908-pilot-v1/catalog.cleaned.v1.jsonl \
  --output-dir artifacts/embeddings/week4-baseline-20260908-v1 \
  --encoder hf_clip

"${PYTHON_BIN}" -m ml.retrieval.cli build-index \
  --catalog data/processed/catalog-20260908-pilot-v1/catalog.cleaned.v1.jsonl \
  --embeddings-dir artifacts/embeddings/week4-baseline-20260908-v1 \
  --output-dir artifacts/indexes/week4-baseline-20260908-v1

"${PYTHON_BIN}" -m ml.retrieval.cli evaluate \
  --catalog data/processed/catalog-20260908-pilot-v1/catalog.cleaned.v1.jsonl \
  --index-dir artifacts/indexes/week4-baseline-20260908-v1 \
  --queries evaluation/pilot_queries.dataset_a.v1.jsonl \
  --output-dir artifacts/reports/week4-baseline-20260908-v1 \
  --encoder hf_clip

"${PYTHON_BIN}" scripts/verify_week4_artifacts.py
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 "${PYTHON_BIN}" scripts/check_model_stability.py \
  --image data/raw/dataset_a/images/11739.jpg
