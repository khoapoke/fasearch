import os
import sys
from pathlib import Path

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
from src.core.exceptions import GroundTruthMissingError
from src.repositories import get_image_repository
from src.services.point_service import batch_create_from_directory
from src.services.evaluation_service import (
    run_full_benchmark,
    get_available_test_images,
    DEFAULT_BENCHMARK_CASES,
)


def ensure_test_data_seeded():
    """Kiểm tra và tự động nạp 10 ảnh test vào Qdrant nếu Database chưa có dữ liệu."""
    repo = get_image_repository()
    try:
        count = repo.count_points()
    except Exception as e:
        print(f"\n[!] Khong the ket noi den Qdrant: {e}")
        print("[!] Hay dam bao Docker Qdrant dang chay: docker-compose up -d\n")
        sys.exit(1)

    if count == 0:
        print("\n[*] Qdrant hien chua co du lieu. Dang tu dong nap 10 anh test vao Qdrant...")
        target_test_dir = ROOT_DIR / "dataset" / "test" / "images"
        batch_create_from_directory(target_dir=target_test_dir, batch_size=10)
        print("[*] Da nap xong du lieu test vao Qdrant!\n")


def print_separator(char="=", length=92):
    print(char * length)


def safe_str(text: str, max_len: int = 30) -> str:
    """Cắt ngắn chuỗi an toàn."""
    if not text:
        return ""
    if len(text) > max_len:
        return text[:max_len - 3] + "..."
    return text


def main():
    print_separator("=")
    print("      FASHION AI SEARCH ENGINE - BENCHMARK REPORT (Precision@K & Recall@K)")
    print_separator("=")

    # 1. Thong tin phan cung & He thong
    is_cuda = torch.cuda.is_available()
    device_name = torch.cuda.get_device_name(0) if is_cuda else "CPU"
    repo = get_image_repository()
    
    # 2. Dam bao da co du lieu test
    ensure_test_data_seeded()
    total_db_points = repo.count_points()
    avail_images = get_available_test_images()

    print(f"[*] Thiet bi tinh toan : {'CUDA (GPU)' if is_cuda else 'CPU'} - {device_name}")
    print(f"[*] Vector Database    : Qdrant ({settings.qdrant.host}:{settings.qdrant.grpc_port})")
    print(f"[*] Collection         : {repo.collection_name} (Vector Size: {settings.qdrant.vector_size})")
    print(f"[*] Tong so Points     : {total_db_points} records")
    print(f"[*] So anh tap Test    : {len(avail_images)} anh trong dataset/test/images/")
    print_separator("-")

    # 3. Chay Benchmark
    k_list = [1, 3, 5, 10]
    print(f"[*] Dang thuc thi {len(DEFAULT_BENCHMARK_CASES)} kich ban kiem thu o cac moc K = {k_list}...")
    try:
        summary = run_full_benchmark(k_list=k_list)
    except GroundTruthMissingError as e:
        print("\n[!] KHONG THE DANH GIA - THIEU GROUND TRUTH")
        print(f"[!] {e}")
        print("[!] Khong in bang KPI vi 0.00% se gay hieu nham. Thoat voi ma loi 2.\n")
        sys.exit(2)
    if summary.skipped_queries:
        print(f"[!] Bo qua {len(summary.skipped_queries)} truy van khong co san pham dung nao trong collection (khong tinh vao trung binh).")

    # 4. Bang chi tiet tung cau truy van
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

    # 5. Chi tiet cac ket qua Hit / Miss cho tung Query
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

    # 6. Bang KPI tong ket toan he thong
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


if __name__ == "__main__":
    main()
