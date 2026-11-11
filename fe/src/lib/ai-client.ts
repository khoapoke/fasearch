export type AiSearchMode = "text" | "image" | "multimodal";
export async function searchAi(mode: AiSearchMode, body: BodyInit, signal?: AbortSignal): Promise<Response> {
  return fetch(`/api/ai/search/${mode}`, { method: "POST", body, cache: "no-store", signal });
}
