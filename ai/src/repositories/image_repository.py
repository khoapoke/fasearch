import logging
from typing import Any, Dict, List, Optional, Union
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointIdsList,
    PointStruct,
    Record,
    ScoredPoint,
    VectorParams,
)

from src.core.config import settings
from src.core.qdrant_client import get_qdrant_client
from src.db.enums import PointStatus
from src.db.models import ImagePointPayload
from src.utils.point_id import PointId, normalize_point_id
from src.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class ImageRepository(BaseRepository):
    """
    Repository phụ trách lưu trữ, truy vấn và quản lý vòng đời của Point
    trong một collection cụ thể trên Qdrant.
    """

    def __init__(
        self,
        collection_name: Optional[str] = None,
        client: Optional[QdrantClient] = None,
    ) -> None:
        target_collection = collection_name or settings.qdrant.collection_name
        super().__init__(collection_name=target_collection, client=client)

    def ensure_collection_exists(self) -> bool:
        """Kiểm tra và tự động khởi tạo collection nếu chưa tồn tại trên Qdrant."""
        if not self.client.collection_exists(self.collection_name):
            distance_choice = Distance.COSINE
            if settings.qdrant.distance.lower() == "euclid":
                distance_choice = Distance.EUCLID
            elif settings.qdrant.distance.lower() == "dot":
                distance_choice = Distance.DOT

            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(
                    size=settings.qdrant.vector_size,
                    distance=distance_choice,
                ),
            )
            logger.info(f"Đã tự động khởi tạo collection mới '{self.collection_name}' trên Qdrant.")
            return True
        return False

    def search_vectors(
        self,
        query_vector: List[float],
        limit: int = 5,
        score_threshold: Optional[float] = None,
        exclude_deleted: bool = True,
        extra_filter: Optional[Filter] = None,
    ) -> List[ScoredPoint]:
        """Tìm kiếm cosine vector tương đồng trong collection."""
        conditions = []
        if exclude_deleted:
            conditions.append(
                FieldCondition(
                    key="status",
                    match=MatchValue(value=PointStatus.DELETED.value),
                )
            )

        query_filter = extra_filter
        if conditions:
            if query_filter is None:
                query_filter = Filter(must_not=conditions)
            else:
                if query_filter.must_not is None:
                    query_filter.must_not = conditions
                else:
                    query_filter.must_not.extend(conditions)

        results = self.client.search(
            collection_name=self.collection_name,
            query_vector=query_vector,
            query_filter=query_filter,
            limit=limit,
            score_threshold=score_threshold,
            with_payload=True,
            with_vectors=False,
        )
        return results

    def get_by_id(self, point_id: PointId) -> Optional[Record]:
        """Lấy thông tin chi tiết một point theo ID (số hoặc UUID)."""
        records = self.client.retrieve(
            collection_name=self.collection_name,
            ids=[normalize_point_id(point_id)],
            with_payload=True,
            with_vectors=False,
        )
        if records:
            return records[0]
        return None

    def create(
        self,
        point_id: PointId,
        vector: List[float],
        payload: Union[ImagePointPayload, Dict[str, Any]],
    ) -> bool:
        """Tạo mới hoặc ghi đè một Vector Point vào Qdrant."""
        payload_dict = (
            payload.to_payload_dict()
            if isinstance(payload, ImagePointPayload)
            else payload
        )
        self.client.upsert(
            collection_name=self.collection_name,
            points=[
                PointStruct(
                    id=normalize_point_id(point_id),
                    vector=vector,
                    payload=payload_dict,
                )
            ],
        )
        return True

    def upsert_batch(self, points: List[PointStruct]) -> int:
        """Nạp dữ liệu hàng loạt theo batch vào Qdrant."""
        if not points:
            return 0
        self.client.upsert(
            collection_name=self.collection_name,
            points=points,
        )
        return len(points)

    def update_payload(
        self,
        point_id: PointId,
        payload: Union[ImagePointPayload, Dict[str, Any]],
    ) -> bool:
        """Cập nhật các trường payload cho một point cụ thể."""
        payload_dict = (
            payload.to_payload_dict()
            if isinstance(payload, ImagePointPayload)
            else payload
        )
        self.client.set_payload(
            collection_name=self.collection_name,
            payload=payload_dict,
            points=[normalize_point_id(point_id)],
        )
        return True

    def soft_delete(self, point_id: PointId) -> bool:
        """Xóa mềm point bằng cách cập nhật status = DELETED."""
        return self.update_payload(
            point_id=point_id,
            payload={"status": PointStatus.DELETED.value},
        )

    def hard_delete(self, point_id: PointId) -> bool:
        """Xóa cứng: Loại bỏ hoàn toàn vector và payload của point khỏi collection."""
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=PointIdsList(points=[normalize_point_id(point_id)]),
        )
        return True

    def count_points(self, filter_status: Optional[PointStatus] = None) -> int:
        """Đếm tổng số point trong collection. Có thể lọc theo PointStatus."""
        query_filter = None
        if filter_status is not None:
            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="status",
                        match=MatchValue(value=filter_status.value),
                    )
                ]
            )
        res = self.client.count(
            collection_name=self.collection_name,
            count_filter=query_filter,
            exact=True,
        )
        return res.count

    def scroll_points(
        self,
        limit: int = 20,
        offset: Optional[Union[str, int]] = None,
        filter_status: Optional[PointStatus] = None,
        with_payload: bool = True,
    ) -> tuple[List[Record], Optional[Union[str, int]]]:
        """Phân trang duyệt danh sách Point từ Qdrant."""
        query_filter = None
        if filter_status is not None:
            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="status",
                        match=MatchValue(value=filter_status.value),
                    )
                ]
            )
        records, next_offset = self.client.scroll(
            collection_name=self.collection_name,
            limit=limit,
            offset=offset,
            scroll_filter=query_filter,
            with_payload=with_payload,
            with_vectors=False,
        )
        return records, next_offset

    def list_indexed_file_names(self, exclude_deleted: bool = True) -> set:
        """Tập tên file (file_name) của các point đang có trong collection (mặc định bỏ qua DELETED)."""
        names = set()
        offset = None
        query_filter = None
        if exclude_deleted:
            query_filter = Filter(
                must_not=[
                    FieldCondition(key="status", match=MatchValue(value=PointStatus.DELETED.value))
                ]
            )
        while True:
            records, offset = self.client.scroll(
                collection_name=self.collection_name,
                limit=512,
                offset=offset,
                scroll_filter=query_filter,
                with_payload=["file_name"],
                with_vectors=False,
            )
            for rec in records:
                name = (rec.payload or {}).get("file_name")
                if name:
                    names.add(str(name))
            if offset is None:
                break
        return names

    def get_collection_info(self) -> Dict[str, Any]:
        """Lấy thông tin tổng quan của collection: trạng thái, số lượng point, v.v."""
        try:
            info = self.client.get_collection(collection_name=self.collection_name)
            return {
                "status": str(info.status),
                "vectors_count": getattr(info, "vectors_count", None),
                "points_count": getattr(info, "points_count", 0),
            }
        except Exception as e:
            logger.warning(f"Không thể lấy collection info: {e}")
            return {}

    def reset_collection(self) -> bool:
        """Xóa sạch dữ liệu trong collection hiện tại và tạo lại collection rỗng."""
        if self.client.collection_exists(self.collection_name):
            self.client.delete_collection(collection_name=self.collection_name)

        distance_choice = Distance.COSINE
        if settings.qdrant.distance.lower() == "euclid":
            distance_choice = Distance.EUCLID
        elif settings.qdrant.distance.lower() == "dot":
            distance_choice = Distance.DOT

        self.client.create_collection(
            collection_name=self.collection_name,
            vectors_config=VectorParams(
                size=settings.qdrant.vector_size,
                distance=distance_choice,
            ),
        )
        return True

    def delete_this_collection(self) -> bool:
        """Xóa vĩnh viễn collection này khỏi Qdrant."""
        return delete_collection(self.collection_name)


