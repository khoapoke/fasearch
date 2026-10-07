import os
import sys

AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO_ROOT = os.path.dirname(AI_DIR)
TASK_REPO_ROOT = os.environ.get(
    "FASEARCH_TASK_REPO_ROOT",
    "/Users/khoado/Documents/ChatGPT/Graduate Bachelor")

if AI_DIR not in sys.path:
    sys.path.insert(0, AI_DIR)

os.environ.setdefault("FASEARCH_SHADOW_CONFIG",
                      os.path.join(AI_DIR, "configs", "shadow.v1.yaml"))
os.environ.setdefault("HF_HOME",
                      os.path.join(TASK_REPO_ROOT, ".cache/huggingface"))
os.environ.setdefault("HF_HUB_OFFLINE", "1")
