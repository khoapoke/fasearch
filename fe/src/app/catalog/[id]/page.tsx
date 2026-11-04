import { redirect } from "next/navigation";

// Chi tiết cũ gọi proxy /api/be đã ngừng (410). Chi tiết thật nằm ở /san-pham/[id].
export default async function Page({ params }: { params: Promise<{ id: string }> }): Promise<never> {
  const { id } = await params;
  redirect(/^\d+$/.test(id) ? `/san-pham/${id}` : "/nam");
}
