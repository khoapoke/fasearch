import os
import re
import sys
import uuid
from pathlib import Path
from typing import List, Optional, Tuple, Union
from PIL import Image

from src.core.config import BASE_DIR
from src.db.enums import PointStatus, CatalogCategory
from src.utils import to_system_path


def resolve_image_path(image_path: str) -> Optional[Path]:
    """
    Chuyển đổi đường dẫn web (/dataset/...) thành đường dẫn tuyệt đối trên đĩa để hiển thị.
    Chỉ kiểm tra đường dẫn cụ thể, tuyệt đối KHÔNG quét thư mục nặng.
    """
    if not image_path:
        return None

    path_obj = to_system_path(image_path)
    if path_obj.exists() and path_obj.is_file():
        return path_obj

    return None


def get_status_badge(status: str) -> str:
    """Tạo badge HTML đẹp mắt cho từng trạng thái PointStatus (an toàn với dữ liệu legacy)."""
    status_upper = (status or "UNKNOWN").upper()
    color_map = {
        PointStatus.ACTIVE.value: ("#059669", "#ecfdf5", "ACTIVE"),
        PointStatus.SEEDED.value: ("#2563eb", "#eff6ff", "SEEDED"),
        PointStatus.DELETED.value: ("#dc2626", "#fef2f2", "DELETED"),
        PointStatus.INACTIVE.value: ("#d97706", "#fffbeb", "INACTIVE"),
        "PENDING": ("#d97706", "#fffbeb", "PENDING"),
    }
    border, bg, label = color_map.get(
        status_upper, ("#6b7280", "#f3f4f6", status_upper)
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
    ">{cat_upper}</span>"""


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


def native_dialog_available() -> bool:
    """True nếu máy có thể mở hộp thoại chọn file/thư mục (Windows/macOS, hoặc Linux có DISPLAY và tkinter)."""
    if sys.platform.startswith("linux") and not (os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")):
        return False
    try:
        import tkinter  # noqa: F401
    except Exception:
        return False
    return True


def open_folder_dialog(initial_dir: Optional[Path] = None) -> Optional[str]:
    """
    Mở hộp thoại chọn thư mục chuẩn của Windows (File Explorer).
    Trả về đường dẫn tuyệt đối của thư mục đã chọn, hoặc None nếu người dùng hủy.
    """
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        start_dir = str(initial_dir or BASE_DIR / "dataset")
        folder_selected = filedialog.askdirectory(
            initialdir=start_dir,
            title="Chọn thư mục chứa ảnh để Seed vào Qdrant",
        )
        root.destroy()

        if folder_selected and folder_selected.strip():
            return str(Path(folder_selected).resolve())
        return None
    except Exception:
        return None


def open_csv_file_dialog(initial_dir: Optional[Path] = None) -> Optional[str]:
    """
    Mở hộp thoại chọn file CSV nhãn chuẩn Ground Truth (Windows File Explorer).
    """
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        start_dir = str(initial_dir or BASE_DIR / "dataset")
        file_selected = filedialog.askopenfilename(
            initialdir=start_dir,
            title="Chọn file nhãn Ground Truth (.csv)",
            filetypes=[("CSV Files", "*.csv"), ("All Files", "*.*")],
        )
        root.destroy()

        if file_selected and file_selected.strip():
            return str(Path(file_selected).resolve())
        return None
    except Exception:
        return None


def scan_folder_direct_images(folder_path: Union[str, Path]) -> List[Path]:
    """
    Chỉ quét các file ảnh trực tiếp nằm trong thư mục chỉ định (KHÔNG quét thư mục con).
    """
    p = Path(folder_path).resolve()
    if not p.exists() or not p.is_dir():
        return []

    valid_exts = {".jpg", ".jpeg", ".png", ".webp"}
    images = [f for f in p.iterdir() if f.is_file() and f.suffix.lower() in valid_exts]
    return sorted(images)
