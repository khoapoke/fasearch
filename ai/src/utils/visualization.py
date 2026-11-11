"""Module trực quan hóa và kết xuất biểu đồ đánh giá chuẩn nghiên cứu khoa học.

Thiết kế phân tầng từ Vi mô đến Vĩ mô (Hierarchical Micro-to-Macro Framework):
1. Subplot (a) - Micro: Phân bổ chất lượng từng câu truy vấn (Query Performance Distribution).
2. Subplot (b) - Meso: Tương quan giữa Quy mô kho dữ liệu và Độ bao phủ (Catalog Size vs. Recall@K).
3. Subplot (c) - Error Analysis: Các danh mục có hiệu năng thấp nhất cần cải thiện (Bottlenecks).
4. Subplot (d) - Macro: Đánh giá tổng hợp Top-K toàn hệ thống bằng Trục kép (Dual Y-Axis P@K & R@K).

Tự động lưu ảnh chất lượng cao 300 DPI cho báo cáo học thuật và tích hợp hiển thị Matplotlib / Streamlit.
"""

from pathlib import Path
from typing import Any, Dict, List
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.ticker as mtick
from matplotlib.figure import Figure

from src.schemas.evaluation import BenchmarkSummary

# Xác định thư mục gốc của dự án
ROOT_DIR = Path(__file__).resolve().parents[2]


