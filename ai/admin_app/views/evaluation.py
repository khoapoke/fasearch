from pathlib import Path
from typing import Dict, List, Optional
import pandas as pd
import streamlit as st

from src.core.config import BASE_DIR
from src.db.enums import PointStatus
from src.services.point_service import PointService
from src.services.evaluation_service import EvaluationService
from src.utils.csv_helpers import load_ground_truth, get_available_article_types
from test.benchmarks.search_cases import (
    DEFAULT_BENCHMARK_CASES,
    CORE_SEARCH_BENCHMARK_CASES,
    FULL_SEARCH_BENCHMARK_CASES,
    get_benchmark_cases,
)
from src.utils.formatters import format_percentage, format_score, format_latency
from admin_app.components.ui_helpers import resolve_image_path, open_csv_file_dialog


def render_evaluation(eval_srv: EvaluationService, point_srv: PointService) -> None:
    """
    Trang 4: Môi trường Đánh giá Chỉ số Hệ thống (Evaluation & Benchmark Playground).
    Đo lường các chỉ số Precision@K, Recall@K, mAP, MRR và Latency trên collection được chọn.
    """
    current_col = eval_srv.collection_name

    st.subheader(f"Môi trường Đánh giá Chỉ số Hệ thống — Collection: `{current_col}`")
    st.caption(
        "Đo lường độ chính xác (Precision@K, Recall@K), mAP (Mean Average Precision), "
        "MRR (Mean Reciprocal Rank) và thời gian phản hồi (Latency) dựa trên Ground Truth từ file styles.csv."
    )

    # 1. Kiểm tra số lượng Point hợp lệ trong Collection (loại trừ DELETED)
    try:
        active_count = point_srv.repo.count_points(PointStatus.ACTIVE)
        seeded_count = point_srv.repo.count_points(PointStatus.SEEDED)
        valid_points = active_count + seeded_count
    except Exception as ex:
        st.error(f"Lỗi khi kiểm tra dữ liệu trong collection '{current_col}': {ex}")
        return

    if valid_points == 0:
        st.info(
            f"Chưa có bản ghi hoặc dữ liệu hợp lệ trong collection '{current_col}' để thử nghiệm đánh giá. "
            "Vui lòng nạp dữ liệu vào collection này trước tại tab 'Tổng quan & Cấu hình'."
        )
        return

    # 2. Cấu hình file nhãn Ground Truth (styles.csv)
    default_csv = str(BASE_DIR / "dataset" / "test" / "styles.csv")
    if "eval_gt_csv_path" not in st.session_state:
        st.session_state["eval_gt_csv_path"] = default_csv

    with st.expander("Cấu hình File nhãn Ground Truth (styles.csv)", expanded=False):
        col_c1, col_c2 = st.columns([3, 1])
        with col_c1:
            if st.button("Mở cửa sổ Browse chọn file CSV nhãn (Windows)", width="stretch", type="secondary"):
                initial_dir = Path(st.session_state["eval_gt_csv_path"]).parent
                selected_csv = open_csv_file_dialog(initial_dir=initial_dir)
                if selected_csv:
                    st.session_state["eval_gt_csv_path"] = selected_csv
                    st.rerun()
        with col_c2:
            if st.button("CSV Mặc định", width="stretch", help="Khôi phục về styles.csv mặc định"):
                st.session_state["eval_gt_csv_path"] = default_csv
                st.rerun()

        st.text_input(
            "Đường dẫn file nhãn Ground Truth (.csv):",
            key="eval_gt_csv_path",
        )

    current_csv_path = Path(st.session_state["eval_gt_csv_path"])
    gt_map = load_ground_truth(current_csv_path)
    available_article_types = get_available_article_types(current_csv_path)

    # Thẻ thông tin môi trường đánh giá
    with st.container(border=True):
        col_m1, col_m2, col_m3 = st.columns(3)
        with col_m1:
            st.markdown(f"**Collection:** `{current_col}`")
            st.caption(f"Points hợp lệ: **{valid_points:,}** (Active: {active_count}, Seeded: {seeded_count})")
        with col_m2:
            st.markdown(f"**File Ground Truth:** `{current_csv_path.name}`")
            st.caption(f"Tổng số nhãn nạp: **{len(gt_map):,}** sản phẩm")
        with col_m3:
            st.markdown("**Số loại trang phục (Article Types):**")
            st.caption(f"**{len(available_article_types)}** danh mục nhãn chuẩn")

    st.divider()

    # 3. Phân chia 2 chế độ đánh giá bằng Tabs
    tab_suite, tab_custom = st.tabs(
        [
            "Đánh giá Toàn diện (Default Benchmark Suite)",
            "Thử nghiệm Truy vấn Tùy chỉnh (Single Query Eval)",
        ]
    )

    # =========================================================================
    # TAB 1: ĐÁNH GIÁ TOÀN DIỆN (BENCHMARK SUITE)
    # =========================================================================
    with tab_suite:
        suite_mode = st.radio(
            "Phạm vi kịch bản kiểm thử:",
            options=[
                f"Trọng tâm ({len(CORE_SEARCH_BENCHMARK_CASES)} ngành hàng chính - >96% dữ liệu)",
                f"Toàn diện (Tất cả {len(FULL_SEARCH_BENCHMARK_CASES)} danh mục trong styles.csv)",
            ],
            index=0,
            horizontal=True,
            help="Chọn bộ kịch bản kiểm thử mong muốn. Toàn bộ câu truy vấn đã được chuẩn hóa tiếng Anh cho mô hình CLIP.",
        )
        active_cases = (
            CORE_SEARCH_BENCHMARK_CASES
            if "Trọng tâm" in suite_mode
            else FULL_SEARCH_BENCHMARK_CASES
        )

        st.markdown(f"##### Danh sách ca kiểm thử ({len(active_cases)} kịch bản):")

        # Hiển thị tóm tắt các ca kiểm thử
        suite_df = pd.DataFrame(
            [
                {
                    "STT": idx + 1,
                    "Câu truy vấn (Query)": c["query"],
                    "Nhãn kỳ vọng (Target)": c["target_article_type"],
                    "Mô tả mục đích": c["description"],
                }
                for idx, c in enumerate(active_cases)
            ]
        )
        st.dataframe(suite_df, hide_index=True, width="stretch")

        col_k_cfg, col_btn_run = st.columns([3, 1])
        with col_k_cfg:
            selected_k_values = st.multiselect(
                "Các ngưỡng Top K cần đánh giá:",
                options=[1, 3, 5, 10, 15, 20],
                default=[1, 3, 5, 10],
                help="Tính Precision và Recall tại các điểm cắt K này.",
            )
        with col_btn_run:
            st.write("")
            st.write("")
            btn_run_suite = st.button("Chạy Đánh giá Hệ thống", type="primary", width="stretch")

        # Session state key lưu kết quả benchmark theo collection
        suite_cache_key = f"benchmark_summary_{current_col}"

        if btn_run_suite:
            if not selected_k_values:
                st.error("Vui lòng chọn ít nhất một ngưỡng K để đánh giá.")
            else:
                with st.spinner(f"Đang thực thi {len(active_cases)} kịch bản kiểm thử trên collection '{current_col}'..."):
                    try:
                        summary = eval_srv.run_full_benchmark(
                            test_cases=active_cases,
                            k_list=sorted(selected_k_values),
                            csv_path=current_csv_path,
                        )
                        st.session_state[suite_cache_key] = summary
                        st.toast("Đã hoàn tất đánh giá hệ thống!")
                    except Exception as ex:
                        st.error(f"Lỗi khi thực thi benchmark: {ex}")

        # Hiển thị kết quả tổng hợp nếu đã có
        summary_res = st.session_state.get(suite_cache_key)
        if summary_res:
            st.divider()
            st.markdown(f"#### Báo cáo Chỉ số Hệ thống — Collection: `{current_col}`")

            # 4 Thẻ KPI chính (Chuẩn hóa %)
            kpi_col1, kpi_col2, kpi_col3, kpi_col4 = st.columns(4)
            with kpi_col1:
                st.metric(
                    label="mAP (Mean Average Precision)",
                    value=format_percentage(summary_res.map_score),
                    help="mAP (Mean Average Precision): Trung bình cộng (Mean) điểm AP của toàn bộ các câu truy vấn. Thước đo vàng đánh giá chất lượng xếp hạng tổng thể của hệ thống Search.",
                )
            with kpi_col2:
                st.metric(
                    label="MRR (Mean Reciprocal Rank)",
                    value=format_percentage(summary_res.mrr_score),
                    help="MRR (Mean Reciprocal Rank): Trung bình cộng (Mean) điểm RR của toàn bộ các câu truy vấn. Đo lường mức độ ưu tiên đưa kết quả đúng lên vị trí số #1 của toàn hệ thống.",
                )
            with kpi_col3:
                active_k = sorted(list(summary_res.mean_precision_at_k.keys()))
                if len(active_k) == 1:
                    k_tgt = active_k[0]
                    st.metric(
                        label=f"Mean P@{k_tgt} / R@{k_tgt}",
                        value=f"{format_percentage(summary_res.mean_precision_at_k.get(k_tgt, 0.0))} / {format_percentage(summary_res.mean_recall_at_k.get(k_tgt, 0.0))}",
                        help=f"Mean Precision@{k_tgt} và Mean Recall@{k_tgt} qua toàn bộ các câu truy vấn.",
                    )
                else:
                    k_first, k_last = active_k[0], active_k[-1]
                    st.metric(
                        label=f"Mean P@{k_first} / P@{k_last}",
                        value=f"{format_percentage(summary_res.mean_precision_at_k.get(k_first, 0.0))} / {format_percentage(summary_res.mean_precision_at_k.get(k_last, 0.0))}",
                        help=f"Mean Precision tại K={k_first} và K={k_last} qua toàn bộ các câu truy vấn.",
                    )
            with kpi_col4:
                st.metric(
                    label="Độ trễ trung bình",
                    value=format_latency(summary_res.avg_latency_ms),
                    help="Mean Latency: Thời gian phản hồi tìm kiếm trung bình (ms) cho mỗi câu truy vấn.",
                )

            # Bảng chi tiết từng câu truy vấn (Sinh động theo k_list & đầy đủ Precision/Recall)
            st.markdown("##### Chi tiết từng câu truy vấn (Per-query Breakdown):")
            active_k_list = sorted(list(summary_res.mean_precision_at_k.keys()))
            rows = []
            for q in summary_res.query_results:
                row_data = {
                    "Câu truy vấn": q.query,
                    "Nhãn kỳ vọng": q.target_label,
                    "Tổng đúng trong DB": f"{q.total_relevant_in_db:,}",
                }
                # Thêm đầy đủ Precision@K cho mọi K được chọn
                for k in active_k_list:
                    m = q.metrics_at_k.get(k)
                    row_data[f"P@{k}"] = format_percentage(m.precision if m else 0.0)
                # Thêm đầy đủ Recall@K cho mọi K được chọn
                for k in active_k_list:
                    m = q.metrics_at_k.get(k)
                    row_data[f"R@{k}"] = format_percentage(m.recall if m else 0.0)

                row_data["AP"] = format_percentage(q.ap)
                row_data["RR"] = format_percentage(q.rr)
                row_data["Độ trễ"] = format_latency(q.latency_ms)
                rows.append(row_data)

            table_df = pd.DataFrame(rows)
            st.dataframe(table_df, hide_index=True, width="stretch")

            # Khối phân tích trực quan kết quả Hit / Miss
            st.divider()
            st.markdown("##### Kiểm tra trực quan kết quả truy vấn (Hit / Miss Inspection):")

            query_options = {q.query: q for q in summary_res.query_results}
            selected_query_key = st.selectbox(
                "Chọn câu truy vấn để xem chi tiết ảnh trả về:",
                options=list(query_options.keys()),
            )

            chosen_q_res = query_options[selected_query_key]
            st.caption(
                f"Truy vấn: **\"{chosen_q_res.query}\"** | "
                f"Kỳ vọng: **{chosen_q_res.target_label}** | "
                f"Tổng đúng trong DB: **{chosen_q_res.total_relevant_in_db:,}** | "
                f"AP: **{format_percentage(chosen_q_res.ap)}** | "
                f"RR: **{format_percentage(chosen_q_res.rr)}**"
            )

            if not chosen_q_res.retrieved_items:
                st.warning("Không có kết quả nào được trả về.")
            else:
                grid_cols = st.columns(min(5, len(chosen_q_res.retrieved_items)))
                for rank, item in enumerate(chosen_q_res.retrieved_items, start=1):
                    col = grid_cols[(rank - 1) % len(grid_cols)]
                    with col:
                        img_path = item.image_path or f"/dataset/test/images/{item.file_name}"
                        resolved = resolve_image_path(img_path)

                        border_color = "#059669" if item.is_hit else "#dc2626"
                        bg_badge = "#ecfdf5" if item.is_hit else "#fef2f2"
                        label_hit = "HIT - DUNG" if item.is_hit else "MISS - SAI"

                        with st.container(border=True):
                            if resolved and resolved.exists():
                                try:
                                    st.image(str(resolved), width="stretch")
                                except Exception:
                                    st.caption(item.file_name)
                            else:
                                st.caption(item.file_name)

                            st.markdown(
                                f"""<div style="text-align:center; margin: 4px 0;">
                                    <span style="
                                        display: inline-block;
                                        padding: 2px 6px;
                                        border-radius: 4px;
                                        font-size: 11px;
                                        font-weight: 700;
                                        color: {border_color};
                                        background-color: {bg_badge};
                                        border: 1px solid {border_color};
                                    ">{label_hit} (Rank #{rank})</span>
                                </div>""",
                                unsafe_allow_html=True,
                            )
                            st.caption(f"Score: `{format_score(item.score)}`")
                            st.caption(f"Loại: **{item.article_type or 'Unknown'}**")
                            if item.display_name:
                                st.caption(f"Tên: {item.display_name[:24]}...")

    # =========================================================================
    # TAB 2: TRUY VẤN TÙY CHỈNH (SINGLE QUERY EVALUATION)
    # =========================================================================
    with tab_custom:
        st.markdown("##### Thử nghiệm đánh giá câu truy vấn bất kỳ:")
        st.caption("Nhập câu mô tả tự do và chọn nhãn danh mục kỳ vọng từ Ground Truth để đo lường.")

        with st.form("custom_eval_form"):
            custom_q_text = st.text_input(
                "Câu truy vấn kiểm thử (Query Text):",
                placeholder="vd: áo sơ mi nam dài tay, black sports track pants, đồng hồ thể thao...",
            )

            col_sub1, col_sub2 = st.columns(2)
            with col_sub1:
                def_idx = available_article_types.index("Shirts") if "Shirts" in available_article_types else 0
                custom_target_type = st.selectbox(
                    "Nhãn danh mục kỳ vọng (Target Article Type):",
                    options=available_article_types,
                    index=def_idx,
                    help="Hệ thống sẽ đối chiếu nhãn này với trường articleType trong styles.csv để xác định HIT / MISS.",
                )
            with col_sub2:
                custom_top_k = st.slider("Số lượng kết quả cần lấy (Limit):", min_value=1, max_value=20, value=6)

            btn_submit_custom = st.form_submit_button("Đánh giá Truy vấn Này", type="primary")

        custom_cache_key = f"custom_eval_{current_col}"

        if btn_submit_custom:
            clean_q = custom_q_text.strip()
            if not clean_q:
                st.error("Vui lòng nhập câu truy vấn kiểm thử.")
            else:
                with st.spinner(f"Đang tìm kiếm và đánh giá câu truy vấn trong '{current_col}'..."):
                    try:
                        res = eval_srv.evaluate_query(
                            query_text=clean_q,
                            target_article_type=custom_target_type,
                            limit=custom_top_k,
                            csv_path=current_csv_path,
                        )
                        st.session_state[custom_cache_key] = res
                        st.toast("Đã hoàn tất đánh giá câu truy vấn!")
                    except Exception as ex:
                        st.error(f"Lỗi khi đánh giá truy vấn: {ex}")

        # Hiển thị kết quả truy vấn tùy chỉnh
        custom_res = st.session_state.get(custom_cache_key)
        if custom_res:
            st.divider()
            st.markdown(f"#### Kết quả Đánh giá cho: *\"{custom_res.query}\"*")
            st.caption(f"Nhãn kỳ vọng: **{custom_res.target_label}** | Tổng sản phẩm đúng trong DB: **{custom_res.total_relevant_in_db:,}**")

            # Chỉ số chi tiết
            metric_k = custom_res.get_metric_at_k(custom_top_k)

            cq_col1, cq_col2, cq_col3, cq_col4, cq_col5 = st.columns(5)
            with cq_col1:
                st.metric(
                    label="AP",
                    value=format_percentage(custom_res.ap),
                    help="Average Precision: Điểm số đánh giá chất lượng xếp hạng của 1 câu truy vấn này.",
                )
            with cq_col2:
                first_hit_str = f"Rank #{int(1 / custom_res.rr)}" if custom_res.rr > 0 else "Không tìm thấy"
                st.metric(
                    label="RR",
                    value=format_percentage(custom_res.rr),
                    delta=first_hit_str,
                    help="Reciprocal Rank: chỉ số đánh giá kết quả ",
                )
            with cq_col3:
                st.metric(
                    label=f"Precision@{custom_top_k}",
                    value=format_percentage(metric_k.precision),
                    help=f"Precision@{custom_top_k}: Tỷ lệ % sản phẩm đúng nhãn trong số {custom_top_k} kết quả hiển thị trên màn hình ({metric_k.hit_count}/{custom_top_k} đúng).",
                )
            with cq_col4:
                st.metric(
                    label=f"Recall@{custom_top_k}",
                    value=format_percentage(metric_k.recall),
                    help=f"Recall@{custom_top_k}: Tỷ lệ % sản phẩm đúng tìm thấy ({metric_k.hit_count} sản phẩm) trên tổng số {custom_res.total_relevant_in_db:,} sản phẩm đúng có trong cơ sở dữ liệu.",
                )
            with cq_col5:
                st.metric(
                    label="Thời gian phản hồi",
                    value=format_latency(custom_res.latency_ms),
                    help="Query Latency: Thời gian AI trích xuất vector CLIP và truy vấn Qdrant cho câu này tính bằng mili-giây.",
                )

            # Hiển thị danh sách ảnh kết quả
            st.markdown("##### Danh sách sản phẩm được xếp hạng trả về:")
            if not custom_res.retrieved_items:
                st.warning("Không có kết quả nào được trả về từ cơ sở dữ liệu.")
            else:
                grid_cols = st.columns(min(5, len(custom_res.retrieved_items)))
                for rank, item in enumerate(custom_res.retrieved_items, start=1):
                    col = grid_cols[(rank - 1) % len(grid_cols)]
                    with col:
                        img_path = item.image_path or f"/dataset/test/images/{item.file_name}"
                        resolved = resolve_image_path(img_path)

                        border_color = "#059669" if item.is_hit else "#dc2626"
                        bg_badge = "#ecfdf5" if item.is_hit else "#fef2f2"
                        label_hit = "HIT - DUNG" if item.is_hit else "MISS - SAI"

                        with st.container(border=True):
                            if resolved and resolved.exists():
                                try:
                                    st.image(str(resolved), width="stretch")
                                except Exception:
                                    st.caption(item.file_name)
                            else:
                                st.caption(item.file_name)

                            st.markdown(
                                f"""<div style="text-align:center; margin: 4px 0;">
                                    <span style="
                                        display: inline-block;
                                        padding: 2px 6px;
                                        border-radius: 4px;
                                        font-size: 11px;
                                        font-weight: 700;
                                        color: {border_color};
                                        background-color: {bg_badge};
                                        border: 1px solid {border_color};
                                    ">{label_hit} (Rank #{rank})</span>
                                </div>""",
                                unsafe_allow_html=True,
                            )
                            st.caption(f"Score: `{format_score(item.score)}`")
                            st.caption(f"Loại: **{item.article_type or 'Unknown'}**")
                            if item.display_name:
                                st.caption(f"Tên: {item.display_name[:24]}...")
