/**
 * Người nhận được lưu trong ghi chú đơn dưới dạng `[Người nhận: Tên - SĐT]`
 * (đơn không có cột riêng). Dùng chung cho trang khách và trang quản trị.
 */
export type OrderRecipient = { name: string; phone: string };

const RECIPIENT_TOKEN = /\[Người nhận:\s*([^\]]*)\]/g;

function splitRecipient(body: string): OrderRecipient {
  // Tên có thể chứa dấu gạch ngang; SĐT là phần sau dấu " - " cuối cùng.
  const at = body.lastIndexOf(" - ");
  if (at < 0) return { name: body.trim(), phone: "" };
  return { name: body.slice(0, at).trim(), phone: body.slice(at + 3).trim() };
}

/** Tách người nhận khỏi ghi chú; phần ghi chú còn lại được giữ nguyên chữ thật. */
export function parseOrderNote(note: string | null | undefined): { recipient: OrderRecipient | null; text: string } {
  const source = note ?? "";
  let recipient: OrderRecipient | null = null;
  const stripped = source.replace(RECIPIENT_TOKEN, (_whole, body: string) => {
    if (!recipient) {
      const parsed = splitRecipient(body);
      if (parsed.name || parsed.phone) recipient = parsed;
    }
    return " ";
  });
  return { recipient, text: stripped.replace(/\s+/g, " ").trim() };
}

/** Xóa token người nhận nhưng không đổi các phần khác của ghi chú. */
export function stripRecipientToken(note: string): string {
  return note.replace(RECIPIENT_TOKEN, " ");
}

/** Customer rendering keeps reasons readable and removes internal status/actor tokens. */
export function parseCustomerOrderNote(note: string | null | undefined) {
  const parsed = parseOrderNote(note);
  const transitions: { status: string; note: string }[] = [];
  const cancellations: string[] = [];
  let text = parsed.text.replace(/\[HỦY ĐƠN\s*-\s*([^\]]*)\]\s*:\s*([^|\]]*)/g, (_whole, _actor: string, reason: string) => {
    if (reason.trim()) cancellations.push(reason.trim());
    return " ";
  });
  text = text.replace(/\[(PENDING|CONFIRMED|PACKING|SHIPPING|COMPLETED|CANCELLED|RETURNED)\]\s*:\s*([^|\]]*)/g, (_whole, status: string, message: string) => {
    if (message.trim()) transitions.push({ status, note: message.trim() });
    return " ";
  }).replace(/\s*\|\s*/g, " ").replace(/\s+/g, " ").trim();
  return { recipient: parsed.recipient, text, transitions, cancellations };
}