def create_benchmark_figure(
    summary: BenchmarkSummary,
    k_list: List[int],
) -> Figure:
    """Khởi tạo Dashboard 2x2 chứa 4 biểu đồ phân tích chuẩn khoa học (IEEE/ACM style).

    Hàm thuần túy sinh Figure và không gọi plt.show() hay plt.close(),
    giúp tái sử dụng linh hoạt trên cả Streamlit Admin UI (st.pyplot(fig)) và CLI scripts.
    """
    sorted_k = sorted(k_list)
    max_k = sorted_k[-1] if sorted_k else 10
    total_queries = max(1, summary.total_queries)

    # Khởi tạo khung hình 2 hàng x 2 cột (Dashboard chuẩn báo cáo)
    fig, axs = plt.subplots(nrows=2, ncols=2, figsize=(18, 12))
    fig.patch.set_facecolor("#ffffff")
    fig.suptitle(
        "Fashion AI Search Engine - Multi-Level Benchmark & Error Analysis",
        fontsize=16,
        fontweight="bold",
        y=0.98,
    )

    ax1, ax2 = axs[0, 0], axs[0, 1]
    ax3, ax4 = axs[1, 0], axs[1, 1]

    # =========================================================================
    # SUBPLOT 1 (Top-Left): Phân bổ chất lượng từng câu truy vấn (Query Tiers)
    # =========================================================================
    tier_counts = {
        "Perfect (100%)": 0,
        "Good (75-99%)": 0,
        "Fair (50-74%)": 0,
        "Poor (<50%)": 0,
    }
    for q in summary.query_results:
        ap_pct = q.ap * 100
        if ap_pct >= 99.9:
            tier_counts["Perfect (100%)"] += 1
        elif ap_pct >= 75.0:
            tier_counts["Good (75-99%)"] += 1
        elif ap_pct >= 50.0:
            tier_counts["Fair (50-74%)"] += 1
        else:
            tier_counts["Poor (<50%)"] += 1

    tier_labels = list(tier_counts.keys())
    tier_vals = list(tier_counts.values())
    tier_colors = ["#2ca02c", "#1f77b4", "#ff7f0e", "#d62728"]

    bars1 = ax1.bar(tier_labels, tier_vals, color=tier_colors, width=0.55, edgecolor="#333333", linewidth=1)
    for bar in bars1:
        height = bar.get_height()
        pct = (height / total_queries) * 100
        ax1.annotate(
            f"{height}\n({pct:.1f}%)",
            xy=(bar.get_x() + bar.get_width() / 2, height),
            xytext=(0, 5),
            textcoords="offset points",
            ha="center",
            va="bottom",
            fontsize=9.5,
            fontweight="bold",
        )

    ax1.set_title("(a) Query Performance Tier Breakdown (AP)", fontsize=13, fontweight="bold", pad=12)
    ax1.set_ylabel("Number of Queries", fontsize=11, fontweight="medium")
    ax1.set_ylim(0, max(tier_vals) * 1.25 if tier_vals and max(tier_vals) > 0 else 10)
    ax1.grid(True, linestyle=":", alpha=0.6, color="#b0b0b0", axis="y")

    # =========================================================================
    # SUBPLOT 2 (Top-Right): Tương quan Quy mô kho dữ liệu vs Recall@K
    # Giải thích toán học tại sao Recall thấp khi kho dữ liệu lớn
    # =========================================================================
    cat_db_stats: Dict[str, Dict[str, Any]] = {}
    for q in summary.query_results:
        cat = q.target_label or "Unknown"
        m = q.metrics_at_k.get(max_k)
        recall_pct = (m.recall if m else 0.0) * 100
        if cat not in cat_db_stats:
            cat_db_stats[cat] = {
                "total_in_db": q.total_relevant_in_db,
                "recalls": [recall_pct],
            }
        else:
            cat_db_stats[cat]["recalls"].append(recall_pct)

    scatter_cats = []
    scatter_db_sizes = []
    scatter_recalls = []
    for cat, info in cat_db_stats.items():
        if info["total_in_db"] > 0:
            scatter_cats.append(cat)
            scatter_db_sizes.append(info["total_in_db"])
            scatter_recalls.append(float(np.mean(info["recalls"])))

    if scatter_db_sizes:
        ax2.scatter(
            scatter_db_sizes,
            scatter_recalls,
            color="#17becf",
            edgecolor="#0f7480",
            s=80,
            alpha=0.85,
            zorder=3,
            label=f"Observed Categories (Mean R@{max_k})",
        )

        # Vẽ đường trần lý thuyết: Max Possible Recall = min(100, (K / Total_in_DB) * 100)
        x_min = max(1, min(scatter_db_sizes))
        x_max = max(scatter_db_sizes)
        x_curve = np.logspace(np.log10(x_min), np.log10(x_max), 200)
        y_theoretical = np.minimum(100.0, (max_k / x_curve) * 100.0)
        ax2.plot(
            x_curve,
            y_theoretical,
            color="#d62728",
            linestyle="--",
            linewidth=1.8,
            label=f"Theoretical Max Recall Ceiling at K={max_k}",
            zorder=2,
        )

        # Gắn nhãn một số danh mục tiêu biểu (cực đại, cực tiểu và trung bình)
        sample_indices = sorted(
            range(len(scatter_db_sizes)),
            key=lambda i: scatter_db_sizes[i],
        )
        highlighted_idx = set()
        if sample_indices:
            highlighted_idx.add(sample_indices[0])  # Kho nhỏ nhất
            highlighted_idx.add(sample_indices[-1])  # Kho lớn nhất
            if len(sample_indices) > 2:
                highlighted_idx.add(sample_indices[len(sample_indices) // 2])  # Kho trung bình
            # Thêm tối đa 2 danh mục có recall cao
            for idx in sorted(range(len(scatter_recalls)), key=lambda i: scatter_recalls[i], reverse=True)[:2]:
                highlighted_idx.add(idx)

        for idx in highlighted_idx:
            c_name = scatter_cats[idx]
            db_size = scatter_db_sizes[idx]
            r_val = scatter_recalls[idx]
            ax2.annotate(
                f"{c_name}\n({db_size} items -> {r_val:.1f}%)",
                (db_size, r_val),
                xytext=(5, 6),
                textcoords="offset points",
                fontsize=8.5,
                bbox=dict(boxstyle="round,pad=0.2", facecolor="#ffffff", edgecolor="#b0b0b0", alpha=0.85),
            )

        ax2.set_xscale("log")
        # Thiết lập các mốc đo cụ thể và định dạng số nguyên dễ đọc thay cho 10^3
        candidate_ticks = [100, 200, 500, 1000, 2000, 5000, 10000]
        valid_ticks = [t for t in candidate_ticks if (x_min * 0.6) <= t <= (x_max * 1.5)]
        if len(valid_ticks) >= 3:
            ax2.set_xticks(valid_ticks)
            ax2.xaxis.set_major_formatter(mtick.FuncFormatter(lambda val, _: f"{int(val):,}"))
        else:
            ax2.xaxis.set_major_formatter(mtick.ScalarFormatter())
        ax2.xaxis.set_minor_formatter(mtick.NullFormatter())

        ax2.set_title(f"(b) Catalog Scale vs. Recall@{max_k} (Theoretical Ceiling)", fontsize=13, fontweight="bold", pad=12)
        ax2.set_xlabel("Relevant Items in Database (Log Scale)", fontsize=11, fontweight="medium")
        ax2.set_ylabel(f"Mean Recall@{max_k} (%)", fontsize=11, fontweight="medium")
        ax2.yaxis.set_major_formatter(mtick.PercentFormatter(xmax=100))
        ax2.grid(True, linestyle=":", alpha=0.6, color="#b0b0b0")
        ax2.legend(loc="upper right", frameon=True, facecolor="#f8f9fa", edgecolor="#cccccc", fontsize=9.5)
    else:
        ax2.text(0.5, 0.5, "No Catalog Size Data Available", ha="center", va="center")

    # =========================================================================
    # SUBPLOT 3 (Bottom-Left): Phân tích lỗi (Lowest Performing Categories)
    # =========================================================================
    category_aps: Dict[str, List[float]] = {}
    for q in summary.query_results:
        label = q.target_label or "Unknown"
        category_aps.setdefault(label, []).append(q.ap)
    cat_means = {cat: (sum(aps) / len(aps)) * 100 for cat, aps in category_aps.items()}

    # Lấy 10 danh mục có điểm thấp nhất để phục vụ phân tích điểm nghẽn
    sorted_asc = sorted(cat_means.items(), key=lambda x: x[1])
    bottleneck_cats = sorted_asc[:10]
    b_names = [item[0] for item in bottleneck_cats]
    b_scores = [item[1] for item in bottleneck_cats]

    if b_names:
        # Màu đỏ/cam nếu dưới trung bình, màu xanh nếu đạt chuẩn
        bar_colors = ["#d62728" if s < summary.map_score * 100 else "#1f77b4" for s in b_scores]
        bars3 = ax3.barh(b_names, b_scores, color=bar_colors, height=0.55, edgecolor="#333333", linewidth=1)

        ax3.axvline(
            summary.map_score * 100,
            color="#d62728",
            linestyle="--",
            linewidth=1.8,
            label=f"Global mAP ({summary.map_score * 100:.1f}%)",
        )

        for bar in bars3:
            width = bar.get_width()
            ax3.text(
                width + 1.2,
                bar.get_y() + bar.get_height() / 2,
                f"{width:.1f}%",
                va="center",
                ha="left",
                fontsize=9,
                fontweight="bold",
                color="#333333",
            )

        ax3.set_xlim(0, 115)
        ax3.set_title("(c) Error Analysis: Lowest Performing Categories (mAP)", fontsize=13, fontweight="bold", pad=12)
        ax3.set_xlabel("Mean Average Precision (%)", fontsize=11, fontweight="medium")
        ax3.xaxis.set_major_formatter(mtick.PercentFormatter(xmax=100))
        ax3.grid(True, linestyle=":", alpha=0.6, color="#b0b0b0", axis="x")
        ax3.legend(loc="lower right", frameon=True, facecolor="#f8f9fa", edgecolor="#cccccc", fontsize=9.5)
    else:
        ax3.text(0.5, 0.5, "No Category Data Available", ha="center", va="center")

    # =========================================================================
    # SUBPLOT 4 (Bottom-Right): Tổng hợp toàn hệ thống (Dual Y-Axis P@K & R@K)
    # =========================================================================
    precisions = [summary.mean_precision_at_k.get(k, 0.0) * 100 for k in sorted_k]
    recalls = [summary.mean_recall_at_k.get(k, 0.0) * 100 for k in sorted_k]

    color_p = "#1f77b4"
    color_r = "#2ca02c"

    # Trục Y bên trái cho Precision
    line_p = ax4.plot(
        sorted_k,
        precisions,
        marker="o",
        linewidth=2.2,
        markersize=7,
        color=color_p,
        label="Precision@K (Left Axis)",
    )
    ax4.set_xlabel("Top-K Cutoff (K)", fontsize=11, fontweight="medium")
    ax4.set_ylabel("Mean Precision@K (%)", fontsize=11, fontweight="medium", color=color_p)
    ax4.set_xticks(sorted_k)
    ax4.set_ylim(-5, 115)
    ax4.yaxis.set_major_formatter(mtick.PercentFormatter(xmax=100))
    ax4.tick_params(axis="y", labelcolor=color_p)
    ax4.grid(True, linestyle=":", alpha=0.6, color="#b0b0b0")

    # Nhãn số liệu cho Precision
    for k, p in zip(sorted_k, precisions):
        ax4.annotate(
            f"{p:.1f}%",
            (k, p),
            textcoords="offset points",
            xytext=(0, 9),
            ha="center",
            fontsize=9,
            fontweight="bold",
            color=color_p,
        )

    # Trục Y bên phải cho Recall (Trục kép độc lập, tránh bị bẹp dúm ở 0%)
    ax4_recall = ax4.twinx()
    max_rec = max(recalls) if recalls else 1.0
    rec_upper = max(2.5, max_rec * 1.4)
    line_r = ax4_recall.plot(
        sorted_k,
        recalls,
        marker="s",
        linewidth=2.2,
        linestyle="--",
        markersize=7,
        color=color_r,
        label="Recall@K (Right Axis)",
    )
    ax4_recall.set_ylabel("Mean Recall@K (%)", fontsize=11, fontweight="medium", color=color_r)
    ax4_recall.set_ylim(0, rec_upper)
    ax4_recall.yaxis.set_major_formatter(mtick.PercentFormatter(xmax=100))
    ax4_recall.tick_params(axis="y", labelcolor=color_r)

    # Nhãn số liệu cho Recall đặt lệch lên trên để không đè trục hoành
    for k, r in zip(sorted_k, recalls):
        ax4_recall.annotate(
            f"{r:.2f}%",
            (k, r),
            textcoords="offset points",
            xytext=(0, 10),
            ha="center",
            fontsize=9,
            fontweight="bold",
            color=color_r,
        )

    # Gộp 2 Legend của 2 trục thành 1 khung
    lines = line_p + line_r
    labels = [l.get_label() for l in lines]
    ax4.legend(lines, labels, loc="lower right", frameon=True, facecolor="#f8f9fa", edgecolor="#cccccc", fontsize=9.5)

    ax4.set_title("(d) Macro Top-K Performance (Dual-Axis Scale)", fontsize=13, fontweight="bold", pad=12)

    # Hộp thông số KPI toàn hệ thống
    summary_box = (
        f"Global KPIs:\n"
        f"• mAP: {summary.map_score * 100:.2f}%\n"
        f"• MRR: {summary.mrr_score * 100:.2f}%\n"
        f"• Latency: {summary.avg_latency_ms:.1f} ms"
    )
    ax4.text(
        0.04,
        0.95,
        summary_box,
        transform=ax4.transAxes,
        fontsize=9.5,
        verticalalignment="top",
        bbox=dict(boxstyle="round,pad=0.6", facecolor="#f8f9fa", edgecolor="#d0d0d0", alpha=0.9),
    )

    plt.tight_layout(rect=[0, 0.03, 1, 0.96])
    return fig


def plot_benchmark_results(
    summary: BenchmarkSummary,
    k_list: List[int],
    show_chart: bool = True,
    save_chart: bool = True,
) -> Figure:
    """Tạo biểu đồ phân tầng 2x2, lưu file 300 DPI và mở cửa sổ tương tác Matplotlib GUI."""
    fig = create_benchmark_figure(summary=summary, k_list=k_list)

    if save_chart:
        report_dir = ROOT_DIR / "storage" / "reports"
        report_dir.mkdir(parents=True, exist_ok=True)
        chart_path = report_dir / "benchmark_charts.png"
        fig.savefig(chart_path, dpi=300, bbox_inches="tight")
        print(f"\n[*] Da xuat bieu do danh gia da tang (300 DPI) tai: {chart_path}")

    if show_chart:
        print("[*] Dang mo cua so bieu do Matplotlib (Interactive GUI)...")
        plt.show()
    else:
        plt.close(fig)

    return fig
