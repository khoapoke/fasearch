import os, time, json, sys
os.environ["HF_HOME"]="/Users/khoado/Documents/ChatGPT/Graduate Bachelor/.cache/huggingface"
os.environ["HF_HUB_OFFLINE"]="1"
os.environ["TRANSFORMERS_OFFLINE"]="1"
sys.path.insert(0, "/private/tmp/fasearch-real-pilot-integrated-demo/ai")
import yaml
from pathlib import Path
from ml.retrieval.pipeline import load_engine
t0=time.perf_counter()
config=yaml.safe_load(open("/Users/khoado/Documents/ChatGPT/Graduate Bachelor/ai/configs/baseline.v1.yaml"))
engine=load_engine(config, "hf_clip", Path("/Users/khoado/Documents/ChatGPT/Graduate Bachelor/artifacts/indexes/week4-baseline-20260908-v1"))
t1=time.perf_counter()
print(f"COLD_LOAD_MS={(t1-t0)*1000:.0f}")
print(f"ADAPTER={engine.encoder.manifest['adapter']}")
print(f"MODEL_VERSION={engine.encoder.manifest['model_version']}")
print(f"CONFIG_HASH={engine.encoder.manifest['config_hash']}")
print(f"INDEX_VERSION={engine.index_manifest['index_version']}")
print(f"DIM={engine.encoder.dimension} ROWS={engine.index_manifest['row_count']}")
# token budget
tok=engine.encoder.processor.tokenizer
print(f"TOKEN_BUDGET={tok.model_max_length}")
# quick text encode
r=engine.search_text("red dress", k=2)
print(f"TEXT_OK={len(r['results'])} top={r['results'][0]['product_id']} score={r['results'][0]['similarity_score']:.4f}")
