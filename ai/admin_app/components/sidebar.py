import re
import streamlit as st
import torch

from src.core.config import settings
from src.repositories import (
    list_all_collections,
    create_new_collection,
    delete_collection,
)


def render_sidebar() -> str:
    """
    Component Sidebar: Quản lý danh sách Collection trên Qdrant và hiển thị thông số hệ thống.
    Trả về: selected_collection (str)
    """
    with st.sidebar:
        st.title("Fashion AI")
        st.caption("Admin Console & Multi-Collection Management")

        st.divider()

        # ------------------------------------------
        # 1. QUẢN LÝ VÀ CHỌN COLLECTION
        # ------------------------------------------
        st.markdown("##### Quản lý Collection")

        all_collections = list_all_collections()
        default_collection = settings.qdrant.collection_name

        # Fallback tự động tạo collection mặc định nếu Qdrant hoàn toàn rỗng
        if not all_collections:
            create_new_collection(default_collection)
            all_collections = [default_collection]

        # Đồng bộ an toàn session_state
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
            help="Toàn bộ thao tác và dữ liệu trên các tab sẽ áp dụng cho collection này.",
        )
        st.session_state["selected_collection"] = selected_collection

        # Form tạo mới collection
        with st.expander("Tạo Collection mới"):
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

        # Xóa Collection phụ (Bảo vệ collection mặc định)
        if selected_collection == default_collection:
            st.caption(f"`{selected_collection}` là collection mặc định của hệ thống. Bạn chỉ có thể Reset dữ liệu bên trong tại tab Tổng quan.")
        else:
            with st.expander("Xóa Collection này"):
                st.warning(f"Thao tác này sẽ xóa sổ vĩnh viễn collection `{selected_collection}` khỏi Qdrant!")
                confirm_delete = st.checkbox(f"Tôi xác nhận muốn xóa vĩnh viễn '{selected_collection}'")
                if st.button("Xác nhận Xóa Hẳn", type="primary", use_container_width=True, disabled=not confirm_delete):
                    delete_collection(selected_collection)
                    st.session_state["selected_collection"] = default_collection
                    st.success(f"Đã xóa collection '{selected_collection}'!")
                    st.rerun()

        st.divider()

        # ------------------------------------------
        # 2. THÔNG SỐ KỸ THUẬT HỆ THỐNG
        # ------------------------------------------
        st.markdown("##### Thông số Kỹ thuật")
        is_cuda = torch.cuda.is_available()
        dev_title = "CUDA (GPU)" if is_cuda else "CPU Mode"
        st.markdown(f"**Thiết bị:** {dev_title}")
        if is_cuda:
            st.caption(f"GPU: `{torch.cuda.get_device_name(0)}`")

        st.markdown(f"**Qdrant:** `gRPC :{settings.qdrant.grpc_port}`")
        st.markdown(f"**Active DB:** `{selected_collection}`")
        st.markdown(f"**Model:** `{settings.model.id}`")

        st.divider()
        st.caption("Fashion AI Search Engine © 2026")

    return selected_collection
