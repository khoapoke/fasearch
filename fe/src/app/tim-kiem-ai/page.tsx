import { AiSearchView } from "./search-view";
import { normalizePreview } from "./ai-fixtures";

export const metadata = {
  title: "Tìm kiếm bằng chữ (AI) | FaSearch",
  description: "Tìm kiếm ảnh thời trang bằng mô tả chữ qua mô hình AI.",
};

export default async function AiTextSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string | string[] }>;
}) {
  const params = await searchParams;
  return <AiSearchView preview={normalizePreview(params.preview)} />;
}
