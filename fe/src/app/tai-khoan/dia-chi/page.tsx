"use client";
import { useEffect, useState } from "react";
import { LocationPicker, type DeliveryLocation } from "@/components/customer-commerce/location-picker";
import { getSelfProfile, updateSelfProfile, type CustomerProfile } from "@/lib/customer-profile-client";
import { fetchShippingQuote } from "@/lib/customer-commerce-client";
import { formatMoney, type ShippingQuote } from "@/lib/customer-commerce";
import "@/components/storefront/preview.css";

export default function AddressesPage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState<DeliveryLocation | null>(null);
  const [quote, setQuote] = useState<ShippingQuote | null>(null);
  const [message, setMessage] = useState("Đang tải địa chỉ…");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    getSelfProfile(c.signal).then((p) => {
      setProfile(p); setAddress(p.address ?? ""); setMessage("");
      if (p.deliveryLatitude != null && p.deliveryLongitude != null) setLocation({ deliveryLatitude: p.deliveryLatitude, deliveryLongitude: p.deliveryLongitude });
    }).catch((e) => { if (!c.signal.aborted) setMessage(e.message || "Không tải được hồ sơ."); });
    return () => c.abort();
  }, []);
  useEffect(() => {
    if (!location) return;
    const c = new AbortController();
    const timer = setTimeout(() => {
      setQuote(null);
      fetchShippingQuote("TP. Hồ Chí Minh", "Tân Phú", 300, c.signal, location).then(setQuote).catch(() => { if (!c.signal.aborted) setMessage("Không tải được phí giao hàng."); });
    }, 300);
    return () => { clearTimeout(timer); c.abort(); };
  }, [location]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try { setProfile(await updateSelfProfile({ address: address.trim(), ...location })); setMessage("Đã lưu địa chỉ và vị trí giao hàng."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Không lưu được địa chỉ."); }
    finally { setBusy(false); }
  }
  return (
    <>
      <p className="mpMuted">Địa chỉ và vị trí này được điền sẵn khi thanh toán. Bạn có thể thay đổi cho từng đơn.</p>
      {profile ? <form onSubmit={save} className="pvAddr">
        <p><b>{[profile.lastName, profile.firstName].filter(Boolean).join(" ")}</b> · {profile.phoneNumber}</p>
        <label htmlFor="delivery-address">Địa chỉ nhận hàng</label>
        <input id="delivery-address" value={address} onChange={(e) => { setAddress(e.target.value); setLocation(null); setQuote(null); }} maxLength={255} required minLength={5} style={{ width: "100%", padding: 12, boxSizing: "border-box" }} autoComplete="street-address" />
        <LocationPicker value={location} onChange={setLocation} onAddress={setAddress} />
        {quote ? <p aria-live="polite">{quote.distanceKm?.toLocaleString("vi-VN")} km · {quote.method === "google" ? "Theo tuyến đường" : "Ước tính"} · {formatMoney(quote.shippingFee)} / kiện đến 2 kg. Phí cuối cùng được tính khi thanh toán.</p> : null}
        <button className="auth-button is-primary" type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Lưu địa chỉ"}</button>
      </form> : null}
      {message ? <p role="status" aria-live="polite">{message}</p> : null}
    </>
  );
}
