"use client";

import { useEffect, useId, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./location-picker.css";

export type DeliveryLocation = { deliveryLatitude: number; deliveryLongitude: number };
const WAREHOUSE: [number, number] = [10.8070354, 106.6287031];
type Props = { value: DeliveryLocation | null; onChange: (value: DeliveryLocation) => void; onAddress?: (address: string) => void; mapOnly?: boolean };
type Suggestion = { placeId: string; label: string };

export function LocationPicker({ value, onChange, onAddress, mapOnly = false }: Props) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const marker = useRef<Leaflet.Marker | null>(null);
  const latest = useRef({ value, onChange });
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [message, setMessage] = useState(mapOnly ? "Chạm bản đồ hoặc kéo ghim tới đúng chỗ nhận hàng." : "Tìm địa chỉ, chạm bản đồ hoặc kéo ghim để chọn điểm giao hàng.");
  const [busy, setBusy] = useState(false);
  const searchVersion = useRef(0);
  useEffect(() => { latest.current = { value, onChange }; }, [value, onChange]);
  useEffect(() => {
    let disposed = false;
    void import("leaflet").then((L) => {
      if (disposed || !container.current) return;
      const initial = latest.current.value;
      const center: [number, number] = initial ? [initial.deliveryLatitude, initial.deliveryLongitude] : WAREHOUSE;
      const instance = L.map(container.current, { scrollWheelZoom: false }).setView(center, 14);
      map.current = instance;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(instance);
      const icon = L.divIcon({ className: "delivery-pin", html: '<span aria-hidden="true">●</span>', iconSize: [28, 28], iconAnchor: [14, 14] });
      const pin = L.marker(center, { draggable: true, icon, title: "Vị trí nhận hàng", keyboard: true }).addTo(instance);
      marker.current = pin;
      const select = (lat: number, lng: number) => {
        pin.setLatLng([lat, lng]);
        latest.current.onChange({ deliveryLatitude: Number(lat.toFixed(6)), deliveryLongitude: Number(lng.toFixed(6)) });
      };
      instance.on("click", (e: Leaflet.LeafletMouseEvent) => select(e.latlng.lat, e.latlng.lng));
      pin.on("dragend", () => { const p = pin.getLatLng(); select(p.lat, p.lng); });
    }).catch(() => { if (!disposed) setMessage("Không tải được bản đồ. Bạn vẫn có thể tìm địa chỉ."); });
    return () => { disposed = true; map.current?.remove(); map.current = null; marker.current = null; };
  }, []);
  useEffect(() => {
    if (!value) return;
    const p: [number, number] = [value.deliveryLatitude, value.deliveryLongitude];
    marker.current?.setLatLng(p); map.current?.panTo(p);
  }, [value]);

  async function search() {
    const version = ++searchVersion.current;
    setBusy(true); setSuggestions([]);
    try {
      const r = await fetch(`/api/customer-commerce/maps/autocomplete?input=${encodeURIComponent(query)}`, { cache: "no-store" });
      const j = await r.json();
      if (version !== searchVersion.current) return;
      if (!r.ok) { setMessage("Tìm địa chỉ chưa khả dụng. Nhập địa chỉ giao hàng và chọn ghim trên bản đồ."); return; }
      setSuggestions(j.result ?? []); setMessage("Chọn một địa chỉ gợi ý hoặc tiếp tục đặt ghim.");
    } catch { if (version === searchVersion.current) setMessage("Không tìm được địa chỉ. Hãy chọn ghim trên bản đồ."); }
    finally { if (version === searchVersion.current) setBusy(false); }
  }
  async function select(s: Suggestion) {
    setBusy(true);
    try {
      const r = await fetch(`/api/customer-commerce/maps/geocode?placeId=${encodeURIComponent(s.placeId)}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error();
      onChange({ deliveryLatitude: j.result.latitude, deliveryLongitude: j.result.longitude });
      onAddress?.(j.result.formattedAddress); setSuggestions([]); setQuery(s.label);
    } catch { setMessage("Không định vị được địa chỉ. Hãy chọn ghim trên bản đồ."); }
    finally { setBusy(false); }
  }
  function locate() {
    if (!navigator.geolocation) { setMessage("Trình duyệt chưa hỗ trợ định vị; hãy đặt ghim."); return; }
    navigator.geolocation.getCurrentPosition((p) => {
      onChange({ deliveryLatitude: p.coords.latitude, deliveryLongitude: p.coords.longitude });
      setMessage("Đã lấy vị trí hiện tại. Hãy kiểm tra lại ghim trước khi lưu.");
    }, () => setMessage("Không lấy được vị trí. Hãy cho phép định vị hoặc tự đặt ghim."), { timeout: 10000 });
  }
  if (mapOnly) return <section className="delivery-picker" aria-label="Bản đồ giao hàng">
    <div ref={container} className="delivery-map" aria-label="Bản đồ giao hàng; chạm hoặc kéo ghim để chọn vị trí" />
    <p role="status">{message}</p>
  </section>;
  return <section className="delivery-picker" aria-label="Chọn vị trí giao hàng">
    <label htmlFor={`${id}-search`}>Tìm vị trí giao hàng</label>
    <div className="delivery-picker-actions"><input id={`${id}-search`} value={query} onChange={(e) => { searchVersion.current++; setQuery(e.target.value); setSuggestions([]); setBusy(false); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (query.trim().length >= 3) void search(); } }} placeholder="Nhập địa chỉ để tìm" maxLength={200} /><button type="button" disabled={busy || query.trim().length < 3} onClick={() => void search()}>Tìm địa chỉ</button></div>
    {suggestions.length ? <ul aria-label="Địa chỉ gợi ý">{suggestions.map((s) => <li key={s.placeId}><button type="button" disabled={busy} onClick={() => void select(s)}>{s.label}</button></li>)}</ul> : null}
    <div ref={container} className="delivery-map" aria-label="Bản đồ giao hàng; chạm hoặc kéo ghim để chọn vị trí" />
    <div className="delivery-picker-actions"><button type="button" onClick={locate}>Dùng vị trí hiện tại</button></div>
    <p role="status">{message}</p>
    {!value ? <p>Chưa ghim vị trí: phí giao hàng tính theo tỉnh/quận và trọng lượng.</p> : null}
  </section>;
}
