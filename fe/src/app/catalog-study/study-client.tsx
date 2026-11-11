"use client";

import Link from "next/link";
import { useStudyCatalog } from "@/components/study/use-study-catalog";
import { DirectionA } from "@/components/study/direction-a";
import { DirectionB } from "@/components/study/direction-b";

export function StudyClient({ direction }: { direction: "a" | "b" | null }) {
  if (!direction) {
    return (
      <div className="stEntry">
        <h1>Nghiên cứu catalog: chọn một hướng để so sánh</h1>
        <p className="st-lede">Cùng dữ liệu, cùng trang, cùng số lượng — khác cách sắp xếp không gian và nhịp tương tác. Chưa tích hợp vào app.</p>
        <div className="stEntry-cards">
          <Link className="stEntry-card" href="/catalog-study?direction=a">
            <span className="stEntry-letter" aria-hidden="true">A</span>
            <span className="stEntry-name">Gian ngắm</span>
            <span className="stEntry-desc">Rail bên yên tĩnh, lựa chọn khung góc viewfinder, thang ngân sách là nhạc cụ nhỏ, chỉ mục trang in ấn.</span>
          </Link>
          <Link className="stEntry-card" href="/catalog-study?direction=b">
            <span className="stEntry-letter" aria-hidden="true">B</span>
            <span className="stEntry-name">Dải ngang</span>
            <span className="stEntry-desc">Lưới full-width, thanh lọc ngang + panel neo, phân trang dẫn bằng range và đường vị trí mảnh.</span>
          </Link>
        </div>
      </div>
    );
  }
  return <StudyView direction={direction} />;
}

function StudyView({ direction }: { direction: "a" | "b" }) {
  const api = useStudyCatalog(direction);
  return direction === "a" ? <DirectionA api={api} /> : <DirectionB api={api} />;
}
