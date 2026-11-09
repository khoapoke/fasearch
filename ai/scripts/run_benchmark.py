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
    print(f"[*] Dang thuc thi {len(test_cases)} kich ban kiem thu o cac moc K = {k_list}...")
    summary = eval_service.run_full_benchmark(test_cases=test_cases, k_list=k_list)

    # 4. Bảng chi tiết từng câu truy vấn
    print("\n" + "=" * 92)
    print("                      CHI TIET TUNG CAU TRUY VAN (PER-QUERY BREAKDOWN)")
    print("=" * 92)
    header = f"{'Query':<32} | {'Target':<12} | {'P@1':<5} | {'P@3':<5} | {'P@5':<5} | {'P@10':<5} | {'R@5':<5} | {'AP':<5} | {'Time'}"
    print(header)
    print("-" * 92)

    for q_res in summary.query_results:
        p1 = q_res.metrics_at_k.get(1).precision if 1 in q_res.metrics_at_k else 0.0
        p3 = q_res.metrics_at_k.get(3).precision if 3 in q_res.metrics_at_k else 0.0
        p5 = q_res.metrics_at_k.get(5).precision if 5 in q_res.metrics_at_k else 0.0
        p10 = q_res.metrics_at_k.get(10).precision if 10 in q_res.metrics_at_k else 0.0
        r5 = q_res.metrics_at_k.get(5).recall if 5 in q_res.metrics_at_k else 0.0

        q_name = safe_str(q_res.query, 32)
        row = (
            f"{q_name:<32} | "
            f"{q_res.target_label:<12} | "
            f"{p1:>5.2f} | "
            f"{p3:>5.2f} | "
            f"{p5:>5.2f} | "
            f"{p10:>5.2f} | "
            f"{r5:>5.2f} | "
            f"{q_res.ap:>5.2f} | "
            f"{q_res.latency_ms:>5.1f}ms"
        )
        print(row)

    # 5. Chi tiết các kết quả Hit / Miss cho từng Query
    print("\n" + "-" * 92)
    print("                      DANH SACH RETRIEVED ITEMS & GROUND TRUTH MATCH")
    print("-" * 92)
    for q_res in summary.query_results:
        print(f"\n>> Truy van: \"{q_res.query}\" (Ky vong: {q_res.target_label} - Tong dung trong DB: {q_res.total_relevant_in_db})")
        for rank, item in enumerate(q_res.retrieved_items[:5], 1):
            status_tag = "[HIT - DUNG]" if item.is_hit else "[MISS - SAI]"
            type_tag = item.article_type or "Unknown"
            disp = safe_str(item.display_name or "N/A", 40)
            print(f"   {rank}. {status_tag} Score: {item.score:.4f} | File: {item.file_name} | Type: {type_tag} | {disp}")

    # 6. Bảng KPI tổng kết toàn hệ thống
    print("\n" + "=" * 92)
    print("                    TONG KET KPI HE THONG (GLOBAL BENCHMARK KPI)")
    print("=" * 92)
    print(f"  * Tong so truy van kiem thu  : {summary.total_queries}")
    print(f"  * Mean Precision@1 (P@1)     : {summary.mean_precision_at_k.get(1, 0.0) * 100:>6.2f}%")
    print(f"  * Mean Precision@3 (P@3)     : {summary.mean_precision_at_k.get(3, 0.0) * 100:>6.2f}%")
    print(f"  * Mean Precision@5 (P@5)     : {summary.mean_precision_at_k.get(5, 0.0) * 100:>6.2f}%")
    print(f"  * Mean Precision@10 (P@10)   : {summary.mean_precision_at_k.get(10, 0.0) * 100:>6.2f}%")
    print(f"  * Mean Recall@5 (R@5)        : {summary.mean_recall_at_k.get(5, 0.0) * 100:>6.2f}%")
    print(f"  * Mean Recall@10 (R@10)      : {summary.mean_recall_at_k.get(10, 0.0) * 100:>6.2f}%")
    print(f"  * Mean Average Precision(mAP): {summary.map_score * 100:>6.2f}%  (Gold Metric)")
    print(f"  * Mean Reciprocal Rank (MRR) : {summary.mrr_score * 100:>6.2f}%")
    print(f"  * Thoi gian phan hoi trung binh: {summary.avg_latency_ms:>5.1f} ms / query")
    print("=" * 92)


def main():
    # =========================================================================
    # CẤU HÌNH BENCHMARK (CHỈNH SỬA TRỰC TIẾP TẠI ĐÂY)
    # =========================================================================
    # Danh sách các mốc K để đo Precision@K và Recall@K
    k_list = [1, 3, 5, 10]

    # Bộ ca kiểm thử sử dụng (DEFAULT_BENCHMARK_CASES gồm 143 ca kiểm thử)
    test_cases = DEFAULT_BENCHMARK_CASES

    run_benchmark(test_cases=test_cases, k_list=k_list)


if __name__ == "__main__":
    main()
