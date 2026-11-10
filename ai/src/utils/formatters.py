"""Module tiện ích chuẩn hóa định dạng hiển thị kết quả tìm kiếm và metric."""
from typing import Optional, Union


def format_percentage(value: Optional[Union[float, int]], decimal_places: int = 2) -> str:
    """
    Chuẩn hóa giá trị tỷ lệ (0.0 đến 1.0) thành chuỗi phần trăm xx.xx%.
    Ví dụ: 0.855 -> '85.50%', 1.0 -> '100.00%', None -> '0.00%'
    """
    if value is None:
        return f"{0.0:.{decimal_places}f}%"
    return f"{float(value) * 100:.{decimal_places}f}%"


def format_score(value: Optional[Union[float, int]], decimal_places: int = 4) -> str:
    """
    Chuẩn hóa điểm tương đồng vector (Cosine similarity) thành chuỗi số thực 0.xxxx.
    Ví dụ: 0.784523 -> '0.7845', None -> '0.0000'
    """
    if value is None:
        return f"{0.0:.{decimal_places}f}"
    return f"{float(value):.{decimal_places}f}"


def format_latency(latency_ms: Optional[Union[float, int]], decimal_places: int = 1) -> str:
    """
    Chuẩn hóa thời gian phản hồi thành chuỗi mili-giây xx.x ms.
    Ví dụ: 25.123 -> '25.1 ms', None -> '0.0 ms'
    """
    if latency_ms is None:
        return f"{0.0:.{decimal_places}f} ms"
    return f"{float(latency_ms):.{decimal_places}f} ms"