# Registry cache cho ImageRepository theo collection_name
_image_repositories: Dict[str, ImageRepository] = {}


def get_image_repository(collection_name: Optional[str] = None) -> ImageRepository:
    """Dependency injector / Factory accessor cho ImageRepository."""
    target_name = collection_name or settings.qdrant.collection_name
    if target_name not in _image_repositories:
        _image_repositories[target_name] = ImageRepository(collection_name=target_name)
    return _image_repositories[target_name]


def list_all_collections() -> List[str]:
    """Lấy danh sách tên tất cả các collection hiện có trên Qdrant."""
    client = get_qdrant_client()
    try:
        res = client.get_collections()
        return [c.name for c in res.collections]
    except Exception as e:
        logger.error(f"Lỗi lấy danh sách collections từ Qdrant: {e}")
        return []


def create_new_collection(
    collection_name: str,
    vector_size: Optional[int] = None,
    distance: Optional[str] = None,
) -> bool:
    """Tạo mới 1 collection trên Qdrant với cấu hình chỉ định (hoặc mặc định)."""
    client = get_qdrant_client()
    clean_name = collection_name.strip()
    if not clean_name:
        raise ValueError("Tên collection không được để trống.")

    if client.collection_exists(clean_name):
        return True

    v_size = vector_size or settings.qdrant.vector_size
    dist_str = (distance or settings.qdrant.distance).lower()
    dist_choice = Distance.COSINE
    if dist_str == "euclid":
        dist_choice = Distance.EUCLID
    elif dist_str == "dot":
        dist_choice = Distance.DOT

    client.create_collection(
        collection_name=clean_name,
        vectors_config=VectorParams(
            size=v_size,
            distance=dist_choice,
        ),
    )
    logger.info(f"Đã tạo thành công collection mới '{clean_name}' trên Qdrant.")
    return True


def delete_collection(collection_name: str) -> bool:
    """Xóa sổ vĩnh viễn một collection khỏi Qdrant."""
    client = get_qdrant_client()
    clean_name = collection_name.strip()
    if client.collection_exists(clean_name):
        client.delete_collection(collection_name=clean_name)
        if clean_name in _image_repositories:
            del _image_repositories[clean_name]
        logger.info(f"Đã xóa hoàn toàn collection '{clean_name}' khỏi Qdrant.")
        return True
    return False
