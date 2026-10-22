import os
from typing import Any, Dict
import yaml
from pydantic import BaseModel, Field
from pathlib import Path

# Đường dẫn thư mục gốc dự án
BASE_DIR = Path(__file__).resolve().parents[2]  # 0 -> lấy thư mục chứa file , có thể lùi thêm nữa 
ENV_PATH = os.path.join(BASE_DIR, ".env")
CONFIG_PATH = os.path.join(BASE_DIR, "configs", "database.yaml")


def load_env_file(path: str) -> None:
    """Nạp file .env vào os.environ nếu biến chưa tồn tại."""
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip("'\"")
            if key not in os.environ:
                os.environ[key] = val


# Nạp biến môi trường từ .env
load_env_file(ENV_PATH)


class ConfigSection(BaseModel):
    """Lớp nền hỗ trợ cả 2 cách truy cập: Object attr (settings.key) và Dict index (settings['key'])."""
    def __getitem__(self, key: str) -> Any:
        try:
            return getattr(self, key)
        except AttributeError:
            raise KeyError(key)

    def get(self, key: str, default: Any = None) -> Any:
        return getattr(self, key, default)

    def __contains__(self, key: str) -> bool:
        return hasattr(self, key)


class QdrantConfig(ConfigSection):
    host: str = Field(default_factory=lambda: os.getenv("QDRANT_HOST", "localhost"))
    grpc_port: int = Field(default_factory=lambda: int(os.getenv("QDRANT_GRPC_PORT", 6334)))
    http_port: int = Field(default_factory=lambda: int(os.getenv("QDRANT_HTTP_PORT", 6333)))
    prefer_grpc: bool = Field(
        default_factory=lambda: os.getenv("QDRANT_PREFER_GRPC", "true").lower() in ("true", "1", "yes")
    )

    # setup các giá trị mặc định cho collection, vector, và độ do khoảng cách
    collection_name: str = "image_gallery"
    vector_size: int = 512
    distance: str = "Cosine"


class ModelConfig(ConfigSection):
    # setup giá trị mặc định cho model sử dụng s
    id: str = "openai/clip-vit-base-patch32"
    device: str = Field(default_factory=lambda: os.getenv("DEVICE", "auto"))


class AppConfig(ConfigSection):
    upload_dir: str = Field(default_factory=lambda: os.getenv("UPLOAD_DIR", "storage/uploads"))
    raw_data_dir: str = Field(default_factory=lambda: os.getenv("RAW_DATA_DIR", "dataset"))
    max_search_limit: int = Field(default_factory=lambda: int(os.getenv("MAX_SEARCH_LIMIT", 5)))
    vector_size: int = 512


class AppSettings(ConfigSection):
    qdrant: QdrantConfig = Field(default_factory=QdrantConfig)
    model: ModelConfig = Field(default_factory=ModelConfig)
    app: AppConfig = Field(default_factory=AppConfig)


def load_settings() -> AppSettings:
    """Nạp cấu hình: Kết hợp giữa YAML (nghiệp vụ bất biến) và .env (môi trường)."""
    yaml_data: Dict[str, Any] = {}
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as file:
            loaded = yaml.safe_load(file)
            if loaded and isinstance(loaded, dict):
                yaml_data = loaded

    # Khởi tạo cấu hình từ .env
    qdrant_cfg = QdrantConfig()
    model_cfg = ModelConfig()
    app_cfg = AppConfig()

    # Nạp các giá trị bất biến từ YAML
    if "qdrant" in yaml_data and isinstance(yaml_data["qdrant"], dict):
        if "collection_name" in yaml_data["qdrant"]:
            qdrant_cfg.collection_name = str(yaml_data["qdrant"]["collection_name"])
        if "vector_size" in yaml_data["qdrant"]:
            v_size = int(yaml_data["qdrant"]["vector_size"])
            qdrant_cfg.vector_size = v_size
            app_cfg.vector_size = v_size
        if "distance" in yaml_data["qdrant"]:
            qdrant_cfg.distance = str(yaml_data["qdrant"]["distance"])

    if "model" in yaml_data and isinstance(yaml_data["model"], dict):
        if "id" in yaml_data["model"]:
            model_cfg.id = str(yaml_data["model"]["id"])

    return AppSettings(qdrant=qdrant_cfg, model=model_cfg, app=app_cfg)


# Biến toàn cục lưu cấu hình cho toàn hệ thống
settings = load_settings()