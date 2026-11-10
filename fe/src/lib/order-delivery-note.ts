import { parseCustomerOrderNote } from "./order-recipient.ts";

/** Only preparation/delivery instructions belong on a courier slip. */
export function orderDeliveryNote(source: string | null | undefined): string {
  const note = parseCustomerOrderNote(source);
  return [...new Set([note.text, ...note.transitions
    .filter(({ status }) => ["CONFIRMED", "PACKING", "SHIPPING"].includes(status))
    .map(({ note }) => note)].filter(Boolean))].join(" · ");
}
