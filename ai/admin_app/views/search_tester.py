import os
import time
import uuid
import streamlit as st
from PIL import Image

from src.core.config import BASE_DIR
from src.services.search_service import search_by_text, search_by_image
from admin_app.components.ui_helpers import (
    resolve_image_path,
    get_status_badge,
    get_catalog_badge,
)


def render_search_tester():
    """
    Trang 3: Sân chơi thử nghiệm tìm kiếm đa phương thức (Text-to-Image và Image-to-Image).
    """
    st.subheader("🔍 Thử nghiệm Tìm kiếm Đa phương thức (Search Playground)")
    st.caption("Kiểm thử tính năng trích xuất vector embedding và truy vấn độ tương đồng Cosine trong Qdrant.")

    # ==========================================
    # CẤU HÌNH THAM SỐ TÌM KIẾM
    # ==========================================
    with st.expander("⚙️ Tham số truy vấn (Search Parameters)", expanded=True):
        col_p1, col_p2, col_p3 = st.columns(3)
        with col_p1:
            top_k = st.slider("Số lượng kết quả (Top K)", min_value=1, max_value=24, value=6)
        with col_p2:
            score_threshold = st.slider(
                "Ngưỡng điểm tương đồng tối thiểu (Threshold)",
                min_value=0.0,
                max_value=0.9,
                value=0.0,
                step=0.05,
                help="Chỉ giữ lại các kết quả có điểm Cosine lớn hơn hoặc bằng ngưỡng này.",
            )
        with col_p3:
            exclude_deleted = st.checkbox(
                "Loại trừ bản ghi đã xóa mềm (status: DELETED)",
                value=True,
                help="Bật để tự động ẩn các point có trạng thái DELETED.",
            )

    tab_text, tab_image = st.tabs(["💬 Tìm bằng Văn bản (Text-to-Image)", "🖼️ Tìm bằng Hình ảnh (Image-to-Image)"])

    results = None
    query_display = ""
    elapsed_ms = 0

    # ==========================================
    # TAB 1: TEXT-TO-IMAGE
    # ==========================================
    with tab_text:
        st.markdown("##### Nhập câu mô tả sản phẩm thời trang:")

        col_q1, col_q2 = st.columns([4, 1])
        with col_q1:
            query_text = st.text_input(
                "Mô tả sản phẩm",
                placeholder="vd: áo sơ mi trắng, black leather jacket, red evening dress...",
                label_visibility="collapsed",
            )
        with col_q2:
            btn_text_search = st.button("🔎 Tìm kiếm", key="btn_search_text", type="primary", use_container_width=True)

        # Gợi ý truy vấn nhanh
        st.caption("Gợi ý từ khóa mẫu:")
        c1, c2, c3, c4 = st.columns(4)
        if c1.button("👔 áo sơ mi trắng"):
            query_text = "áo sơ mi trắng"
            btn_text_search = True
        if c2.button("🧥 black jacket"):
            query_text = "black jacket"
            btn_text_search = True
        if c3.button("👗 floral dress"):
            query_text = "floral dress"
            btn_text_search = True
        if c4.button("👖 blue jeans"):
            query_text = "blue jeans"
            btn_text_search = True

        if btn_text_search and query_text.strip():
            with st.spinner("Đang trích xuất vector từ text và tìm kiếm trong Qdrant..."):
                start_t = time.time()
                try:
                    results = search_by_text(
                        query_text=query_text.strip(),
                        limit=top_k,
                        exclude_deleted=exclude_deleted,
                        score_threshold=score_threshold if score_threshold > 0 else None,
                    )
                    elapsed_ms = (time.time() - start_t) * 1000
                    query_display = f'Văn bản: "{query_text.strip()}"'
                except Exception as ex:
                    st.error(f"Lỗi khi tìm kiếm: {ex}")

    # ==========================================
    # TAB 2: IMAGE-TO-IMAGE
    # ==========================================
    with tab_image:
        st.markdown("##### Tải lên ảnh để tìm các sản phẩm tương tự:")

        uploaded_query_img = st.file_uploader(
            "Chọn ảnh mẫu",
            type=["png", "jpg", "jpeg", "webp"],
            key="query_img_uploader",
        )

        if uploaded_query_img:
            col_preview, col_btn = st.columns([1, 2])
            with col_preview:
                st.image(uploaded_query_img, caption="Ảnh truy vấn", width=180)
            with col_btn:
                btn_img_search = st.button("🔍 Tìm sản phẩm tương đồng", type="primary")

            if btn_img_search:
                with st.spinner("Đang trích xuất vector từ ảnh mẫu và tìm kiếm..."):
                    # Lưu tạm ảnh query vào storage/uploads/
                    temp_dir = BASE_DIR / "storage" / "uploads"
                    temp_dir.mkdir(parents=True, exist_ok=True)
                    temp_file = temp_dir / f"test_query_{uuid.uuid4().hex[:8]}.jpg"

                    try:
                        with open(temp_file, "wb") as f:
                            f.write(uploaded_query_img.getbuffer())

                        start_t = time.time()
                        results = search_by_image(
                            image_path=str(temp_file),
                            limit=top_k,
                            exclude_deleted=exclude_deleted,
                            score_threshold=score_threshold if score_threshold > 0 else None,
                        )
                        elapsed_ms = (time.time() - start_t) * 1000
                        query_display = f"Ảnh: {uploaded_query_img.name}"
                    except Exception as ex:
                        st.error(f"Lỗi khi tìm kiếm: {ex}")
                    finally:
                        # Luôn dọn dẹp file tạm theo quy chuẩn
                        if temp_file.exists():
                            try:
                                os.remove(temp_file)
                            except Exception:
                                pass

    # ==========================================
    # HIỂN THỊ KẾT QUẢ TÌM KIẾM
    # ==========================================
    if results is not None:
        st.divider()
        st.markdown(
            f"##### 🎯 Kết quả tìm kiếm cho {query_display} "
            f"`({len(results)} kết quả trong {elapsed_ms:.1f}ms)`"
        )

        if not results:
            st.warning("Không tìm thấy sản phẩm nào khớp với tiêu chí tìm kiếm hoặc ngưỡng tương đồng.")
        else:
            cols_per_row = 3
            for i in range(0, len(results), cols_per_row):
                chunk = results[i:i + cols_per_row]
                grid_cols = st.columns(cols_per_row)

                for col, item in zip(grid_cols, chunk):
                    with col:
                        score = item.get("score", 0.0)
                        score_pct = max(0.0, min(1.0, score)) * 100
                        raw_img = item.get("image_path", "")
                        file_name = item.get("file_name", "Unknown")
                        catalog = item.get("catalog", "FASHION_PRODUCT")
                        item_id = item.get("id", "")

                        with st.container(border=True):
                            # Preview ảnh kết quả
                            resolved = resolve_image_path(raw_img)
                            if resolved:
                                try:
                                    st.image(str(resolved), width="stretch")
                                except Exception:
                                    st.warning("Lỗi hiển thị ảnh.")
                            else:
                                st.markdown(
                                    f"""<div style="height:140px; background:#f3f4f6; display:flex; align-items:center; justify-content:center; color:#9ca3af; border-radius:6px;">
                                        <span>📷 File ảnh: {file_name}</span>
                                    </div>""",
                                    unsafe_allow_html=True,
                                )

                            # Thanh điểm Cosine Similarity
                            st.progress(score_pct / 100.0)
                            st.markdown(f"**Độ tương đồng:** `{score:.4f}` ({score_pct:.1f}%)")

                            # Metadata
                            st.markdown(f"**{file_name}**")
                            st.markdown(f"{get_catalog_badge(catalog)}", unsafe_allow_html=True)
                            st.caption(f"ID: `{item_id[:16]}...`")
