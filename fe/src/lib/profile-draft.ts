// Draft hồ sơ từ trường gốc của BE (UserResponse.ho/ten), dùng cho form sửa.
// Không suy ngược từ hoTen trình diễn: tên một từ và biên tên nhiều từ phải
// giữ nguyên; sửa địa chỉ không được đổi tên.

export type CustomerNameFields = {
  ho: string | null;
  ten: string | null;
  gioiTinh: string | null;
  ngaySinh: string | null;
  diaChi: string | null;
  email: string | null;
};

export type ProfileDraft = {
  ho: string;
  ten: string;
  gioiTinh: string;
  ngaySinh: string;
  diaChi: string;
  email: string;
};

export const EMPTY_DRAFT: ProfileDraft = {
  ho: "",
  ten: "",
  gioiTinh: "",
  ngaySinh: "",
  diaChi: "",
  email: "",
};

export function draftFromCustomer(customer: CustomerNameFields | null): ProfileDraft {
  if (!customer) return EMPTY_DRAFT;
  return {
    ho: customer.ho ?? "",
    ten: customer.ten ?? "",
    gioiTinh: customer.gioiTinh ?? "",
    ngaySinh: customer.ngaySinh ?? "",
    diaChi: customer.diaChi ?? "",
    email: customer.email ?? "",
  };
}
