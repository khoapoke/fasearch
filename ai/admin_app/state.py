"""
Quản lý trạng thái phiên làm việc (Session State) tập trung cho Admin App.
Tương tự như Context / Store trong React/Next.js.
"""

from pathlib import Path
import streamlit as st
from src.core.config import settings, BASE_DIR


def init_app_state() -> None:
    """
    Khởi tạo giá trị mặc định cho toàn bộ các biến trong st.session_state nếu chưa tồn tại.
    Tránh lỗi KeyError khi chuyển đổi qua lại giữa các màn hình.
    """
    # 1. Collection đang hoạt động
    if "selected_collection" not in st.session_state:
        st.session_state["selected_collection"] = settings.qdrant.collection_name

    # 2. Thư mục nguồn mặc định khi Seed dữ liệu
    if "seed_custom_folder" not in st.session_state:
        default_seed_path = BASE_DIR / "dataset" / "test" / "images"
        st.session_state["seed_custom_folder"] = str(default_seed_path)

    # 3. Bộ lọc trạng thái mặc định trong Point Manager
    if "point_manager_filter_status" not in st.session_state:
        st.session_state["point_manager_filter_status"] = "TẤT CẢ"

    # 4. Kích thước trang mặc định
    if "point_manager_page_size" not in st.session_state:
        st.session_state["point_manager_page_size"] = 12

