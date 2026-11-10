import os
import sys
from pathlib import Path
from typing import List, Optional

# Đảm bảo đường dẫn gốc dự án nằm trong sys.path
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Cấu hình an toàn cho Console Windows (tránh lỗi UnicodeEncodeError cp1252)
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import torch
from src.core.config import settings
from src.repositories import get_image_repository
from src.services.point_service import PointService
from src.services.evaluation_service import EvaluationService
from src.utils.csv_helpers import get_available_test_images
from src.utils.formatters import format_percentage, format_score, format_latency
from src.utils.visualization import plot_benchmark_results
from test.benchmarks.search_cases import DEFAULT_BENCHMARK_CASES


def print_separator(char="=", length=92):
    print(char * length)


def safe_str(text: str, max_len: int = 30) -> str:
    """Cắt ngắn chuỗi an toàn."""
    if not text:
        return ""
    if len(text) > max_len:
        return text[:max_len - 3] + "..."
    return text


def ensure_test_data_seeded(collection_name: str) -> None:
    """Kiểm tra và tự động nạp 10 ảnh test vào Qdrant nếu Database chưa có dữ liệu."""
    repo = get_image_repository(collection_name)
    try:
        count = repo.count_points()
    except Exception as e:
        print(f"\n[!] Khong the ket noi den Qdrant: {e}")
        print("[!] Hay dam bao Docker Qdrant dang chay: docker-compose up -d\n")
        sys.exit(1)

    if count == 0:
        print("\n[*] Qdrant hien chua co du lieu. Dang tu dong nap 10 anh test vao Qdrant...")
        target_test_dir = ROOT_DIR / "dataset" / "test" / "images"
        PointService(collection_name=collection_name).batch_create_from_directory(
            target_dir=target_test_dir, batch_size=10
        )
        print("[*] Da nap xong du lieu test vao Qdrant!\n")


