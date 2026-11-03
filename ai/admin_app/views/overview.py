import streamlit as st
import torch
import yaml
from pathlib import Path

from src.core.config import settings, BASE_DIR
from src.db.enums import PointStatus
from src.services.point_service import PointService


def render_overview(point_srv: PointService):
    """
    Trang 1: Thống kê trạng thái hệ thống, GPU, Qdrant và chỉnh sửa cấu hình database.yaml.
    Toàn bộ số liệu và thao tác gắn liền với collection được chỉ định qua point_srv.
    """
    current_col = point_srv.collection_name
    default_col = settings.qdrant.collection_name
    is_default = (current_col == default_col)

    st.subheader(f"📊 Tổng quan Collection: `{current_col}`")
    st.caption("Giám sát trạng thái phần cứng, Vector Database và cấu hình hệ thống.")
    st.caption("Xem dashboard trực tiếp tại: http://localhost:6333/dashboard")

    repo = point_srv.repo

    # ==========================================
    # PHẦN 1: THẺ THỐNG KÊ NHANH (METRICS CARDS)
    # ==========================================
    col1, col2, col3, col4 = st.columns(4)

    # 1. Hardware / Device
    is_cuda = torch.cuda.is_available()
    device_name = torch.cuda.get_device_name(0) if is_cuda else "CPU"
    vram_info = ""
    if is_cuda:
        allocated = torch.cuda.memory_allocated(0) / (1024**2)
        reserved = torch.cuda.memory_reserved(0) / (1024**2)
        vram_info = f"VRAM: {allocated:.1f} MB / {reserved:.1f} MB"
    else:
        vram_info = "Chạy trên CPU"

    with col1:
        st.metric(
            label="Thiết bị tính toán (Device)",
            value="CUDA GPU" if is_cuda else "CPU",
            delta=device_name,
        )
        st.caption(vram_info)

    # 2. Qdrant Health
    col_info = repo.get_collection_info()
    status_str = col_info.get("status", "Unknown").upper()
    with col2:
        st.metric(
            label="Trạng thái Qdrant",
            value=f"{status_str}",
            delta=f"Collection: {current_col}",
        )
        st.caption(f"Host: {settings.qdrant.host}:{settings.qdrant.grpc_port}")

    # 3. Thống kê Points
    try:
        total_pts = repo.count_points()
        seeded_pts = repo.count_points(PointStatus.SEEDED)
        active_pts = repo.count_points(PointStatus.ACTIVE)
        deleted_pts = repo.count_points(PointStatus.DELETED)
    except Exception as e:
        st.error(f"Không thể kết nối Qdrant: {e}")
        total_pts = seeded_pts = active_pts = deleted_pts = 0

    with col3:
        st.metric(
            label="Tổng số Vector Point",
            value=total_pts,
            delta=f"Active: {active_pts} | Seeded: {seeded_pts}",
        )
        st.caption(f"Vector size: {settings.qdrant.vector_size} | Cosine")

    with col4:
        st.metric(
            label="Đã xóa mềm (Soft-deleted)",
            value=deleted_pts,
            delta=f"-{deleted_pts}" if deleted_pts > 0 else "0",
            delta_color="inverse",
        )
        st.caption("Các point này bị tự động loại khỏi kết quả tìm kiếm")

    st.divider()

    # ==========================================
    # PHẦN 2: CHỈNH SỬA FILE CẤU HÌNH YAML
    # ==========================================
    st.subheader("⚙️ Cấu hình Mặc định Hệ thống (`configs/database.yaml`)")
    st.caption("File cấu hình này đóng vai trò cung cấp collection và thông số vector mặc định (fallback) cho toàn bộ hệ thống.")

    yaml_path = BASE_DIR / "configs" / "database.yaml"

    if yaml_path.exists():
        with open(yaml_path, "r", encoding="utf-8") as f:
            current_yaml = f.read()

        with st.form("yaml_edit_form"):
            edited_yaml = st.text_area(
                label="Nội dung file YAML",
                value=current_yaml,
                height=220,
                help="Sửa các tham số cấu hình mặc định. Hãy chú ý thụt dòng chuẩn YAML.",
            )
            submitted = st.form_submit_button("Lưu cấu hình mặc định", type="primary")

            if submitted:
                try:
                    parsed_data = yaml.safe_load(edited_yaml)
                    if not isinstance(parsed_data, dict):
                        st.error("Cấu hình YAML phải là một cấu trúc dạng key-value hợp lệ.")
                    else:
                        with open(yaml_path, "w", encoding="utf-8") as f:
                            f.write(edited_yaml)
                        st.success("✅ Đã lưu cấu hình `configs/database.yaml` thành công!")
                except yaml.YAMLError as err:
                    st.error(f"❌ Lỗi cú pháp YAML: {err}")
                except Exception as ex:
                    st.error(f"❌ Có lỗi khi ghi file: {ex}")

    st.divider()

    # ==========================================
    # PHẦN 3: VÙNG NGUY HIỂM THEO COLLECTION (DANGER ZONE)
    # ==========================================
    st.subheader(f"🚨 Vùng nguy hiểm: Collection `{current_col}`")
    st.markdown("Các thao tác xóa và nạp dữ liệu dưới đây chỉ áp dụng cho collection đang chọn.")

    with st.container(border=True):
        col_d1, col_d2 = st.columns([1, 1])

        # Cột 1: Xóa dữ liệu (Reset / Xóa hẳn)
        with col_d1:
            st.markdown("##### 🗑️ Quản lý Dữ liệu Collection")
            st.caption(f"Collection đang chọn: `{current_col}` ({'Mặc định' if is_default else 'Tùy chỉnh'})")

            # 1. Reset dữ liệu (Drop & Recreate rỗng) - Dành cho mọi collection
            confirm_reset = st.checkbox(
                f"Xác nhận muốn RESET toàn bộ dữ liệu trong '{current_col}'",
                key="chk_confirm_reset",
            )
            if st.button(
                "♻️ Reset Data (Làm sạch Collection)",
                type="primary",
                disabled=not confirm_reset,
                use_container_width=True,
            ):
                with st.spinner(f"Đang làm sạch collection '{current_col}'..."):
                    try:
                        point_srv.clear_all_points()
                        st.success(f"✅ Đã làm sạch toàn bộ dữ liệu trong '{current_col}'!")
                        st.rerun()
                    except Exception as ex:
                        st.error(f"Lỗi khi reset collection: {ex}")

            # 2. Xóa hẳn collection - Chỉ mở cho collection tùy chỉnh (không phải mặc định)
            if not is_default:
                st.divider()
                st.markdown("##### ⚠️ Xóa hẳn Collection này")
                st.caption(f"Xóa vĩnh viễn collection `{current_col}` khỏi Qdrant.")
                confirm_drop = st.checkbox(
                    f"Xác nhận XÓA SỔ hoàn toàn '{current_col}'",
                    key="chk_confirm_drop",
                )
                if st.button(
                    f"🔥 Xóa hẳn '{current_col}' khỏi DB",
                    type="primary",
                    disabled=not confirm_drop,
                    use_container_width=True,
                ):
                    with st.spinner(f"Đang xóa collection '{current_col}'..."):
                        try:
                            point_srv.delete_collection()
                            st.session_state["selected_collection"] = default_col
                            st.success(f"Đã xóa hoàn toàn collection '{current_col}'!")
                            st.rerun()
                        except Exception as ex:
                            st.error(f"Lỗi khi xóa collection: {ex}")
            else:
                st.info("ℹ️ Đây là collection mặc định của hệ thống: Chỉ hỗ trợ Reset dữ liệu, được bảo vệ không thể xóa hẳn.")

        # Cột 2: Nạp dữ liệu vào collection này
        with col_d2:
            st.markdown(f"##### 🌱 Nạp dữ liệu vào `{current_col}`")
            st.caption(f"Quét ảnh từ dataset và nạp vector trực tiếp vào collection `{current_col}`.")

            col_opt1, col_opt2 = st.columns(2)
            with col_opt1:
                subfolder_choice = st.selectbox(
                    "Thư mục nguồn:",
                    options=["test", "test/images", "raw", "Toàn bộ dataset"],
                    index=0,
                )
            with col_opt2:
                batch_size_choice = st.selectbox(
                    "Kích thước Batch:",
                    options=[16, 32, 64],
                    index=1,
                )

            btn_seed = st.button(f"Nạp dữ liệu vào {current_col}", key="btn_run_seeder", type="primary", use_container_width=True)
            if btn_seed:
                target_sub = None if subfolder_choice == "Toàn bộ dataset" else subfolder_choice
                with st.spinner(f"Đang nạp ảnh từ thư mục `{subfolder_choice}` vào `{current_col}`..."):
                    try:
                        dataset_root = BASE_DIR / settings.app.raw_data_dir
                        target_dir = dataset_root / target_sub if target_sub else dataset_root
                        success_n, skipped_n = point_srv.batch_create_from_directory(
                            target_dir=target_dir,
                            batch_size=batch_size_choice,
                        )
                        st.success(f"Nạp dữ liệu vào `{current_col}` hoàn tất! Thành công: {success_n} ảnh (Bỏ qua: {skipped_n})")
                        st.rerun()
                    except Exception as ex:
                        st.error(f"Lỗi trong quá trình nạp dữ liệu: {ex}")
