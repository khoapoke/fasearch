from pathlib import Path
import streamlit as st

from src.core.config import BASE_DIR
from src.db.enums import PointStatus, CatalogCategory
from src.services.point_service import PointService
from admin_app.components.ui_helpers import open_folder_dialog, scan_folder_direct_images


def render_seeder_box(point_srv: PointService) -> None:
    """
    Component nạp dữ liệu (Seeder Box):
    - Cho phép duyệt thư mục bằng Windows File Explorer.
    - Quét và kiểm tra số lượng ảnh trực tiếp (Cách B: bỏ qua thư mục con).
    - Xem trước tối đa 10 ảnh trực tiếp.
    - Nạp hàng loạt ảnh theo batch vào collection đang chọn.
    """
    current_col = point_srv.collection_name

    st.markdown(f"##### Nạp dữ liệu vào `{current_col}`")
    st.caption("Chỉ quét các file ảnh trực tiếp trong thư mục được chọn (bỏ qua các thư mục con bên trong).")

    # 1. Nút mở cửa sổ chọn thư mục Windows
    default_path = str(BASE_DIR / "dataset" / "test" / "images")
    if "seed_custom_folder" not in st.session_state:
        st.session_state["seed_custom_folder"] = default_path

    col_btn_browse, col_btn_clear = st.columns([3, 1])
    with col_btn_browse:
        if st.button("Mở cửa sổ Browse chọn thư mục (Windows)", width="stretch", type="secondary"):
            selected_dir = open_folder_dialog(initial_dir=Path(st.session_state["seed_custom_folder"]))
            if selected_dir:
                st.session_state["seed_custom_folder"] = selected_dir
                st.rerun()

    with col_btn_clear:
        if st.button("Mặc định", width="stretch", help="Khôi phục về thư mục test/images mặc định"):
            st.session_state["seed_custom_folder"] = default_path
            st.rerun()

    # Ô hiển thị đường dẫn đã chọn (đồng bộ trực tiếp qua key="seed_custom_folder")
    chosen_dir_str = st.text_input(
        "Đường dẫn thư mục đã chọn:",
        key="seed_custom_folder",
    )

    # 2. Quét kiểm tra ảnh trực tiếp trong thư mục (Cách B)
    chosen_dir_path = Path(chosen_dir_str.strip()) if chosen_dir_str.strip() else None
    direct_images = scan_folder_direct_images(chosen_dir_path) if chosen_dir_path else []

    if not chosen_dir_path or not chosen_dir_path.exists() or not chosen_dir_path.is_dir():
        st.warning("Thư mục không tồn tại hoặc không hợp lệ.")
    elif not direct_images:
        st.warning("Thư mục này không chứa file ảnh trực tiếp nào.")
    else:
        st.success(f"Tìm thấy **{len(direct_images)} ảnh** trực tiếp trong thư mục này.")

        # 3. Hiển thị xem trước tối đa 10 ảnh
        preview_count = min(10, len(direct_images))
        with st.expander(f"Xem trước ({preview_count}/{len(direct_images)} ảnh trực tiếp)", expanded=True):
            preview_cols = st.columns(min(5, preview_count))
            for idx in range(preview_count):
                col = preview_cols[idx % min(5, preview_count)]
                with col:
                    img_p = direct_images[idx]
                    try:
                        st.image(str(img_p), caption=img_p.name, width="stretch")
                    except Exception:
                        st.caption(img_p.name)

    # Cấu hình danh mục và batch size
    col_opt1, col_opt2 = st.columns(2)
    with col_opt1:
        cat_choice = st.selectbox(
            "Danh mục gán nhãn:",
            options=[c.value for c in CatalogCategory],
            index=0,
        )
    with col_opt2:
        batch_size_choice = st.selectbox(
            "Kích thước Batch:",
            options=[16, 32, 64],
            index=1,
        )

    # Nút bắt đầu Seed
    btn_disabled = (len(direct_images) == 0)
    btn_seed = st.button(
        f"Bắt đầu nạp {len(direct_images)} ảnh",
        key="btn_run_seeder",
        type="primary",
        disabled=btn_disabled,
        width="stretch",
    )

    if btn_seed and direct_images and chosen_dir_path:
        with st.spinner(f"Đang trích xuất vector và nạp {len(direct_images)} ảnh vào `{current_col}`..."):
            try:
                success_n, skipped_n = point_srv.batch_create_from_directory(
                    target_dir=chosen_dir_path,
                    batch_size=batch_size_choice,
                    catalog=cat_choice,
                    status=PointStatus.SEEDED,
                    recursive=False,
                )
                st.success(f"Nạp dữ liệu hoàn tất! Thành công: {success_n} ảnh (Bỏ qua: {skipped_n})")
                st.rerun()
            except Exception as ex:
                st.error(f"Lỗi trong quá trình nạp dữ liệu: {ex}")

