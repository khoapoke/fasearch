from enum import StrEnum


class PointStatus(StrEnum):
    """Trạng thái của bản ghi vector point trong Qdrant."""
    SEEDED = "SEEDED"
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    DELETED = "DELETED"


class CatalogCategory(StrEnum):
    """Phân loại danh mục sản phẩm thời trang trong Qdrant."""
    FASHION_PRODUCT = "FASHION_PRODUCT"
    TOPWEAR = "TOPWEAR"
    BOTTOMWEAR = "BOTTOMWEAR"
    FOOTWEAR = "FOOTWEAR"
