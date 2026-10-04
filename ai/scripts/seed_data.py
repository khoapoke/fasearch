import os
import uuid
import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
from src.core.config import settings

# Cấu hình



QDRANT_HOST = settings["qdrant"]["host"]
QDRANT_PORT = settings["qdrant"]["grpc_port"]
COLLECTION_NAME = settings["qdrant"]["collection_name"]
MODEL_ID = settings["model"]["id"]

# Tự động tính toán đường dẫn tới thư mục /data/raw
# os.path.abspath(__file__) lấy đường dẫn tới file seed_data.py hiện tại
# Gọi os.path.dirname 2 lần sẽ lùi về thư mục gốc của dự án (fashion-search-ai)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DATA_DIR = os.path.join(BASE_DIR, "data", "raw")

def seed_data(batch_size=32):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[*] Thiết bị đang dùng: {device}")
    
    # 1. Khởi tạo Model và DB
    print("[*] Đang load model CLIP lên VRAM...")
    model = CLIPModel.from_pretrained(MODEL_ID).to(device)
    processor = CLIPProcessor.from_pretrained(MODEL_ID)
    client = QdrantClient(host=QDRANT_HOST, grpc_port=QDRANT_PORT, prefer_grpc=True)
    
    # 2. Kiểm tra thư mục dữ liệu
    if not os.path.exists(RAW_DATA_DIR):
        print(f"[!] Lỗi: Không tìm thấy thư mục {RAW_DATA_DIR}. Hãy tạo và bỏ ảnh vào đó.")
        return

    valid_extensions = ('.png', '.jpg', '.jpeg')
    image_paths = [
        os.path.join(RAW_DATA_DIR, f) for f in os.listdir(RAW_DATA_DIR) 
        if f.lower().endswith(valid_extensions)
    ]
    
    total_images = len(image_paths)
    print(f"[*] Tìm thấy {total_images} ảnh thô trong '{RAW_DATA_DIR}'")
    
    if total_images == 0:
        print("[!] Không có dữ liệu để nạp. Kết thúc.")
        return

    # 3. Nạp dữ liệu theo Batch
    for i in range(0, total_images, batch_size):
        batch_paths = image_paths[i:i + batch_size]
        batch_images = []
        
        # Quản lý RAM: Mở và đóng file ngay lập tức
        for p in batch_paths:
            with Image.open(p) as img:
                batch_images.append(img.convert("RGB"))
        
        # Đẩy qua GPU
        inputs = processor(images=batch_images, return_tensors="pt").to(device)
        
        with torch.no_grad():
            features = model.get_image_features(**inputs)
            features = features / features.norm(p=2, dim=-1, keepdim=True)
            vectors = features.cpu().numpy().tolist()
            
        points = []
        for j, vector in enumerate(vectors):
            point_id = str(uuid.uuid4())
            file_name = os.path.basename(batch_paths[j])
            
            points.append(
                PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={
                        "image_path": batch_paths[j], 
                        "file_name": file_name,
                        "catalog": "fashion_product", 
                        "status": "seeded"
                    }
                )
            )
            
        client.upsert(collection_name=COLLECTION_NAME, points=points)
        print(f"  -> Đã nạp batch {i//batch_size + 1}: {len(points)} ảnh")

        # Quản lý VRAM
        del inputs, features, vectors, batch_images, points
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    print("\n[*] HOÀN TẤT NẠP DỮ LIỆU SEEDING!")

if __name__ == "__main__":
    # Giảm batch_size xuống nếu có hiện tượng tràn VRAM
    seed_data(batch_size=32)