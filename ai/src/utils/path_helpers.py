import re
from pathlib import Path
from typing import Optional, Union

from src.core.config import BASE_DIR

# Regex nhận diện các protocol hợp lệ (không nhầm với ổ đĩa Windows C:, D:)
URL_PROTOCOL_REGEX = re.compile(r"^(https?|ftp|file)://", re.IGNORECASE)
WINDOWS_DRIVE_REGEX = re.compile(r"^([a-zA-Z]:)[/\\]+", re.IGNORECASE)


def normalize_slash(path: Optional[Union[str, Path]]) -> str:
    """
    Chuẩn hóa toàn bộ dấu gạch chéo sang dấu gạch xuôi '/' (Posix style):
    - Đổi tất cả '\\' thành '/'.
    - Giữ chuẩn ổ đĩa Windows (ví dụ: 'D:\\\\' hoặc 'D:\\' -> 'D:/').
    - Loại bỏ các dấu gạch chéo bị trùng lặp (ví dụ: '///' -> '/').
    - Giữ nguyên URL protocol (http://, https://, file://).
    - Cắt bỏ khoảng trắng thừa đầu cuối.
    """
    if path is None:
        return ""

    raw_str = str(path).strip()
    if not raw_str:
        return ""

    # 1. Chuyển đổi mọi dấu backslash thành forward slash
    normalized = raw_str.replace("\\", "/")

    # 2. Xử lý trường hợp URL (http://, https://, file://)
    proto_match = URL_PROTOCOL_REGEX.match(normalized)
    if proto_match:
        proto = proto_match.group(0)
        rest = normalized[len(proto):]
        rest_cleaned = re.sub(r"/+", "/", rest)
        return f"{proto}{rest_cleaned}"

    # 3. Xử lý trường hợp ổ đĩa Windows (ví dụ: C:// -> C:/)
    drive_match = WINDOWS_DRIVE_REGEX.match(normalized)
    if drive_match:
        drive_letter = drive_match.group(1).upper()
        rest = normalized[drive_match.end():]
        rest_cleaned = re.sub(r"/+", "/", rest)
        return f"{drive_letter}/{rest_cleaned}"

    # 4. Các đường dẫn thông thường khác (xóa lặp dấu '/')
    return re.sub(r"/+", "/", normalized)


def to_web_path(
    path: Optional[Union[str, Path]],
    base_dir: Optional[Union[str, Path]] = BASE_DIR,
) -> str:
    """
    Chuyển đổi một đường dẫn (tuyệt đối hoặc tương đối) thành đường dẫn Web URL chuẩn (/...):
    - Luôn bắt đầu bằng dấu '/'.
    - Luôn dùng dấu gạch xuôi '/'.
    - Tự động trừu tượng hóa tương đối theo thư mục gốc dự án (BASE_DIR).

    Ví dụ:
        'D:\\fasearch\\ai\\dataset\\test\\15970.jpg' -> '/dataset/test/15970.jpg'
        'dataset/test/15970.jpg'                    -> '/dataset/test/15970.jpg'
    """
    if not path:
        return ""

    normalized = normalize_slash(path)
    base_norm = normalize_slash(base_dir).rstrip("/")

    # Nếu là đường dẫn tuyệt đối chứa base_dir thì cắt bỏ phần base
    if base_norm and normalized.lower().startswith(base_norm.lower()):
        rel = normalized[len(base_norm):].lstrip("/")
        return f"/{rel}"

    # Đảm bảo có dấu gạch chéo ở đầu cho web path
    clean = normalized.lstrip("/")
    return f"/{clean}"


def to_system_path(
    path: Optional[Union[str, Path]],
    base_dir: Optional[Union[str, Path]] = BASE_DIR,
) -> Path:
    """
    Chuyển đổi an toàn đường dẫn Web hoặc tương đối thành đối tượng Path trên đĩa cứng:
    - Nhận cả: '/dataset/test/1.jpg', 'dataset\\test\\1.jpg', 'D:/...'
    - Trả về đối tượng pathlib.Path tuyệt đối chuẩn của hệ điều hành (Windows / Linux).

    Ví dụ:
        '/dataset/test/15970.jpg' -> Path('D:/fasearch/ai/dataset/test/15970.jpg')
    """
    if not path:
        return Path(base_dir or BASE_DIR).resolve()

    clean_str = normalize_slash(path).strip()
    path_obj = Path(clean_str)

    # Nếu đã là đường dẫn tuyệt đối trên đĩa và tồn tại (ví dụ: 'D:/...' hoặc '/root/...')
    if path_obj.is_absolute() and path_obj.exists():
        return path_obj.resolve()

    # Bỏ dấu '/' ở đầu nếu có để ghép vào base_dir
    rel_clean = clean_str.lstrip("/")
    resolved_base = Path(base_dir or BASE_DIR).resolve()
    return (resolved_base / rel_clean).resolve()


def safe_join(*paths: Optional[Union[str, Path]]) -> str:
    """
    Nối các thành phần đường dẫn an toàn và tự động chuẩn hóa dấu '/':

    Ví dụ:
        safe_join("D:\\fasearch\\ai", "dataset", "test/images", "15970.jpg")
        -> "D:/fasearch/ai/dataset/test/images/15970.jpg"
    """
    cleaned_parts = [
        normalize_slash(p).strip("/")
        for p in paths
        if p and normalize_slash(p).strip("/")
    ]
    if not cleaned_parts:
        return ""

    first_part = normalize_slash(paths[0])
    is_root = first_part.startswith("/")
    has_drive = bool(re.match(r"^[a-zA-Z]:", first_part))

    joined = "/".join(cleaned_parts)

    if has_drive:
        return joined
    if is_root:
        return f"/{joined}"
    return joined
