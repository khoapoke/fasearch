import sys
from pathlib import Path

# Đảm bảo đường dẫn gốc của dự án nằm trong sys.path để các module src.* được import đúng
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import logging
import streamlit as st

from src.core.ai_model import get_ai_model
from src.services import PointService, SearchService
from admin_app.state import init_app_state
from admin_app.components import render_sidebar
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
# KHỞI TẠO TÀI NGUYÊN MODEL & TRẠNG THÁI
# ==========================================
@st.cache_resource(show_spinner="Đang khởi tạo mô hình AI CLIP...")
def initialize_ai_model():
    """Nạp sẵn mô hình AI một lần duy nhất trong toàn phiên."""
    device, model, processor = get_ai_model()
    return device


device = initialize_ai_model()
init_app_state()


# ==========================================
# THANH ĐIỀU HƯỚNG BÊN TRÁI (SIDEBAR COMPONENT)
# ==========================================
selected_collection, choice = render_sidebar()


# ==========================================
# KHỞI TẠO SERVICE ĐỘC LẬP THEO COLLECTION
# ==========================================
point_srv = PointService(collection_name=selected_collection)
search_srv = SearchService(collection_name=selected_collection)


# ==========================================
# ĐIỀU PHỐI MÀN HÌNH CHÍNH (ROUTER)
# ==========================================
if choice == 1:
    render_overview(point_srv=point_srv)
elif choice == 2:
    render_point_manager(point_srv=point_srv)
elif choice == 3:
    render_search_tester(search_srv=search_srv)
