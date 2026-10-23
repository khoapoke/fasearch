import re
import uuid
from pathlib import Path
from typing import Optional, Tuple
from PIL import Image
from src.core.config import BASE_DIR
from src.db.enums import PointStatus, CatalogCategory


def resolve_image_path(image_path: str) -> Optional[Path]:
    """
    Chuyển đổi đường dẫn web (/dataset/...) thành đường dẫn tuyệt đối trên đĩa để hiển thị.
    Chỉ kiểm tra đường dẫn cụ thể, tuyệt đối KHÔNG quét thư mục nặng.
    """
    if not image_path:
        return None

    # Chuẩn hóa dấu gạch chéo
    clean_path = image_path.replace("\\", "/").lstrip("/")

    # Thử tìm theo BASE_DIR
    target = BASE_DIR / clean_path
    if target.exists() and target.is_file():
        return target

    # Thử tìm trực tiếp nếu là đường dẫn tuyệt đối
    direct_path = Path(image_path)
    if direct_path.exists() and direct_path.is_file():
        return direct_path

    return None


def get_status_badge(status: str) -> str:
    """Tạo badge HTML đẹp mắt cho từng trạng thái PointStatus (an toàn với dữ liệu legacy)."""
    status_upper = (status or "UNKNOWN").upper()
    color_map = {
        PointStatus.ACTIVE.value: ("#059669", "#ecfdf5", "🟢 ACTIVE"),
        PointStatus.SEEDED.value: ("#2563eb", "#eff6ff", "🔵 SEEDED"),
        PointStatus.DELETED.value: ("#dc2626", "#fef2f2", "🔴 DELETED"),
        PointStatus.INACTIVE.value: ("#d97706", "#fffbeb", "🟡 INACTIVE"),
        "PENDING": ("#d97706", "#fffbeb", "🟡 PENDING"),
    }
    border, bg, label = color_map.get(
        status_upper, ("#6b7280", "#f3f4f6", f"⚪ {status_upper}")
    )
    return f"""<span style="
        display: inline-block;
        padding: 2px 8px;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 600;
        color: {border};
        background-color: {bg};
        border: 1px solid {border};
    ">{label}</span>"""


def get_catalog_badge(catalog: str) -> str:
    """Tạo badge HTML cho danh mục sản phẩm CatalogCategory."""
    cat_upper = (catalog or "").upper()
    return f"""<span style="
        display: inline-block;
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 500;
        color: #4b5563;
        background-color: #f3f4f6;
        border: 1px solid #e5e7eb;
    ">🏷️ {cat_upper}</span>"""


def save_admin_uploaded_image(uploaded_file) -> Tuple[str, str, Path]:
    """
    Lưu an toàn ảnh do Admin tải lên vào thư mục dataset/admin/.
    Trả về: (web_path, file_name, file_abs_path)
    """
    admin_dir = BASE_DIR / "dataset" / "admin"
    admin_dir.mkdir(parents=True, exist_ok=True)

    # Làm sạch tên file và thêm prefix UUID để tránh trùng lặp
    safe_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", uploaded_file.name)
    file_name = f"{uuid.uuid4().hex[:8]}_{safe_name}"
    dest_path = admin_dir / file_name

    # Ghi file
    with open(dest_path, "wb") as f:
        f.write(uploaded_file.getbuffer())

    web_path = f"/dataset/admin/{file_name}"
    return web_path, file_name, dest_path
