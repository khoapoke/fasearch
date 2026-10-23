import json
import uuid
import streamlit as st
import torch
from PIL import Image

from src.core.ai_model import get_ai_model
from src.db.enums import PointStatus, CatalogCategory
from src.db.models import ImagePointPayload
from src.repositories import get_image_repository
from admin_app.components.ui_helpers import (
    resolve_image_path,
    get_status_badge,
    get_catalog_badge,
    save_admin_uploaded_image,
)


def render_point_manager():
    """
    Trang 2: Quản trị Point trong Vector Database (Thêm, Sửa, Xóa mềm, Xóa cứng, Duyệt danh sách).
    """
    st.subheader("Quản trị Vector Point (Point Manager)")
    st.caption("Xem danh sách, thêm ảnh mới sinh vector, chỉnh sửa metadata hoặc xóa Point.")

    repo = get_image_repository()

    tab_browse, tab_add = st.tabs(["Danh sách Point", "Thêm sản phẩm mới"])

    # =========================================================================
    # TAB 1: DUYỆT & QUẢN LÝ DANH SÁCH POINT
    # =========================================================================
    with tab_browse:
        # Bộ lọc
        col_f1, col_f2, col_f3 = st.columns([2, 1, 1])
        with col_f1:
            status_filter_choice = st.selectbox(
                "Lọc theo Trạng thái (Status)",
                options=["TẤT CẢ", PointStatus.ACTIVE.value, PointStatus.SEEDED.value, PointStatus.DELETED.value],
                index=0,
            )
        with col_f2:
            page_size = st.selectbox("Số lượng / trang", options=[12, 24, 48], index=0)
        with col_f3:
            st.write("")
            st.write("")
            refresh_btn = st.button("🔄 Làm mới", use_container_width=True)

        target_status = None
        if status_filter_choice != "TẤT CẢ":
            target_status = PointStatus(status_filter_choice)

        # Lấy danh sách qua hàm scroll_points của repository
        try:
            records, next_offset = repo.scroll_points(
                limit=page_size,
                filter_status=target_status,
                with_payload=True,
            )
        except Exception as e:
            st.error(f"Lỗi khi đọc danh sách từ Qdrant: {e}")
            records, next_offset = [], None

        if not records:
            st.info("Hiện không có bản ghi nào phù hợp với bộ lọc đã chọn.")
        else:
            st.markdown(f"**Hiển thị {len(records)} Point gần nhất:**")

            # Hiển thị theo lưới 3 cột
            cols_per_row = 3
            for i in range(0, len(records), cols_per_row):
                row_records = records[i:i + cols_per_row]
                row_cols = st.columns(cols_per_row)

                for col, record in zip(row_cols, row_records):
                    with col:
                        payload = record.payload or {}
                        raw_img_path = payload.get("image_path", "")
                        file_name = payload.get("file_name", "Không rõ tên")
                        curr_status = payload.get("status", "UNKNOWN")
                        curr_catalog = payload.get("catalog", "FASHION_PRODUCT")
                        point_id = str(record.id)

                        # Container hiển thị cho từng Point
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

                            # 2. Thông tin cơ bản
                            st.markdown(f"**{file_name}**", help=f"Đường dẫn: {raw_img_path}")
                            st.markdown(
                                f"{get_status_badge(curr_status)} {get_catalog_badge(curr_catalog)}",
                                unsafe_allow_html=True,
                            )
                            st.caption(f"ID: `{point_id[:16]}...`")

                            # 3. Chức năng Chỉnh sửa & Xóa
                            with st.expander("Chi tiết / Sửa"):
                                st.write(f"**ID đầy đủ:** `{point_id}`")
                                st.write(f"**Đường dẫn:** `{raw_img_path}`")
                                st.write(f"**Ngày tạo:** {payload.get('created_at', 'N/A')}")

                                # Form chỉnh sửa nhanh
                                new_status = st.selectbox(
                                    "Đổi trạng thái",
                                    options=[s.value for s in PointStatus],
                                    index=[s.value for s in PointStatus].index(curr_status) if curr_status in [s.value for s in PointStatus] else 0,
                                    key=f"status_{point_id}",
                                )
                                new_cat = st.selectbox(
                                    "Đổi danh mục",
                                    options=[c.value for c in CatalogCategory],
                                    index=[c.value for c in CatalogCategory].index(curr_catalog) if curr_catalog in [c.value for c in CatalogCategory] else 0,
                                    key=f"cat_{point_id}",
                                )

                                if st.button("Cập nhật Payload", key=f"btn_update_{point_id}", type="primary"):
                                    repo.update_payload(
                                        point_id=point_id,
                                        payload={"status": new_status, "catalog": new_cat},
                                    )
                                    st.success("Đã cập nhật!")
                                    st.rerun()

                                st.divider()

                                # Nút Xóa mềm & Xóa cứng
                                col_act1, col_act2 = st.columns(2)
                                with col_act1:
                                    if curr_status != PointStatus.DELETED.value:
                                        if st.button("Xóa mềm", key=f"soft_del_{point_id}", help="Gán status = DELETED", icon=":material/delete:"):
                                            repo.soft_delete(point_id)
                                            st.toast("Đã xóa mềm bản ghi!")
                                            st.rerun()
                                with col_act2:
                                    if st.button("Xóa cứng", key=f"hard_del_{point_id}", help="Xóa vĩnh viễn khỏi Qdrant", icon=":material/cancel:"):
                                        repo.hard_delete(point_id)
                                        st.toast("Đã xóa cứng vĩnh viễn!")
                                        st.rerun()

    # =========================================================================
    # TAB 2: THÊM ẢNH MỚI & TỰ ĐỘNG SINH VECTOR (UPLOAD & EMBED)
    # =========================================================================
    with tab_add:
        st.markdown("##### Tải lên sản phẩm mới vào `dataset/admin/` & sinh vector CLIP")
        st.caption("Ảnh được lưu trữ an toàn trong `dataset/admin/`, tự động trích xuất vector 512 chiều và lưu vào Qdrant.")

        with st.form("add_product_form", clear_on_submit=True):
            uploaded_file = st.file_uploader(
                "Chọn file ảnh sản phẩm",
                type=["png", "jpg", "jpeg", "webp"],
                help="Hỗ trợ các định dạng ảnh phổ biến.",
            )

            col_a1, col_a2 = st.columns(2)
            with col_a1:
                selected_cat = st.selectbox(
                    "Phân loại danh mục (Catalog Category)",
                    options=[c.value for c in CatalogCategory],
                    index=0,
                )
            with col_a2:
                selected_status = st.selectbox(
                    "Trạng thái ban đầu (Point Status)",
                    options=[PointStatus.ACTIVE.value, PointStatus.SEEDED.value],
                    index=0,
                )

            prod_id_input = st.text_input("Mã sản phẩm (Product ID - Tùy chọn)", placeholder="vd: SP-FASHION-001")
            meta_json = st.text_area("Metadata mở rộng (JSON format - Tùy chọn)", value='{"source": "admin_ui"}', height=80)

            submit_add = st.form_submit_button("🚀 Tải lên & Nạp vào Vector DB", type="primary")

            if submit_add:
                if not uploaded_file:
                    st.error("Vui lòng chọn một file ảnh trước khi gửi!")
                else:
                    # Validate JSON metadata
                    meta_dict = {}
                    if meta_json.strip():
                        try:
                            meta_dict = json.loads(meta_json)
                        except Exception as e:
                            st.error(f"Metadata JSON không hợp lệ: {e}")
                            return

                    # Tiến trình nạp ảnh và sinh vector
                    with st.spinner("Đang lưu ảnh và trích xuất vector bằng mô hình CLIP..."):
                        try:
                            # 1. Lưu ảnh vào dataset/admin/
                            web_path, file_name, file_abs_path = save_admin_uploaded_image(uploaded_file)

                            # 2. Sinh vector bằng mô hình CLIP
                            device, model, processor = get_ai_model()
                            with Image.open(file_abs_path) as img:
                                rgb_img = img.convert("RGB")

                            inputs = processor(images=rgb_img, return_tensors="pt").to(device)
                            with torch.no_grad():
                                features = model.get_image_features(**inputs)
                                features = features / features.norm(p=2, dim=-1, keepdim=True)
                                vector = features.cpu().numpy()[0].tolist()

                            # 3. Tạo PointPayload và ghi vào Qdrant qua Repository
                            new_point_id = str(uuid.uuid4())
                            payload_obj = ImagePointPayload(
                                image_path=web_path,
                                file_name=file_name,
                                catalog=CatalogCategory(selected_cat),
                                status=PointStatus(selected_status),
                                product_id=prod_id_input or None,
                                metadata=meta_dict or None,
                            )

                            repo.create(
                                point_id=new_point_id,
                                vector=vector,
                                payload=payload_obj,
                            )

                            st.success(f"Đã thêm thành công! ID: `{new_point_id}` | File: `{file_name}`", icon=":material/check_circle:")
                            st.toast("Sản phẩm mới đã được nạp vào Vector Database!")
                        except Exception as ex:
                            st.error(f"Lỗi trong quá trình xử lý: {ex}")
