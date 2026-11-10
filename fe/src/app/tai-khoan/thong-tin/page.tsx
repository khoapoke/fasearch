import { ProfileEditor } from "@/components/customer-auth/profile-editor";

export const metadata = {
  title: "Thông tin tài khoản cá nhân | FaSearch",
  description: "Xem và sửa thông tin cá nhân FaSearch.",
};

export default function ProfilePage() {
  return (
    <section aria-label="Thông tin cá nhân">
      <ProfileEditor />
    </section>
  );
}
