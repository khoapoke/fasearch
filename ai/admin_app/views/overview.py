import streamlit as st
import torch
import yaml
from pathlib import Path

from src.core.config import settings, BASE_DIR
from src.db.enums import PointStatus
from src.repositories import get_image_repository


def render_overview():
    """
    Trang 1: Thống kê trạng thái hệ thống, GPU, Qdrant và chỉnh sửa cấu hình database.yaml.
    """
    st.subheader("Hệ thống & Cấu hình ")
    st.caption("Giám sát trạng thái phần cứng, Vector Database và chỉnh sửa trực quan file cấu hình.")
    st.caption("Truy cập đường dẫn http://localhost:6333/dashboard để xem chi tiết collection trong db")
    repo = get_image_repository()

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
            delta=f"Cổng gRPC: {settings.qdrant.grpc_port}",
        )
        st.caption(f"Host: {settings.qdrant.host} | Collection: {repo.collection_name}")

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
    # PHẦN 2: CHỈNH SỬA FILE CẤU HÌNH YAML (CÁCH A)
    # ==========================================
    st.subheader("Chỉnh sửa Cấu hình (`configs/database.yaml`)", )
    st.markdown(
        "Trực quan hóa và chỉnh sửa cấu hình hệ thống. Nội dung được validate cú pháp YAML an toàn trước khi ghi đĩa."
    )

    yaml_path = BASE_DIR / "configs" / "database.yaml"

    if not yaml_path.exists():
        st.error(f"Không tìm thấy file cấu hình tại `{yaml_path}`")
        return

    # Đọc file YAML
    with open(yaml_path, "r", encoding="utf-8") as f:
        current_yaml = f.read()

    # Hiển thị form chỉnh sửa
    with st.form("yaml_edit_form"):
        edited_yaml = st.text_area(
            label="Nội dung file YAML",
            value=current_yaml,
            height=280,
            help="Sửa các tham số cấu hình của Qdrant hoặc AI model. Hãy chú ý thụt dòng chuẩn YAML.",
        )

        col_save, col_info = st.columns([1, 4])
        with col_save:
            submitted = st.form_submit_button("Lưu cấu hình", type="primary")

        if submitted:
            try:
                # 1. Validate cú pháp YAML an toàn
                parsed_data = yaml.safe_load(edited_yaml)

                if not isinstance(parsed_data, dict):
                    st.error("Cấu hình YAML phải là một cấu trúc dạng key-value hợp lệ.")
                else:
                    # 2. Ghi đè file
                    with open(yaml_path, "w", encoding="utf-8") as f:
                        f.write(edited_yaml)
                    st.success("✅ Đã lưu cấu hình `configs/database.yaml` thành công! Cấu hình mới sẽ áp dụng khi khởi động lại tiến trình tương ứng.")
            except yaml.YAMLError as err:
                st.error(f"❌ Lỗi cú pháp YAML, không thể lưu: {err}")
            except Exception as ex:
                st.error(f"❌ Có lỗi khi ghi file: {ex}")

    st.divider()

    # ==========================================
    # PHẦN 3: VÙNG NGUY HIỂM: RESET COLLECTION & SEEDING (DANGER ZONE)
    # ==========================================
    st.subheader("🚨 Vùng nguy hiểm: Database")
    st.markdown("Xóa toàn bộ vector point cũ trong collection và tái tạo lại từ đầu, hoặc chạy nạp lại dữ liệu chuẩn.")

    with st.container(border=True):
        col_d1, col_d2 = st.columns([1, 1])

        # Cột 1: Xóa & Tạo mới Collection
        with col_d1:
            st.markdown("##### Reset Database (Drop & Recreate)")
            st.caption(
                f"Xóa vĩnh viễn collection `{repo.collection_name}` trên Qdrant và tạo lại bảng rỗng với vector_size: {settings.qdrant.vector_size} (Cosine)."
            )
            confirm_reset = st.checkbox(
                "⚠️ Tôi hiểu và xác nhận muốn xóa toàn bộ vector cũ",
                key="chk_confirm_reset",
            )
            btn_reset = st.button(
                "🗑️ Drop & Recreate Collection",
                type="primary",
                disabled=not confirm_reset,
                help="Chỉ mở khi đã tích chọn xác nhận bên trên.",
            )

            if btn_reset:
                with st.spinner("Đang xóa và khởi tạo lại collection trên Qdrant..."):
                    try:
                        repo.reset_collection()
                        st.success("✅ Đã reset collection rỗng thành công!")
                        st.rerun()
                    except Exception as ex:
                        st.error(f"Lỗi khi reset collection: {ex}")

        # Cột 2: Nạp lại dữ liệu mẫu (Seeder)
        with col_d2:
            st.markdown("##### 🌱 Nạp lại dữ liệu mẫu (Run Seeder)")
            st.caption("Quét ảnh trong thư mục chỉ định của dataset và nạp dữ liệu vector chuẩn vào Qdrant.")

            col_opt1, col_opt2 = st.columns(2)
            with col_opt1:
                subfolder_choice = st.selectbox(
                    "Thư mục nguồn:",
                    options=["test", "raw", "Toàn bộ dataset"],
                    index=0,
                )
            with col_opt2:
                batch_size_choice = st.selectbox(
                    "Kích thước Batch:",
                    options=[16, 32, 64],
                    index=1,
                )

            btn_seed = st.button("Bắt đầu Nạp Dữ liệu Mẫu", key="btn_run_seeder",type="primary")
            if btn_seed:
                target_sub = None if subfolder_choice == "Toàn bộ dataset" else subfolder_choice
                with st.spinner(f"Đang nạp ảnh từ thư mục `{subfolder_choice}` theo batch {batch_size_choice}..."):
                    try:
                        from scripts.seed_data import seed_data
                        seed_data(subfolder=target_sub, batch_size=batch_size_choice)
                        st.success("Nạp dữ liệu hoàn tất thành công!", icon=":material/check:")
                        st.rerun()
                    except Exception as ex:
                        st.error(f"Lỗi trong quá trình nạp dữ liệu: {ex}")