def run_benchmark(
    test_cases: Optional[List[dict]] = None,
    k_list: Optional[List[int]] = None,
    show_chart: bool = True,
    save_chart: bool = True,
) -> None:
    """Hàm chạy kiểm thử benchmark và in báo cáo ra console."""
    test_cases = test_cases or DEFAULT_BENCHMARK_CASES
    k_list = k_list or [1, 3, 5, 10]
    eval_service = EvaluationService()
    repo = get_image_repository(eval_service.collection_name)

    print_separator("=")
    print("      FASHION AI SEARCH ENGINE - BENCHMARK REPORT (Precision@K & Recall@K)")
    print_separator("=")

    # 1. Thông tin phần cứng & hệ thống
    is_cuda = torch.cuda.is_available()
    device_name = torch.cuda.get_device_name(0) if is_cuda else "CPU"

    # 2. Đảm bảo đã có dữ liệu test
    ensure_test_data_seeded(eval_service.collection_name)
    total_db_points = repo.count_points()
    avail_images = get_available_test_images()

    print(f"[*] Thiet bi tinh toan : {'CUDA (GPU)' if is_cuda else 'CPU'} - {device_name}")
    print(f"[*] Vector Database    : Qdrant ({settings.qdrant.host}:{settings.qdrant.grpc_port})")
    print(f"[*] Collection         : {repo.collection_name} (Vector Size: {settings.qdrant.vector_size})")
    print(f"[*] Tong so Points     : {total_db_points} records")
    print(f"[*] So anh tap Test    : {len(avail_images)} anh trong dataset/test/images/")
    print_separator("-")

    # 3. Chạy Benchmark qua EvaluationService
    sorted_k = sorted(k_list)
    print(f"[*] Dang thuc thi {len(test_cases)} kich ban kiem thu o cac moc K = {sorted_k}...")
    summary = eval_service.run_full_benchmark(test_cases=test_cases, k_list=sorted_k)

    # 4. Bảng chi tiết từng câu truy vấn (Sinh động theo k_list & chuẩn hóa %)
    headers = [f"{'Query':<28}", f"{'Target':<12}"]
    for k in sorted_k:
        headers.append(f"{f'P@{k}':>8}")
    for k in sorted_k:
        headers.append(f"{f'R@{k}':>8}")
    headers.append(f"{'AP':>8}")
    headers.append(f"{'Time':>9}")

    header_str = " | ".join(headers)
    table_width = max(92, len(header_str))

    print("\n" + "=" * table_width)
    print("                      CHI TIET TUNG CAU TRUY VAN (PER-QUERY BREAKDOWN)")
    print("=" * table_width)
    print(header_str)
    print("-" * table_width)

    for q_res in summary.query_results:
        cols = [f"{safe_str(q_res.query, 28):<28}", f"{q_res.target_label:<12}"]
        for k in sorted_k:
            m = q_res.metrics_at_k.get(k)
            cols.append(f"{format_percentage(m.precision if m else 0.0):>8}")
        for k in sorted_k:
            m = q_res.metrics_at_k.get(k)
            cols.append(f"{format_percentage(m.recall if m else 0.0):>8}")
        cols.append(f"{format_percentage(q_res.ap):>8}")
        cols.append(f"{format_latency(q_res.latency_ms):>9}")
        print(" | ".join(cols))

    # 5. Chi tiết các kết quả Hit / Miss cho từng Query
    print("\n" + "-" * table_width)
    print("                      DANH SACH RETRIEVED ITEMS & GROUND TRUTH MATCH")
    print("-" * table_width)
    for q_res in summary.query_results:
        print(f"\n>> Truy van: \"{q_res.query}\" (Ky vong: {q_res.target_label} - Tong dung trong DB: {q_res.total_relevant_in_db})")
        for rank, item in enumerate(q_res.retrieved_items[:5], 1):
            status_tag = "[HIT - DUNG]" if item.is_hit else "[MISS - SAI]"
            type_tag = item.article_type or "Unknown"
            disp = safe_str(item.display_name or "N/A", 40)
            score_str = format_score(item.score)
            print(f"   {rank}. {status_tag} Score: {score_str} | File: {item.file_name} | Type: {type_tag} | {disp}")

    # 6. Bảng KPI tổng kết toàn hệ thống (Chuẩn hóa % và độ trễ)
    print("\n" + "=" * table_width)
    print("                    TONG KET KPI HE THONG (GLOBAL BENCHMARK KPI)")
    print("=" * table_width)
    print(f"  * Tong so truy van kiem thu    : {summary.total_queries}")
    for k in sorted_k:
        p_val = summary.mean_precision_at_k.get(k, 0.0)
        print(f"  * Mean Precision@{k:<2} (P@{k:<2})   : {format_percentage(p_val):>8}")
    for k in sorted_k:
        r_val = summary.mean_recall_at_k.get(k, 0.0)
        print(f"  * Mean Recall@{k:<2} (R@{k:<2})      : {format_percentage(r_val):>8}")
    print(f"  * Mean Average Precision (mAP) : {format_percentage(summary.map_score):>8}  (Gold Metric)")
    print(f"  * Mean Reciprocal Rank (MRR)   : {format_percentage(summary.mrr_score):>8}")
    print(f"  * Thoi gian phan hoi trung binh: {format_latency(summary.avg_latency_ms):>8} / query")
    print("=" * table_width)

    # 7. Trực quan hóa biểu đồ Matplotlib (Interactive GUI & Xuất ảnh 300 DPI)
    plot_benchmark_results(
        summary=summary,
        k_list=sorted_k,
        show_chart=show_chart,
        save_chart=save_chart,
    )


def main():
    # =========================================================================
    # CẤU HÌNH BENCHMARK (CHỈNH SỬA TRỰC TIẾP TẠI ĐÂY)
    # =========================================================================
    # Danh sách các mốc K để đo Precision@K và Recall@K (chuẩn IR: 1, 3, 5, 10)
    k_list = [ 10,15,20]

    # Bộ ca kiểm thử sử dụng (DEFAULT_BENCHMARK_CASES gồm 143 ca kiểm thử)
    test_cases = DEFAULT_BENCHMARK_CASES

    # Cấu hình biểu đồ (Hiển thị popup Matplotlib và tự động lưu ảnh báo cáo 300 DPI)
    show_chart = True
    save_chart = True

    run_benchmark(
        test_cases=test_cases,
        k_list=k_list,
        show_chart=show_chart,
        save_chart=save_chart,
    )


if __name__ == "__main__":
    main()
