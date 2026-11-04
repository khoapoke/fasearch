"""Ngoại lệ nghiệp vụ dùng chung cho Service -> API.

Service ném các ngoại lệ này khi đầu vào không hợp lệ; tầng API chuyển thành HTTP 400
(thay vì để rơi vào handler 500 chung).
"""


class InvalidInputError(ValueError):
    """Đầu vào của người dùng không hợp lệ (query rỗng, ảnh hỏng, limit sai, ...)."""

