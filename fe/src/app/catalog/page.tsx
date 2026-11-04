import { redirect } from "next/navigation";

// Route nghiên cứu cũ gọi proxy /api/be đã ngừng (410). Danh mục thật nằm ở /nam.
export default function Page(): never {
  redirect("/nam");
}
