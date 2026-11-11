import json
import streamlit as st

from src.db.enums import PointStatus, CatalogCategory
from src.services.point_service import PointService
from admin_app.components.image_card import render_point_card
from admin_app.components.ui_helpers import save_admin_uploaded_image


def render_point_manager(point_srv: PointService) -> None:
    """
    Trang 2: Quản trị Point trong Vector Database (Thêm, Sửa, Xóa mềm, Xóa cứng, Duyệt danh sách).
    Tất cả các thao tác đều áp dụng trên collection của point_srv.
    """
    current_col = point_srv.collection_name
    st.subheader(f"Các điểm dữ liệu")
    st.caption(f"Collection: `{current_col}`")
    st.caption("Xem danh sách, thêm ảnh mới sinh vector, chỉnh sửa metadata hoặc xóa Point.")

    repo = point_srv.repo

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
            refresh_btn = st.button("Làm mới", width="stretch")

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
            st.error(f"Lỗi khi đọc danh sách từ collection '{current_col}': {e}")
            records, next_offset = [], None

        if not records:
            st.info(f"Hiện không có bản ghi nào phù hợp với bộ lọc đã chọn.")
        else:
            st.markdown(f"**Hiển thị {len(records)} Point gần nhất trong `{current_col}`:**")

            # Hiển thị theo lưới 3 cột qua Image Card Component
            cols_per_row = 3
            for i in range(0, len(records), cols_per_row):
                row_records = records[i : i + cols_per_row]
                row_cols = st.columns(cols_per_row)

                for col, record in zip(row_cols, row_records):
                    with col:
                        render_point_card(record=record, point_srv=point_srv)

    # =========================================================================
    # TAB 2: THÊM ẢNH MỚI VÀO COLLECTION NÀY
    # =========================================================================
    with tab_add:
        st.markdown(f"##### Tải lên sản phẩm mới vào `{current_col}`")
        st.caption(f"Ảnh được lưu an toàn trong `dataset/admin/`, tự động sinh vector CLIP và lưu vào `{current_col}`.")

        with st.form("add_product_form", clear_on_submit=True):
            uploaded_file = st.file_uploader(
                "Chọn ảnh thời trang (JPG, PNG, WEBP)",
                type=["png", "jpg", "jpeg", "webp"],
            )

            col_in1, col_in2 = st.columns(2)
            with col_in1:
                selected_cat = st.selectbox(
                    "Danh mục sản phẩm (Catalog)",
                    options=[c.value for c in CatalogCategory],
                    index=0,
                )
            with col_in2:
                selected_status = st.selectbox(
                    "Trạng thái ban đầu (Status)",
                    options=[PointStatus.ACTIVE.value, PointStatus.INACTIVE.value],
                    index=0,
                )

            prod_id_input = st.text_input("Mã sản phẩm (Product ID - Tùy chọn)", placeholder="vd: SP-FASHION-001")
            meta_json = st.text_area("Metadata mở rộng (JSON format - Tùy chọn)", value='{"source": "admin_ui"}', height=80)

            submit_add = st.form_submit_button(f"Nạp vào Collection {current_col}", type="primary")

            if submit_add:
                if not uploaded_file:
                    st.error("Vui lòng chọn một file ảnh trước khi gửi!")
                else:
                    meta_dict = {}
                    if meta_json.strip():
                        try:
                            meta_dict = json.loads(meta_json)
                        except Exception as e:
                            st.error(f"Metadata JSON không hợp lệ: {e}")
                            return

                    with st.spinner(f"Đang trích xuất vector và nạp vào `{current_col}`..."):
                        try:
                            web_path, file_name, file_abs_path = save_admin_uploaded_image(uploaded_file)

                            new_point_id = point_srv.create_point(
                                image_path=file_abs_path,
                                catalog=selected_cat,
                                status=selected_status,
                                product_id=prod_id_input or None,
                                metadata=meta_dict or None,
                            )

                            st.success(f"Đã thêm thành công vào `{current_col}`! ID: `{new_point_id}` | File: `{file_name}`")
                            st.toast("Sản phẩm mới đã được nạp vào Vector Database!")
                        except Exception as ex:
                            st.error(f"Lỗi trong quá trình xử lý: {ex}")
