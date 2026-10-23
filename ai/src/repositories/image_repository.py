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
from src.db.enums import PointStatus
from src.db.models import ImagePointPayload
from src.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class ImageRepository(BaseRepository):
    """
    Repository phụ trách lưu trữ, truy vấn và quản lý vòng đời của Point
    trong collection 'image_gallery' trên Qdrant.
    """

    def __init__(
        self,
        collection_name: Optional[str] = None,
        client: Optional[QdrantClient] = None,
    ) -> None:
        target_collection = collection_name or settings.qdrant.collection_name
        super().__init__(collection_name=target_collection, client=client)

    def search_vectors(
        self,
        query_vector: List[float],
        limit: int = 5,
        score_threshold: Optional[float] = None,
        exclude_deleted: bool = True,
        extra_filter: Optional[Filter] = None,
    ) -> List[ScoredPoint]:
        """
        Tìm kiếm cosine vector tương đồng trong collection.
        Mặc định tự động loại trừ các bản ghi có trạng thái DELETED (Soft Deleted).
        """
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

    def get_by_id(self, point_id: str) -> Optional[Record]:
        """
        Lấy thông tin chi tiết một point theo ID. Trả về None nếu không tìm thấy.
        """
        records = self.client.retrieve(
            collection_name=self.collection_name,
            ids=[point_id],
            with_payload=True,
            with_vectors=False,
        )
        if records:
            return records[0]
        return None

    def create(
        self,
        point_id: str,
        vector: List[float],
        payload: Union[ImagePointPayload, Dict[str, Any]],
    ) -> bool:
        """
        Tạo mới hoặc ghi đè một Vector Point vào Qdrant.
        """
        payload_dict = (
            payload.to_payload_dict()
            if isinstance(payload, ImagePointPayload)
            else payload
        )
        self.client.upsert(
            collection_name=self.collection_name,
            points=[
                PointStruct(
                    id=point_id,
                    vector=vector,
                    payload=payload_dict,
                )
            ],
        )
        return True

    def upsert_batch(self, points: List[PointStruct]) -> int:
        """
        Nạp dữ liệu hàng loạt theo batch vào Qdrant. Trả về số lượng point đã nạp.
        """
        if not points:
            return 0
        self.client.upsert(
            collection_name=self.collection_name,
            points=points,
        )
        return len(points)

    def update_payload(
        self,
        point_id: str,
        payload: Union[ImagePointPayload, Dict[str, Any]],
    ) -> bool:
        """
        Cập nhật các trường payload cho một point cụ thể.
        """
        payload_dict = (
            payload.to_payload_dict()
            if isinstance(payload, ImagePointPayload)
            else payload
        )
        self.client.set_payload(
            collection_name=self.collection_name,
            payload=payload_dict,
            points=[point_id],
        )
        return True

    def soft_delete(self, point_id: str) -> bool:
        """
        Xóa mềm point bằng cách cập nhật status = DELETED.
        Bản ghi vẫn tồn tại trong DB nhưng bị loại bỏ khỏi kết quả tìm kiếm.
        """
        return self.update_payload(
            point_id=point_id,
            payload={"status": PointStatus.DELETED.value},
        )

    def hard_delete(self, point_id: str) -> bool:
        """
        Xóa cứng: Loại bỏ hoàn toàn vector và payload của point ra khỏi Qdrant.
        """
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=PointIdsList(points=[point_id]),
        )
        return True

    def count_points(self, filter_status: Optional[PointStatus] = None) -> int:
        """
        Đếm tổng số point trong collection. Có thể lọc theo trạng thái PointStatus.
        """
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
        """
        Phân trang duyệt danh sách Point từ Qdrant (scroll).
        Trả về (records, next_offset).
        """
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

    def get_collection_info(self) -> Dict[str, Any]:
        """
        Lấy thông tin tổng quan của collection: trạng thái, số lượng point, v.v.
        """
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
        """
        Xóa sạch collection hiện tại và tạo lại collection rỗng với cấu hình chuẩn
        (vector_size và distance được lấy từ settings.qdrant).
        """
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



# Singleton instance cho ImageRepository
_image_repository: Optional[ImageRepository] = None


def get_image_repository() -> ImageRepository:
    """Dependency injector / Singleton accessor cho ImageRepository."""
    global _image_repository
    if _image_repository is None:
        _image_repository = ImageRepository()
    return _image_repository
