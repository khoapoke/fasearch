import sys
from pathlib import Path

# Đảm bảo đường dẫn gốc của dự án nằm trong sys.path để các module src.* được import đúng
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import streamlit as st
import torch
import logging
from src.core.config import settings
from src.core.ai_model import get_ai_model
from src.repositories import get_image_repository
from admin_app.views.overview import render_overview
from admin_app.views.point_manager import render_point_manager
from admin_app.views.search_tester import render_search_tester

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

# ==========================================
# CẤU HÌNH TRANG STREAMLIT
# ==========================================
st.set_page_config(
    page_title="Fashion AI Search | Admin Console",
    page_icon="",
    layout="wide",
    initial_sidebar_state="expanded",
)


# ==========================================
# KHỞI TẠO VÀ CACHE RESOURCE
# (Chỉ nạp Model CLIP và Qdrant 1 lần duy nhất trong toàn phiên làm việc)
# ==========================================
@st.cache_resource(show_spinner="Đang khởi tạo mô hình AI và kết nối Qdrant...")
def initialize_system():
    """Hàm khởi tạo và nạp sẵn tài nguyên hệ thống (Model CLIP + Repository)."""
    device, model, processor = get_ai_model()
    repo = get_image_repository()
    return device, repo


# Nạp tài nguyên
device, repo = initialize_system()


# ==========================================
# CSS TÙY BIẾN CHO GIAO DIỆN HIỆN ĐẠI
# ==========================================
st.markdown(
    """
    <style>
    /* Bo tròn các container */
    [data-testid="stMetric"] {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        padding: 12px 16px;
        border-radius: 8px;
    }
    /* Chỉnh kích thước font và khoảng cách */
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
    st.caption("Admin Console & Test Playground")

    st.divider()

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

    # Khung trạng thái hệ thống
    st.markdown("##### 🖥️ Thông số Kỹ thuật")
    is_cuda = torch.cuda.is_available()
    dev_title = "🟢 CUDA (GPU)" if is_cuda else "⚪ CPU Mode"
    st.markdown(f"**Thiết bị:** {dev_title}")
    if is_cuda:
        st.caption(f"Tên GPU: `{torch.cuda.get_device_name(0)}`")

    st.markdown(f"**Qdrant:** `gRPC :{settings.qdrant.grpc_port}`")
    st.markdown(f"**Collection:** `{settings.qdrant.collection_name}`")
    st.markdown(f"**Model:** `{settings.model.id}`")

    st.divider()
    st.caption("Fashion AI Search Engine © 2026")


# ==========================================
# ĐIỀU PHỐI MÀN HÌNH CHÍNH (ROUTER)
# ==========================================
choice = selected_page.get("choose", 1)

if choice == 1:
    render_overview()
elif choice == 2:
    render_point_manager()
elif choice == 3:
    render_search_tester()
