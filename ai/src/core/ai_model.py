import torch
from transformers import CLIPProcessor, CLIPModel
from src.core.config import settings
# Các biến toàn cục lưu trữ trạng thái để tái sử dụng (Singleton Pattern)
_model = None
_processor = None
_device = None

MODEL_ID= settings.model.id

def get_ai_model():
    """
    Hàm này được gọi bởi các Service/API.
    Nó kiểm tra nếu model đã nằm trên VRAM thì dùng luôn, không load lại.
    """
    global _model, _processor, _device
    
    # Nếu đã khởi tạo rồi thì chỉ việc trả về
    if _model is not None:
        return _device, _model, _processor
        
    configured_device = settings.model.device.lower()
    if configured_device == "auto":
        _device = "cuda" if torch.cuda.is_available() else "cpu"
    else:
        _device = configured_device
    print(f"[*] Đang nạp mô hình CLIP lên thiết bị: {_device}...")
    
    model_id =MODEL_ID
    _model = CLIPModel.from_pretrained(model_id).to(_device)
    _processor = CLIPProcessor.from_pretrained(model_id)
    
    # Chuyển model sang chế độ đánh giá (Evaluation Mode)
    # Tắt các tính năng update trọng số để tiết kiệm RAM và tăng tốc độ suy luận
    _model.eval()
    
    print("[*] Khởi tạo mô hình AI thành công!")
    return _device, _model, _processor