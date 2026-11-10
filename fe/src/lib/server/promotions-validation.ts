const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

export function campaignBody(body: Record<string, unknown>, create: boolean): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};
  if (!create) {
    if (!Number.isSafeInteger(body.phienBan) || (body.phienBan as number) < 0) return null;
    result.phienBan = body.phienBan;
  }
  if (create || "tenCtkm" in body) {
    if (typeof body.tenCtkm !== "string" || !body.tenCtkm.trim()) return null;
    result.tenCtkm = body.tenCtkm.trim();
  }
  if (create || "loaiGiam" in body) {
    if (body.loaiGiam !== "PHAN_TRAM" && body.loaiGiam !== "SO_TIEN" && body.loaiGiam !== "FREE_SHIP") return null;
    result.loaiGiam = body.loaiGiam;
  }
  if (create || "giaTriGiam" in body) {
    const amount = body.giaTriGiam;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || (body.loaiGiam === "PHAN_TRAM" && amount > 100)) return null;
    result.giaTriGiam = amount;
  }
  if (create || "ngayBatDau" in body) {
    if (typeof body.ngayBatDau !== "string" || !DATE_TIME.test(body.ngayBatDau)) return null;
    result.ngayBatDau = body.ngayBatDau;
  }
  if (create || "ngayKetThuc" in body) {
    if (typeof body.ngayKetThuc !== "string" || !DATE_TIME.test(body.ngayKetThuc)) return null;
    result.ngayKetThuc = body.ngayKetThuc;
  }
  if ("dieuKienApDung" in body) {
    if (typeof body.dieuKienApDung !== "string") return null;
    result.dieuKienApDung = body.dieuKienApDung;
  }
  if ("maSpApDung" in body) {
    if (!Array.isArray(body.maSpApDung) || !body.maSpApDung.every((id) => Number.isSafeInteger(id) && (id as number) > 0)) return null;
    result.maSpApDung = body.maSpApDung;
  }
  if (!create && "trangThai" in body) {
    if (body.trangThai !== "HOAT_DONG" && body.trangThai !== "TAM_DUNG") return null;
    result.trangThai = body.trangThai;
  }
  return result;
}

export function codeBody(body: Record<string, unknown>): Record<string, unknown> | null {
  if (typeof body.maCode !== "string" || !body.maCode.trim() || body.maCode.trim().length > 50 || !("soLuongPhatHanh" in body)) return null;
  const quota = body.soLuongPhatHanh;
  if (quota !== null && (!Number.isSafeInteger(quota) || (quota as number) <= 0)) return null;
  return { maCode: body.maCode.trim().toUpperCase(), soLuongPhatHanh: quota };
}
