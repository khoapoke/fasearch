from typing import Any, Dict
import streamlit as st
from qdrant_client.models import Record

from src.db.enums import PointStatus, CatalogCategory
from src.services.point_service import PointService
from admin_app.components.ui_helpers import (
    resolve_image_path,
    get_status_badge,
    get_catalog_badge,
)


def render_point_card(record: Record, point_srv: PointService) -> None:
    """
    Component hiển thị 1 thẻ Vector Point trong Point Manager:
    - Preview ảnh
    - Badges trạng thái & danh mục
    - Form chỉnh sửa metadata & Nút xóa mềm / xóa cứng
    """
    payload = record.payload or {}
    raw_img_path = payload.get("image_path", "")
    file_name = payload.get("file_name", "Không rõ tên")
    curr_status = payload.get("status", "UNKNOWN")
    curr_catalog = payload.get("catalog", "FASHION_PRODUCT")
    point_id = str(record.id)

    with st.container(border=True):
        # 1. Preview ảnh
        resolved = resolve_image_path(raw_img_path)
        if resolved:
            try:
                st.image(str(resolved), width="stretch")
            except Exception:
                st.warning("Không thể hiển thị ảnh.")
        else:
            st.markdown(
                f"""<div style="height:140px; background:#f3f4f6; display:flex; align-items:center; justify-content:center; color:#9ca3af; border-radius:6px;">
                    <span>📷 Không tìm thấy file gốc</span>
                </div>""",
                unsafe_allow_html=True,
            )

        # 2. Metadata tóm tắt
        st.markdown(f"**{file_name}**")
        c_b1, c_b2 = st.columns(2)
        with c_b1:
            st.markdown(get_status_badge(curr_status), unsafe_allow_html=True)
        with c_b2:
            st.markdown(get_catalog_badge(curr_catalog), unsafe_allow_html=True)
        st.caption(f"ID: `{point_id[:16]}...`")

        # 3. Chức năng Chỉnh sửa & Xóa
        with st.expander("Chi tiết / Sửa"):
            st.write(f"**ID đầy đủ:** `{point_id}`")
            st.write(f"**Đường dẫn:** `{raw_img_path}`")
            st.write(f"**Ngày tạo:** {payload.get('created_at', 'N/A')}")

            # Form chỉnh sửa nhanh
            status_values = [s.value for s in PointStatus]
            cat_values = [c.value for c in CatalogCategory]

            new_status = st.selectbox(
                "Đổi trạng thái",
                options=status_values,
                index=status_values.index(curr_status) if curr_status in status_values else 0,
                key=f"status_{point_id}",
            )
            new_cat = st.selectbox(
                "Đổi danh mục",
                options=cat_values,
                index=cat_values.index(curr_catalog) if curr_catalog in cat_values else 0,
                key=f"cat_{point_id}",
            )

            if st.button("Cập nhật Payload", key=f"btn_update_{point_id}", type="primary"):
                point_srv.update_point_payload(
                    point_id=point_id,
                    payload_updates={"status": new_status, "catalog": new_cat},
                )
                st.success("Đã cập nhật!")
                st.rerun()

            st.divider()

            # Nút Xóa mềm & Xóa cứng
            col_act1, col_act2 = st.columns(2)
            with col_act1:
                if curr_status != PointStatus.DELETED.value:
                    if st.button("Xóa mềm", key=f"soft_del_{point_id}", help="Gán status = DELETED"):
                        point_srv.delete_point(point_id=point_id, hard_delete=False)
                        st.toast("Đã xóa mềm bản ghi!")
                        st.rerun()
            with col_act2:
                if st.button("Xóa cứng", key=f"hard_del_{point_id}", help="Xóa vĩnh viễn khỏi Qdrant"):
                    point_srv.delete_point(point_id=point_id, hard_delete=True)
                    st.toast("Đã xóa cứng vĩnh viễn!")
                    st.rerun()


def render_search_result_card(item: Dict[str, Any]) -> None:
    """
    Component hiển thị 1 thẻ kết quả tìm kiếm trong Search Tester:
    - Preview ảnh kết quả
    - Thanh đo độ tương đồng Cosine
    - Badge danh mục & ID
    """
    score = item.get("score", 0.0)
    score_pct = max(0.0, min(1.0, score)) * 100
    raw_img = item.get("image_path", "")
    file_name = item.get("file_name", "Unknown")
    catalog = item.get("catalog", "FASHION_PRODUCT")
    item_id = item.get("id", "")

    with st.container(border=True):
        # 1. Preview ảnh
        resolved = resolve_image_path(raw_img)
        if resolved:
            try:
                st.image(str(resolved), width="stretch")
            except Exception:
                st.warning("Lỗi hiển thị ảnh.")
        else:
            st.markdown(
                f"""<div style="height:140px; background:#f3f4f6; display:flex; align-items:center; justify-content:center; color:#9ca3af; border-radius:6px;">
                    <span>📷 File ảnh: {file_name}</span>
                </div>""",
                unsafe_allow_html=True,
            )

        # 2. Thanh điểm Cosine Similarity
        st.progress(score_pct / 100.0)
        st.markdown(f"**Độ tương đồng:** `{score:.4f}` ({score_pct:.1f}%)")

        # 3. Metadata
        st.markdown(f"**{file_name}**")
        st.markdown(f"{get_catalog_badge(catalog)}", unsafe_allow_html=True)
        st.caption(f"ID: `{item_id[:16]}...`")

