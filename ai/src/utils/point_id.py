"""Chuẩn hóa ID của Qdrant Point: hỗ trợ cả ID số (product_id của BE) và UUID."""

import re
import uuid
from typing import Union

from src.core.exceptions import InvalidInputError

PointId = Union[int, str]

_DIGITS_REGEX = re.compile(r"^\d{1,18}$")


def normalize_point_id(point_id: PointId) -> PointId:
    """
    Trả về ID hợp lệ cho Qdrant:
    - int hoặc chuỗi toàn chữ số ("806") -> int (ID số, khớp product_id của Backend).
    - UUID hợp lệ -> chuỗi UUID chuẩn.
    - Giá trị khác -> InvalidInputError.
    """
    if isinstance(point_id, bool):
        raise InvalidInputError("point_id phải là số nguyên không âm hoặc UUID")
    if isinstance(point_id, int):
        if point_id < 0:
            raise InvalidInputError("point_id phải là số nguyên không âm hoặc UUID")
        return point_id
    text = str(point_id).strip()
    if _DIGITS_REGEX.match(text):
        return int(text)
    try:
        return str(uuid.UUID(text))
    except (ValueError, AttributeError):
        raise InvalidInputError("point_id phải là số nguyên không âm hoặc UUID")
