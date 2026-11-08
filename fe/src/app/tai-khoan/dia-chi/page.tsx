"use client";
import { useEffect, useState } from "react";
import ac from "@/components/account/account-cards.module.css";
import { PriceTag } from "@/components/storefront/price-tag";
import { LocationPicker, type DeliveryLocation } from "@/components/customer-commerce/location-picker";
import { AddressAutocomplete } from "@/components/customer-commerce/address-autocomplete";
import "@/components/customer-commerce/commerce.css";
import "@/components/customer-commerce/checkout.css";
import { getSelfProfile, updateSelfProfile, customerFullName, type CustomerProfile } from "@/lib/customer-profile-client";
import { fetchShippingQuote } from "@/lib/customer-commerce-client";
import { type ShippingQuote } from "@/lib/customer-commerce";

export default function AddressesPage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState<DeliveryLocation | null>(null);
  const [quote, setQuote] = useState<ShippingQuote | null>(null);
  const [message, setMessage] = useState("Đang tải địa chỉ…");
  const [saveError, setSaveError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    getSelfProfile(c.signal).then((p) => {
      setProfile(p); setAddress(p.address ?? ""); setMessage(""); setLoadFailed(false);
      if (p.deliveryLatitude != null && p.deliveryLongitude != null) setLocation({ deliveryLatitude: p.deliveryLatitude, deliveryLongitude: p.deliveryLongitude });
    }).catch((e) => { if (!c.signal.aborted) { setMessage(e.message || "Không tải được hồ sơ."); setLoadFailed(true); } });
    return () => c.abort();
  }, []);
  useEffect(() => {
    if (!location) return;
    const c = new AbortController();
    const timer = setTimeout(() => {
      setQuote(null);
      fetchShippingQuote("TP. Hồ Chí Minh", "Tân Phú", 300, c.signal, location).then(setQuote).catch(() => { if (!c.signal.aborted) { setMessage("Không tải được phí giao hàng."); setLoadFailed(true); } });
    }, 300);
    return () => { clearTimeout(timer); c.abort(); };
  }, [location]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = address.trim();
    if (trimmed.length < 5) {
      setSaveError("Vui lòng nhập địa chỉ giao hàng (ít nhất 5 ký tự).");
      return;
    }
    setBusy(true); setMessage(""); setSaveError(""); setLoadFailed(false);
    try { setProfile(await updateSelfProfile({ address: trimmed, ...location })); setMessage("Đã lưu địa chỉ và vị trí giao hàng."); }
    catch (err) { setSaveError(err instanceof Error ? err.message : "Không lưu được địa chỉ."); }
    finally { setBusy(false); }
  }
  const isOk = message.startsWith("Đã lưu");
  return (
    <div className={ac.page}>
      <section className={ac.card} aria-labelledby="addr-recipient">
        <div className={ac.head}>
          <p className={ac.eyebrow}>01 · Người nhận</p>
          <h2 id="addr-recipient" className={ac.title}>Người nhận hàng</h2>
          <p className={ac.lead}>Địa chỉ và vị trí này được điền sẵn khi thanh toán. Bạn có thể thay đổi cho từng đơn.</p>
        </div>
        {profile ? (
          <p className={ac.meta}><strong style={{ color: "var(--st-ink)" }}>{customerFullName(profile)}</strong> · {profile.phoneNumber}</p>
        ) : (
          <div className={ac.skeleton} role="status" />
        )}
      </section>

      <section className={ac.card} aria-labelledby="addr-address">
        <div className={ac.head}>
          <p className={ac.eyebrow}>02 · Địa chỉ</p>
          <h2 id="addr-address" className={ac.title}>Vị trí giao hàng</h2>
          <p className={ac.lead}>Chấm đúng vị trí giúp giao hàng chính xác hơn.</p>
        </div>
        {profile ? (
          <form onSubmit={save} className={ac.form} noValidate>
            <div className={ac.field}>
              <label className={ac.label} htmlFor="delivery-address">Địa chỉ nhận hàng</label>
              <div className="commercePage diaChiFlat">
                <AddressAutocomplete
                  id="delivery-address"
                  value={address}
                  required
                  minLength={5}
                  maxLength={255}
                  aria-required="true"
                  aria-invalid={saveError ? true : undefined}
                  aria-describedby={saveError ? "delivery-address-error" : "delivery-address-hint"}
                  onText={(text) => { setAddress(text.slice(0, 255)); setLocation(null); setQuote(null); setSaveError(""); }}
                  onPick={(picked, at) => { setAddress(picked.slice(0, 255)); setLocation(at); setSaveError(""); }}
                  onLocate={(at) => { setLocation(at); }}
                />
                {location ? (
                  <p className="co-pinned"><span aria-hidden="true">✓</span> Đã ghim vị trí, phí giao tính theo quãng đường thực tế.</p>
                ) : (
                  <p className="co-muted">Chưa ghim vị trí: chọn một gợi ý địa chỉ ở trên hoặc mở bản đồ để ghim.</p>
                )}
                <details className="co-map" open={mapOpen} onToggle={(e) => setMapOpen(e.currentTarget.open)}>
                  <summary>{location ? "Chỉnh ghim trên bản đồ" : "Ghim trên bản đồ"}</summary>
                  {mapOpen ? <LocationPicker mapOnly value={location} onChange={setLocation} /> : null}
                </details>
              </div>
              <p className={ac.hint} id="delivery-address-hint">Ghi rõ số nhà, đường, phường/xã để người giao hàng dễ tìm.</p>
            </div>
            {quote ? (
              <p className={ac.meta} aria-live="polite">
                {quote.distanceKm?.toLocaleString("vi-VN")} km · {quote.method === "google" ? "Theo tuyến đường" : "Ước tính"} · <PriceTag value={quote.shippingFee} /> / kiện đến 2 kg. Phí cuối cùng được tính khi thanh toán.
              </p>
            ) : null}
            <div className={ac.actions}>
              <button className={ac.primary} type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Lưu địa chỉ"}</button>
            </div>
          </form>
        ) : null}
      </section>

      {saveError ? (
        <p id="delivery-address-error" className={ac.alert} role="alert">{saveError}</p>
      ) : null}
      {message ? (
        loadFailed ? <p className={ac.alert} role="alert">{message}</p>
        : isOk ? <p className={ac.notice} role="status">{message}</p>
        : <p className={ac.meta} role="status" aria-live="polite">{message}</p>
      ) : null}
    </div>
  );
}
