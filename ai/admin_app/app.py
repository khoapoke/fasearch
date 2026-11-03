import re
import sys
import logging
from pathlib import Path

# Đảm bảo đường dẫn gốc của dự án nằm trong sys.path để các module src.* được import đúng
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import streamlit as st
import torch

from src.core.config import settings
from src.core.ai_model import get_ai_model
from src.repositories import (
    list_all_collections,
    create_new_collection,
    delete_collection,
)
from src.services import PointService, SearchService
from admin_app.views.overview import render_overview
from admin_app.views.point_manager import render_point_manager
from admin_app.views.search_tester import render_search_tester

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

# ==========================================
# CẤU HÌNH TRANG STREAMLIT
# ==========================================
st.set_page_config(
    page_title="Fashion AI Search | Admin Console",
    page_icon="🛍️",
    layout="wide",
    initial_sidebar_state="expanded",
)


# ==========================================
# KHỞI TẠO VÀ CACHE RESOURCE AI MODEL
# ==========================================
@st.cache_resource(show_spinner="Đang khởi tạo mô hình AI CLIP...")
def initialize_ai_model():
    """Nạp sẵn mô hình AI một lần duy nhất."""
    device, model, processor = get_ai_model()
    return device


device = initialize_ai_model()


# ==========================================
# CSS TÙY BIẾN CHO GIAO DIỆN HIỆN ĐẠI
# ==========================================
st.markdown(
    """
    <style>
    [data-testid="stMetric"] {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        padding: 12px 16px;
        border-radius: 8px;
    }
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
    }
    .stTabs [data-baseweb="tab"] {
        border-radius: 6px 6px 0 0;
        padding: 8px 16px;
        font-weight: 500;
    }
    </style>
    """,
    unsafe_allow_html=True,
)


# ==========================================
# THANH ĐIỀU HƯỚNG BÊN TRÁI (SIDEBAR)
# ==========================================
with st.sidebar:
    st.title("🛍️ Fashion AI")
    st.caption("Admin Console & Multi-Collection Management")

    st.divider()

    # ------------------------------------------
    # QUẢN LÝ VÀ CHỌN COLLECTION (DATABASE)
    # ------------------------------------------
    st.markdown("##### 🗄️ Quản lý Collection")

    # Lấy danh sách collection thực tế từ Qdrant
    all_collections = list_all_collections()
    default_collection = settings.qdrant.collection_name

    # Nếu DB rỗng, tự động khởi tạo collection mặc định dự phòng từ database.yaml
    if not all_collections:
        create_new_collection(default_collection)
        all_collections = [default_collection]

    # Đồng bộ session state
    if (
        "selected_collection" not in st.session_state
        or st.session_state["selected_collection"] not in all_collections
    ):
        st.session_state["selected_collection"] = (
            default_collection if default_collection in all_collections else all_collections[0]
        )

    current_idx = (
        all_collections.index(st.session_state["selected_collection"])
        if st.session_state["selected_collection"] in all_collections
        else 0
    )

    selected_collection = st.selectbox(
        "Collection đang chọn:",
        options=all_collections,
        index=current_idx,
        help="Toàn bộ thao tác và dữ liệu sẽ áp dụng cho collection này.",
    )
    st.session_state["selected_collection"] = selected_collection

    # 1. Tạo mới Collection
    with st.expander("➕ Tạo Collection mới"):
        new_col_input = st.text_input("Tên collection:", placeholder="vd: shoes_gallery")
        if st.button("Tạo ngay", use_container_width=True):
            clean_name = new_col_input.strip()
            if not clean_name:
                st.error("Vui lòng nhập tên collection.")
            elif not re.match(r"^[a-zA-Z0-9_-]+$", clean_name):
                st.error("Tên chỉ được chứa chữ cái, số, gạch dưới (_) hoặc gạch ngang (-).")
            elif clean_name in all_collections:
                st.warning(f"Collection '{clean_name}' đã tồn tại.")
            else:
                create_new_collection(clean_name)
                st.session_state["selected_collection"] = clean_name
                st.success(f"Đã tạo collection '{clean_name}' thành công!")
                st.rerun()

    # 2. Xóa Collection (Chỉ cho phép với các collection phụ, bảo vệ collection mặc định)
    if selected_collection == default_collection:
        st.caption(f"🔒 `{selected_collection}` là collection mặc định của hệ thống. Bạn chỉ có thể Reset dữ liệu bên trong tại tab Tổng quan.")
    else:
        with st.expander("🗑️ Xóa Collection này"):
            st.warning(f"Thao tác này sẽ xóa sổ vĩnh viễn collection `{selected_collection}` khỏi Qdrant!")
            confirm_delete = st.checkbox(f"Tôi xác nhận muốn xóa vĩnh viễn '{selected_collection}'")
            if st.button("Xác nhận Xóa Hẳn", type="primary", use_container_width=True, disabled=not confirm_delete):
                delete_collection(selected_collection)
                st.session_state["selected_collection"] = default_collection
                st.success(f"Đã xóa collection '{selected_collection}'!")
                st.rerun()

    st.divider()

    # ------------------------------------------
    # ĐIỀU HƯỚNG TRANG (PAGE NAVIGATION)
    # ------------------------------------------
    selected_page = st.radio(
        "Chức năng quản trị:",
        options=[
            {"choose": 1, "title": "Tổng quan"},
            {"choose": 2, "title": "Vector Point"},
            {"choose": 3, "title": "Thử nghiệm tìm kiếm"},
        ],
        format_func=lambda opt: opt["title"],
        index=0,
    )

    st.divider()

    # ------------------------------------------
    # THÔNG SỐ KỸ THUẬT
    # ------------------------------------------
    st.markdown("##### 🖥️ Thông số Kỹ thuật")
    is_cuda = torch.cuda.is_available()
    dev_title = "🟢 CUDA (GPU)" if is_cuda else "⚪ CPU Mode"
    st.markdown(f"**Thiết bị:** {dev_title}")
    if is_cuda:
        st.caption(f"GPU: `{torch.cuda.get_device_name(0)}`")

    st.markdown(f"**Qdrant:** `gRPC :{settings.qdrant.grpc_port}`")
    st.markdown(f"**Active DB:** `{selected_collection}`")
    st.markdown(f"**Model:** `{settings.model.id}`")

    st.divider()
    st.caption("Fashion AI Search Engine © 2026")


# ==========================================
# KHỞI TẠO SERVICE ĐỘC LẬP THEO COLLECTION
# ==========================================
point_srv = PointService(collection_name=selected_collection)
search_srv = SearchService(collection_name=selected_collection)


# ==========================================
# ĐIỀU PHỐI MÀN HÌNH CHÍNH (ROUTER)
# ==========================================
choice = selected_page.get("choose", 1)

if choice == 1:
    render_overview(point_srv=point_srv)
elif choice == 2:
    render_point_manager(point_srv=point_srv)
elif choice == 3:
    render_search_tester(search_srv=search_srv)
