import { AdminFrame } from "@/components/admin-b/admin-frame";

// Runs before first paint so the dark canvas is there on hard load and no frame ever paints light.
const ADMIN_THEME_BOOT = `(function(){try{var s=localStorage.getItem("fasearch-admin-theme");if(s==="dark"||s==="light")document.documentElement.dataset.adminTheme=s;}catch(e){}})();`;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: ADMIN_THEME_BOOT }} />
      <AdminFrame>{children}</AdminFrame>
    </>
  );
}
