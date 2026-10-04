import os
import yaml

# Tự động tính toán đường dẫn tới configs/database.yaml
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONFIG_PATH = os.path.join(BASE_DIR, "configs", "database.yaml")

def load_config():
    if not os.path.exists(CONFIG_PATH):
        raise FileNotFoundError(f"Không tìm thấy file cấu hình tại {CONFIG_PATH}")
        
    with open(CONFIG_PATH, "r", encoding="utf-8") as file:
        return yaml.safe_load(file)

# Biến global lưu trữ cấu hình để import vào các file khác
settings = load_config()