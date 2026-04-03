import React, { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";
import parksmartLogo from "./parksmart-logo.png";
import Login from "./Login";
import AdminLogin from "./AdminLogin";
import AdminPanel from "./AdminPanel";
import ResetPassword from "./ResetPassword";

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

// Always parse API timestamps as UTC (backend sends naive UTC strings without Z)
function parseUTC(dateStr) {
  if (!dateStr) return null;
  // If already has timezone info (Z or +offset), parse as-is
  if (dateStr.endsWith("Z") || dateStr.includes("+")) return new Date(dateStr);
  // Otherwise force UTC by appending Z
  return new Date(dateStr + "Z");
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - parseUTC(dateStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return parseUTC(dateStr).toLocaleString("en-IN", {
    dateStyle: "short", timeStyle: "short", timeZone: "Asia/Kolkata"
  });
}

function LiveTimer({ bookedAt }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const tick = () => setElapsed(Math.floor((Date.now() - parseUTC(bookedAt)) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [bookedAt]);
  const h = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const s = String(elapsed % 60).padStart(2, "0");
  return <span className="live-timer">{h}:{m}:{s}</span>;
}

function MapView({ slots, stats, activeBookings }) {
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markersRef = useRef([]);
  const [leafletReady, setLeafletReady] = useState(!!window.L);
  const PARKING_LAT = 28.6139;
  const PARKING_LNG = 77.2090;

  useEffect(() => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css"; link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    if (window.L) { setLeafletReady(true); return; }
    if (!document.getElementById("leaflet-js")) {
      const script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => setLeafletReady(true);
      document.head.appendChild(script);
    } else {
      const poll = setInterval(() => { if (window.L) { setLeafletReady(true); clearInterval(poll); } }, 100);
      return () => clearInterval(poll);
    }
  }, []);

  useEffect(() => {
    if (!leafletReady || !mapRef.current) return;
    const L = window.L;
    if (!leafletMapRef.current) {
      const map = L.map(mapRef.current, { zoomControl: true }).setView([PARKING_LAT, PARKING_LNG], 16);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap", maxZoom: 19,
      }).addTo(map);
      leafletMapRef.current = map;
    }
    const map = leafletMapRef.current;
    setTimeout(() => map.invalidateSize(), 150);
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const pi = L.divIcon({
      className: "",
      html: `<div style="background:#00d4ff;color:#000;font-weight:800;font-size:12px;padding:7px 12px;border-radius:10px;box-shadow:0 4px 16px rgba(0,212,255,0.5);white-space:nowrap;font-family:sans-serif;">🅿️ ParkSmart<br><span style="font-size:10px;">${stats.free_slots ?? 0} Free · ${stats.occupied_slots ?? 0} Occ</span></div>`,
      iconAnchor: [55, 18],
    });
    markersRef.current.push(L.marker([PARKING_LAT, PARKING_LNG], { icon: pi }).addTo(map).bindPopup(`<b>ParkSmart — Connaught Place</b><br>🟢 ${stats.free_slots ?? 0} free · 🔴 ${stats.occupied_slots ?? 0} occupied<br><i style="font-size:11px;">₹20/hr</i>`));

    // Nearby lots markers
    const nearbyMarkers = [
      { lat: 28.6268, lng: 77.2123, name: "Palika Bazar Basement", area: "Connaught Circus", available: 34, total: 80, rate: 30 },
      { lat: 28.7041, lng: 77.1897, name: "Hudson Lane Parking", area: "Hudson Lane, GTB Nagar", available: 12, total: 35, rate: 20 },
      { lat: 28.6252, lng: 77.2198, name: "Janpath Multi-Level", area: "Janpath Road", available: 0, total: 40, rate: 40 },
      { lat: 28.6185, lng: 77.2310, name: "Mandi House Parking", area: "Copernicus Marg", available: 8, total: 30, rate: 20 },
    ];

    nearbyMarkers.forEach(lot => {
      const isFull = lot.available === 0;
      const isLow  = lot.available > 0 && lot.available < 6;
      const bg     = isFull ? "#ff3d5a" : isLow ? "#ffd600" : "#00e676";
      const tc     = isFull ? "#fff"    : "#000";
      const label  = isFull ? "FULL" : `₹${lot.rate}`;

      const ic = L.divIcon({
        className: "",
        html: `<div style="
          background:${bg};color:${tc};font-weight:800;font-size:12px;
          padding:6px 11px;border-radius:20px;
          box-shadow:0 3px 12px rgba(0,0,0,0.35);
          white-space:nowrap;font-family:sans-serif;
          display:flex;align-items:center;gap:5px;
          border:2px solid rgba(255,255,255,0.25);
        ">
          <span style="font-size:13px;">🅿</span> ${label}
          <div style="
            position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);
            width:0;height:0;
            border-left:6px solid transparent;
            border-right:6px solid transparent;
            border-top:7px solid ${bg};
          "></div>
        </div>`,
        iconAnchor: [40, 36],
      });

      const pct = Math.round(((lot.total - lot.available) / lot.total) * 100);
      const popup = `
        <b>${lot.name}</b><br>
        <span style="font-size:11px;color:#888;">${lot.area}</span><br>
        ${isFull
          ? `<span style="color:#ff3d5a;">🔴 Full</span>`
          : `🟢 ${lot.available} free of ${lot.total} · ${pct}% full`
        }<br>
        <i style="font-size:11px;">₹${lot.rate}/hr</i>
      `;
      markersRef.current.push(L.marker([lot.lat, lot.lng], { icon: ic }).addTo(map).bindPopup(popup));
    });

    const zo = { A: { latBase: PARKING_LAT + 0.0003, lngBase: PARKING_LNG - 0.0008 }, B: { latBase: PARKING_LAT - 0.0003, lngBase: PARKING_LNG - 0.0008 } };
    const zs = {};
    slots.forEach(s => { if (!zs[s.zone]) zs[s.zone] = []; zs[s.zone].push(s); });
    Object.entries(zs).forEach(([zone, arr]) => {
      const base = zo[zone] || { latBase: PARKING_LAT, lngBase: PARKING_LNG };
      arr.forEach((s, i) => {
        const isAct = activeBookings && activeBookings.some(b => b.slot_number === s.slot_number);
        const color = isAct ? "#ffd600" : s.is_occupied ? "#ff3d5a" : "#00e676";
        const lbl = isAct ? "YOU" : s.is_occupied ? "🚗" : "P";
        const ic = L.divIcon({ className: "", html: `<div style="width:34px;height:34px;background:${color};color:#000;font-weight:800;font-size:10px;border-radius:7px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);border:2px solid rgba(255,255,255,0.4);">${lbl}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
        markersRef.current.push(L.marker([base.latBase, base.lngBase + i * 0.00032], { icon: ic }).addTo(map).bindPopup(`<b>S${s.slot_number}</b> · Zone ${zone}<br>${s.is_occupied ? "🔴 Occupied" : "🟢 Free"}`));
      });
    });
  }, [leafletReady, slots, stats, activeBookings]);

  useEffect(() => () => { if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null; } }, []);

  return (
    <div className="map-full">
      {!leafletReady && <div className="map-loading-overlay">🗺 Loading map…</div>}
      <div ref={mapRef} className="map-full-canvas" />
    </div>
  );
}

// ─────────────────────────────────────────────
// NEARBY LOTS DATA & COMPONENT
// ─────────────────────────────────────────────
const NEARBY_LOTS = [
  {
    id: 1,
    name: "Connaught Place Parking",
    area: "Block F, CP",
    distance: "0.0 km",
    available: 20,
    total: 20,
    rate: 20,
    rating: 4.5,
    tag: "YOUR LOT",
    tagColor: "#00d4ff",
    icon: "🅿️",
    highlight: true,
    lat: 28.6139, lng: 77.2090,
  },
  {
    id: 2,
    name: "Palika Bazar Basement",
    area: "Connaught Circus",
    distance: "0.3 km",
    available: 34,
    total: 80,
    rate: 30,
    rating: 4.2,
    tag: "OPEN",
    tagColor: "#00e676",
    icon: "🏢",
    lat: 28.6268, lng: 77.2123,
  },
  {
    id: 3,
    name: "Hudson Lane Parking",
    area: "Hudson Lane, GTB Nagar",
    distance: "7.8 km",
    available: 12,
    total: 35,
    rate: 20,
    rating: 4.1,
    tag: "OPEN",
    tagColor: "#00e676",
    icon: "🛣️",
    lat: 28.7041, lng: 77.1897,
  },
  {
    id: 4,
    name: "Janpath Multi-Level",
    area: "Janpath Road",
    distance: "1.1 km",
    available: 0,
    total: 40,
    rate: 40,
    rating: 4.7,
    tag: "FULL",
    tagColor: "#ff3d5a",
    icon: "🏬",
    lat: 28.6252, lng: 77.2198,
  },
  {
    id: 5,
    name: "Mandi House Parking",
    area: "Copernicus Marg",
    distance: "1.6 km",
    available: 8,
    total: 30,
    rate: 20,
    rating: 4.0,
    tag: "OPEN",
    tagColor: "#00e676",
    icon: "🎭",
    lat: 28.6185, lng: 77.2310,
  },
];

function StarRating({ rating }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <span className="nl-stars">
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= full ? "#ffd600" : (i === full + 1 && half ? "#ffd600" : "#2a3a55"), opacity: i === full + 1 && half ? 0.6 : 1 }}>★</span>
      ))}
      <span className="nl-rating-num">{rating.toFixed(1)}</span>
    </span>
  );
}

function NearbyLotBookingModal({ lot, onClose, username }) {
  const [step, setStep]       = React.useState("slots");   // slots | confirm | success
  const [vehicle, setVehicle] = React.useState("");
  const [selSlot, setSelSlot] = React.useState(null);
  const [err, setErr]         = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [bookingRef, setBookingRef] = React.useState("");

  const slotNums = Array.from({ length: lot.available }, (_, i) => i + 1);

  const handleConfirm = async () => {
    if (!vehicle.trim()) { setErr("Enter vehicle number."); return; }
    if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/.test(vehicle.trim().toUpperCase())) {
      setErr("Invalid format! Example: MH12AB1234"); return;
    }
    setErr(""); setLoading(true);
    // Simulate external API call with a short delay
    await new Promise(r => setTimeout(r, 1200));
    setBookingRef("EXT-" + Math.random().toString(36).slice(2,8).toUpperCase());
    setLoading(false);
    setStep("success");
  };

  return (
    <div className="nlm-overlay" onClick={onClose}>
      <div className="nlm-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="nlm-header">
          <div>
            <div className="nlm-title">{lot.icon} {lot.name}</div>
            <div className="nlm-sub">{lot.area} · {lot.distance} · ₹{lot.rate}/hr</div>
          </div>
          <button className="nlm-close" onClick={onClose}>✕</button>
        </div>

        {step === "slots" && (
          <>
            <div className="nlm-section-label">Select a Spot</div>
            <div className="nlm-slots-grid">
              {slotNums.map(n => (
                <div
                  key={n}
                  className={`nlm-slot ${selSlot === n ? "nlm-slot-sel" : ""}`}
                  onClick={() => setSelSlot(n)}
                >
                  <span>P</span>
                  <span className="nlm-slot-num">#{n}</span>
                </div>
              ))}
            </div>

            <div className="nlm-section-label" style={{ marginTop: 18 }}>Vehicle Number</div>
            <input
              className="nlm-input"
              placeholder="e.g. MH12AB1234"
              value={vehicle}
              onChange={e => { setVehicle(e.target.value.toUpperCase()); setErr(""); }}
            />
            {err && <div className="nlm-err">{err}</div>}

            <div className="nlm-fare-preview">
              <span>Min. Charge</span>
              <span>₹{lot.rate}</span>
            </div>

            <button
              className="nl-book-btn"
              style={{ marginTop: 14 }}
              disabled={!selSlot}
              onClick={() => {
                if (!vehicle.trim()) { setErr("Enter vehicle number."); return; }
                if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/.test(vehicle.trim().toUpperCase())) {
                  setErr("Invalid format! Example: MH12AB1234"); return;
                }
                setErr(""); setStep("confirm");
              }}
            >
              Continue →
            </button>
          </>
        )}

        {step === "confirm" && (
          <>
            <div className="nlm-confirm-box">
              <div className="nlm-confirm-row"><span>Lot</span><span>{lot.name}</span></div>
              <div className="nlm-confirm-row"><span>Spot</span><span>#{selSlot}</span></div>
              <div className="nlm-confirm-row"><span>Vehicle</span><span>{vehicle.toUpperCase()}</span></div>
              <div className="nlm-confirm-row"><span>Rate</span><span>₹{lot.rate}/hr</span></div>
              <div className="nlm-confirm-row"><span>User</span><span>{username}</span></div>
            </div>
            {err && <div className="nlm-err">{err}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="nlm-back-btn" onClick={() => setStep("slots")}>← Back</button>
              <button className="nl-book-btn" style={{ flex: 1 }} onClick={handleConfirm} disabled={loading}>
                {loading ? "Booking…" : "Confirm Booking →"}
              </button>
            </div>
          </>
        )}

        {step === "success" && (
          <div className="nlm-success">
            <div className="nlm-success-icon">✅</div>
            <div className="nlm-success-title">Booking Confirmed!</div>
            <div className="nlm-success-ref">Ref: {bookingRef}</div>
            <div className="nlm-confirm-box" style={{ marginTop: 14 }}>
              <div className="nlm-confirm-row"><span>Lot</span><span>{lot.name}</span></div>
              <div className="nlm-confirm-row"><span>Spot</span><span>#{selSlot}</span></div>
              <div className="nlm-confirm-row"><span>Vehicle</span><span>{vehicle.toUpperCase()}</span></div>
              <div className="nlm-confirm-row"><span>Rate</span><span>₹{lot.rate}/hr</span></div>
            </div>
            <div className="nlm-success-note">📧 Confirmation sent to your registered email</div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${lot.lat},${lot.lng}&travelmode=driving`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 6, padding: "12px", borderRadius: 10, textDecoration: "none",
                  background: "rgba(0,212,255,0.08)", border: "1.5px solid rgba(0,212,255,0.3)",
                  color: "#00d4ff", fontSize: 13, fontWeight: 700,
                }}
              >
                🧭 Get Directions
              </a>
              <button className="nl-book-btn" style={{ flex: 1, marginTop: 0 }} onClick={onClose}>Done</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function NearbyLots({ onBook, username, stats, onLotSelect, selectedLotId }) {
  const [selected, setSelected]   = React.useState(null);
  const [bookingLot, setBookingLot] = React.useState(null);

  // Merge live stats into YOUR LOT dynamically so it always reflects real slot count
  const lotsWithLiveData = NEARBY_LOTS.map(lot =>
    lot.highlight
      ? {
          ...lot,
          available: stats?.free_slots ?? lot.available,
          total:     stats?.total_slots ?? lot.total,
          tag:       (stats?.free_slots ?? lot.available) === 0 ? "FULL" : "YOUR LOT",
          tagColor:  (stats?.free_slots ?? lot.available) === 0 ? "#ff3d5a" : "#00d4ff",
        }
      : lot
  );

  return (
    <div className="section nl-panel">
      {bookingLot && (
        <NearbyLotBookingModal
          lot={bookingLot}
          username={username}
          onClose={() => setBookingLot(null)}
        />
      )}

      <div className="section-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="section-title">📍 Nearby Parking Lots</div>
          <div className="section-sub">Connaught Place · New Delhi</div>
        </div>
        <span className="nl-live-badge"><span className="active-dot" style={{ marginRight: 5 }} />LIVE</span>
      </div>

      <div className="nl-list">
        {lotsWithLiveData.map(lot => (
          <div
            key={lot.id}
            className={`nl-card ${lot.highlight ? "nl-card-highlight" : ""} ${selected === lot.id ? "nl-card-selected" : ""} ${lot.available === 0 ? "nl-card-full" : ""}`}
            style={selectedLotId === lot.id || (selectedLotId === null && lot.highlight) ? { outline: "2px solid #00d4ff", outlineOffset: 2 } : {}}
            onClick={() => {
              if (lot.available > 0) setSelected(selected === lot.id ? null : lot.id);
              // Notify dashboard to switch stat cards
              if (lot.highlight) { onLotSelect && onLotSelect(null); }
              else { onLotSelect && onLotSelect(lot); }
            }}
          >
            <div className="nl-card-top">
              <div className="nl-icon-wrap">{lot.icon}</div>
              <div className="nl-info">
                <div className="nl-name">{lot.name}</div>
                <div className="nl-area">{lot.area} · {lot.distance}</div>
                <StarRating rating={lot.rating} />
              </div>
              <div className="nl-right">
                <span className="nl-tag" style={{ background: lot.tagColor + "22", color: lot.tagColor, border: `1px solid ${lot.tagColor}44` }}>{lot.tag}</span>
                <div className="nl-rate">₹{lot.rate}<span>/hr</span></div>
              </div>
            </div>

            <div className="nl-avail-bar-wrap">
              <div className="nl-avail-bar">
                <div
                  className="nl-avail-fill"
                  style={{
                    width: `${((lot.total - lot.available) / lot.total) * 100}%`,
                    background: lot.available === 0 ? "#ff3d5a" : lot.available < 5 ? "#ffd600" : "#00e676",
                  }}
                />
              </div>
              <span className="nl-avail-text" style={{ color: lot.available === 0 ? "#ff3d5a" : lot.available < 5 ? "#ffd600" : "#00e676" }}>
                {lot.available === 0 ? "Full" : `${lot.available} free`}
              </span>
            </div>

            {selected === lot.id && (
              <div className="nl-expanded">
                <div className="nl-details-row"><span>Total Spots</span><span>{lot.total}</span></div>
                <div className="nl-details-row"><span>Available</span><span style={{ color: "#00e676" }}>{lot.available}</span></div>
                <div className="nl-details-row"><span>Rate</span><span>₹{lot.rate}/hr</span></div>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${lot.lat},${lot.lng}&travelmode=driving`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                      gap: 6, padding: "10px 12px", borderRadius: 10, textDecoration: "none",
                      background: "rgba(0,212,255,0.08)", border: "1.5px solid rgba(0,212,255,0.3)",
                      color: "#00d4ff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,212,255,0.18)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,212,255,0.08)"; }}
                  >
                    🧭 Directions
                  </a>
                  <button
                    className="nl-book-btn"
                    style={{ flex: 1, marginTop: 0 }}
                    onClick={e => {
                      e.stopPropagation();
                      if (lot.highlight) { onBook(); }
                      else { setBookingLot(lot); }
                    }}
                  >
                    Book a Spot →
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChangePasswordModal({ onClose, username }) {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!oldPw || !newPw || !confirmPw) { setErr("All fields are required."); return; }
    if (newPw.length < 4) { setErr("New password must be at least 4 characters."); return; }
    if (newPw !== confirmPw) { setErr("Passwords do not match."); return; }
    setErr(""); setLoading(true);
    try {
      const r = await fetch(`${API}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, old_password: oldPw, new_password: newPw }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.detail || "Failed to change password."); return; }
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch {
      setErr("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nlm-overlay" onClick={onClose}>
      <div className="nlm-modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div className="nlm-header">
          <div><div className="nlm-title">🔐 Change Password</div><div className="nlm-sub">Update your account password</div></div>
          <button type="button" className="nlm-close" onClick={onClose}>✕</button>
        </div>
        {success ? (
          <div className="nlm-success"><div className="nlm-success-icon">✅</div><div className="nlm-success-title">Password Updated!</div></div>
        ) : (
          <>
            {[
              { label: "Current Password", val: oldPw, set: setOldPw },
              { label: "New Password", val: newPw, set: setNewPw },
              { label: "Confirm New Password", val: confirmPw, set: setConfirmPw },
            ].map(({ label, val, set }) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
                <input
                  type="password"
                  className="nlm-input"
                  placeholder={label}
                  value={val}
                  onChange={e => { set(e.target.value); setErr(""); }}
                  style={{ marginBottom: 0 }}
                />
              </div>
            ))}
            {err && <div className="nlm-err">{err}</div>}
            <button type="button" className="nl-book-btn" style={{ marginTop: 16 }} onClick={handleSubmit} disabled={loading}>
              {loading ? "Updating…" : "Update Password →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [tab, setTab] = useState("dashboard");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [slots, setSlots] = useState([]);
  const [recommended, setRecommended] = useState(null);
  const [explanation, setExplanation] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [vehicle, setVehicle] = useState("");
  const [selectedSlots, setSelectedSlots] = useState([]);   // [{slot_number, vehicle}]
  const [activeBookings, setActiveBookings] = useState([]); // array of active bookings
  const [bookMsg, setBookMsg] = useState({ type: "", text: "" });
  const [qrBookingId, setQrBookingId] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ total_slots: 0, occupied_slots: 0, free_slots: 0, total_bookings: 0, active_bookings: 0 });
  const [selectedLot, setSelectedLot] = useState(null); // null = YOUR LOT (live from stats)
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showAllNotifs, setShowAllNotifs] = useState(false);
  const [showHelpDetail, setShowHelpDetail] = useState(null); // stores the help item object
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, icon: "✅", title: "Booking Confirmed", msg: "Your slot was booked successfully.", time: "2m ago", read: false },
    { id: 2, icon: "⏰", title: "Reminder", msg: "Your parking session has been active for 1 hour.", time: "1h ago", read: false },
    { id: 3, icon: "🏷️", title: "Offer Available", msg: "Get 20% off on your next 3 bookings!", time: "3h ago", read: true },
    { id: 4, icon: "🔒", title: "Security Alert", msg: "New login detected from your account.", time: "1d ago", read: true },
  ]);

  // Close dropdowns on outside click
  const topbarRef = useRef(null);
  useEffect(() => {
    const handleClick = (e) => {
      if (topbarRef.current && !topbarRef.current.contains(e.target)) {
        setShowProfileMenu(false);
        setShowNotifPanel(false);
        setShowHelpPanel(false);
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const PARKING_DB = [
    { id: 1, name: "Janpath Multi-Level Parking", area: "Janpath Road, CP", available: 0, total: 40, rate: 40, distance: "1.1 km", icon: "🏬", tag: "FULL", tagColor: "#ff3d5a" },
    { id: 2, name: "Palika Bazar Basement", area: "Connaught Circus", available: 34, total: 80, rate: 30, distance: "0.3 km", icon: "🏢", tag: "OPEN", tagColor: "#00e676" },
    { id: 3, name: "Hudson Lane Parking", area: "Hudson Lane, GTB Nagar", available: 12, total: 35, rate: 20, distance: "7.8 km", icon: "🛣️", tag: "OPEN", tagColor: "#00e676" },
    { id: 4, name: "Mandi House Parking", area: "Copernicus Marg", available: 8, total: 30, rate: 20, distance: "1.6 km", icon: "🎭", tag: "OPEN", tagColor: "#00e676" },
    { id: 5, name: "Connaught Place Parking", area: "Block F, CP", available: 20, total: 20, rate: 20, distance: "0.0 km", icon: "🅿️", tag: "YOUR LOT", tagColor: "#00d4ff" },
    { id: 6, name: "Rajiv Chowk Metro Parking", area: "Rajiv Chowk, CP", available: 5, total: 60, rate: 25, distance: "0.5 km", icon: "🚇", tag: "LOW", tagColor: "#ffd600" },
    { id: 7, name: "Barakhamba Road Parking", area: "Barakhamba Road", available: 22, total: 45, rate: 35, distance: "0.9 km", icon: "🏙️", tag: "OPEN", tagColor: "#00e676" },
  ];

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (val.trim().length < 2) { setSearchResults([]); setShowSearchResults(false); return; }
    const q = val.toLowerCase();
    const results = PARKING_DB.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.area.toLowerCase().includes(q)
    );
    setSearchResults(results);
    setShowSearchResults(true);
  };

  const fetchSlots = useCallback(async () => { try { const r = await fetch(`${API}/slots`); setSlots(await r.json()); } catch {} }, []);
  const fetchStats = useCallback(async () => { try { const r = await fetch(`${API}/stats`); setStats(await r.json()); } catch {} }, []);
  const fetchActiveBooking = useCallback(async () => { if (!username) return; try { const r = await fetch(`${API}/active-booking/${username}`); const d = await r.json(); setActiveBookings(d.active ? d.bookings : []); } catch {} }, [username]);
  const fetchHistory = useCallback(async () => { if (!username) return; try { const r = await fetch(`${API}/history/${username}`); setHistory(await r.json()); } catch {} }, [username]);

  useEffect(() => {
    if (loggedIn) {
      fetchSlots(); fetchStats(); fetchActiveBooking(); fetchHistory();
      const id = setInterval(() => { fetchSlots(); fetchStats(); fetchActiveBooking(); }, 5000);
      return () => clearInterval(id);
    }
  }, [loggedIn, fetchSlots, fetchStats, fetchActiveBooking]);

  useEffect(() => { if (tab === "history") fetchHistory(); }, [tab, fetchHistory]);

  const handleSlotClick = (slotNum, isOccupied) => {
    if (isOccupied) return;
    setRecommended(null); setBookMsg({ type: "", text: "" });
    setSelectedSlots(prev => {
      const exists = prev.find(s => s.slot_number === slotNum);
      if (exists) return prev.filter(s => s.slot_number !== slotNum); // deselect
      return [...prev, { slot_number: slotNum, vehicle: "" }];
    });
  };

  const findBestSlot = async () => {
    setAiLoading(true); setRecommended(null);
    try {
      const r = await fetch(`${API}/allocate-slot`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slots: slots.map(s => s.is_occupied ? 1 : 0) }) });
      const d = await r.json(); setRecommended(d.recommended_slot); setExplanation(d.explanation);
      setSelectedSlots(prev => {
        if (prev.find(s => s.slot_number === d.recommended_slot)) return prev;
        return [...prev, { slot_number: d.recommended_slot, vehicle: "" }];
      });
    } catch { setExplanation("Could not connect to AI backend."); } finally { setAiLoading(false); }
  };

  const bookSlots = async () => {
    if (selectedSlots.length === 0) { setBookMsg({ type: "error", text: "Select at least one slot." }); return; }
    const missing = selectedSlots.find(s => !s.vehicle.trim());
    if (missing) { setBookMsg({ type: "error", text: `Enter vehicle number for Slot S${missing.slot_number}.` }); return; }
    const invalid = selectedSlots.find(s => !/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/.test(s.vehicle.trim().toUpperCase()));
    if (invalid) { setBookMsg({ type: "error", text: `Invalid vehicle format for S${invalid.slot_number}. Example: MH12AB1234` }); return; }
    setBookMsg({ type: "", text: "" });
    let successCount = 0; let lastBookingId = null; let errors = [];
    for (const s of selectedSlots) {
      try {
        const r = await fetch(`${API}/book`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot_number: s.slot_number, vehicle_number: s.vehicle.trim().toUpperCase(), username }) });
        const d = await r.json();
        if (r.ok) { successCount++; lastBookingId = d.booking_id; }
        else { errors.push(`S${s.slot_number}: ${d.detail}`); }
      } catch { errors.push(`S${s.slot_number}: Server error`); }
    }
    if (successCount > 0) {
      setBookMsg({ type: "success", text: `✓ ${successCount} slot${successCount > 1 ? "s" : ""} booked!${errors.length ? " Some failed: " + errors.join(", ") : ""}` });
      if (lastBookingId) { setQrBookingId(lastBookingId); setShowQr(true); }
      setSelectedSlots([]); setRecommended(null);
    } else {
      setBookMsg({ type: "error", text: errors.join(" | ") || "Booking failed." });
    }
    fetchSlots(); fetchStats(); fetchActiveBooking();
  };

  const releaseSlot = async (bookingId) => {
    try {
      const r = await fetch(`${API}/release`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ booking_id: bookingId }) });
      const d = await r.json();
      if (r.ok) { setBookMsg({ type: "success", text: `✓ Released! ${d.duration_minutes} min · ₹${d.fare}` }); setShowQr(false); setQrBookingId(null); fetchSlots(); fetchStats(); fetchHistory(); fetchActiveBooking(); }
    } catch {}
  };

  const logout = () => { setLoggedIn(false); setUsername(""); setIsAdmin(false); setShowProfileMenu(false); };
  const unreadCount = notifications.filter(n => !n.read).length;
  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  const zoneA = slots.filter(s => s.zone === "A");
  const zoneB = slots.filter(s => s.zone === "B");

  if (isAdmin) return <AdminPanel onLogout={logout} />;
  if (showAdminLogin) return <AdminLogin onLogin={() => { setShowAdminLogin(false); setIsAdmin(true); }} />;
  if (window.location.pathname === "/reset-password" || window.location.search.includes("token=")) return <ResetPassword />;
  if (!loggedIn) return <Login setLoggedIn={setLoggedIn} setUsername={setUsername} setIsAdmin={() => setShowAdminLogin(true)} />;

  const navItems = [
    { id: "dashboard", icon: "⊞", label: "Dashboard" },
    { id: "map",       icon: "🗺", label: "Map View" },
    { id: "booking",   icon: "🅿️", label: "Book a Slot" },
    { id: "active",    icon: "⚡", label: "Active Booking" },
    { id: "history",   icon: "📋", label: "Booking History" },
  ];

  return (
    <div className="app-shell">

      {/* QR MODAL */}
      {showQr && qrBookingId && (
        <div className="qr-overlay" onClick={() => setShowQr(false)}>
          <div className="qr-modal" onClick={e => e.stopPropagation()}>
            <div className="qr-modal-header">
              <div><div className="qr-modal-title">✅ Booking Confirmed!</div><div className="qr-modal-sub">Show this QR at the parking entry gate</div></div>
              <button className="qr-close" onClick={() => setShowQr(false)}>✕</button>
            </div>
            <div className="qr-img-wrap"><img src={`${API}/qr/${qrBookingId}`} alt="Booking QR" className="qr-img" /></div>
            <div className="qr-note">📧 QR code also sent to your email</div>
            <button className="qr-download" onClick={() => { const a = document.createElement("a"); a.href = `${API}/qr/${qrBookingId}`; a.download = `parksmart_${qrBookingId}.png`; a.click(); }}>⬇ Download QR Code</button>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD MODAL */}
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} username={username} />}

      {/* ALL NOTIFICATIONS MODAL */}
      {showAllNotifs && (
        <div className="nlm-overlay" onClick={() => setShowAllNotifs(false)}>
          <div className="nlm-modal" style={{ maxWidth: 420, maxHeight: "80vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div className="nlm-header" style={{ position: "sticky", top: 0, background: "var(--surface)", zIndex: 2 }}>
              <div>
                <div className="nlm-title">🔔 All Notifications</div>
                <div className="nlm-sub">{notifications.length} total · {unreadCount} unread</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, color: "var(--accent)", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "4px 10px" }}>
                    Mark all read
                  </button>
                )}
                <button className="nlm-close" onClick={() => setShowAllNotifs(false)}>✕</button>
              </div>
            </div>
            {notifications.map(n => (
              <div key={n.id}
                onClick={() => setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))}
                style={{
                  display: "flex", gap: 14, padding: "14px 20px",
                  background: n.read ? "transparent" : "rgba(67,97,238,0.06)",
                  borderBottom: "1px solid var(--border)", cursor: "pointer", transition: "background 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
                onMouseLeave={e => e.currentTarget.style.background = n.read ? "transparent" : "rgba(67,97,238,0.06)"}
              >
                <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                  {n.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{n.title}</div>
                    {!n.read && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3, lineHeight: 1.5 }}>{n.msg}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5, opacity: 0.65 }}>🕐 {n.time}</div>
                </div>
              </div>
            ))}
            <div style={{ padding: "16px 20px", textAlign: "center" }}>
              <button
                onClick={() => { setNotifications([]); setShowAllNotifs(false); }}
                style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, color: "var(--muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "6px 16px" }}
              >
                Clear all notifications
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HELP DETAIL MODAL */}
      {showHelpDetail && (
        <div className="nlm-overlay" onClick={() => setShowHelpDetail(null)}>
          <div className="nlm-modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="nlm-header">
              <div>
                <div className="nlm-title">{showHelpDetail.icon} {showHelpDetail.title}</div>
                <div className="nlm-sub">ParkSmart Help</div>
              </div>
              <button className="nlm-close" onClick={() => setShowHelpDetail(null)}>✕</button>
            </div>
            <div style={{ padding: "4px 0 8px" }}>
              {showHelpDetail.detail.split("\n").map((line, i) => (
                <div key={i} style={{
                  fontSize: 13, color: line.match(/^\d+\./) ? "var(--text)" : line.startsWith("•") ? "var(--text2)" : "var(--muted)",
                  fontWeight: line.match(/^\d+\./) ? 600 : 400,
                  padding: "4px 0",
                  paddingLeft: (line.match(/^\d+\./) || line.startsWith("•")) ? 4 : 0,
                  lineHeight: 1.6,
                }}>
                  {line || <br />}
                </div>
              ))}
            </div>
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 8, display: "flex", gap: 10 }}>
              <button className="nlm-back-btn" onClick={() => { setShowHelpDetail(null); setShowHelpPanel(true); }}>← Back</button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  const subject = encodeURIComponent(`ParkSmart Help: ${showHelpDetail.title}`);
                  const body = encodeURIComponent(`Hi ParkSmart Support,\n\nI need help with: ${showHelpDetail.title}\n\n[Describe your question here]\n\nUsername: ${username}`);
                  window.open(`https://mail.google.com/mail/?view=cm&to=chananadaksh14@gmail.com&subject=${subject}&body=${body}`, "_blank");
                }}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 6, padding: "10px", borderRadius: 10, border: "none",
                  background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                📧 Email Support
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-logo">
          <img src={parksmartLogo} alt="ParkSmart" className="sidebar-logo-icon" style={{ width: 36, height: 36, objectFit: "contain" }} />
          <span className="sidebar-logo-text">Park<span>Smart</span></span>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-avatar-wrap">
            <div className="sidebar-avatar">{username[0]?.toUpperCase()}</div>
            <div className="sidebar-avatar-status" />
          </div>
          <div>
            <div className="sidebar-username">{username}</div>
            <div className="sidebar-role">Member</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button key={item.id} className={`sidebar-item ${tab === item.id ? "active" : ""}`} onClick={() => { setTab(item.id); setSidebarOpen(false); }}>
              <div className="sidebar-item-icon">{item.icon}</div>
              <span className="sidebar-item-label">{item.label}</span>
              {item.id === "active" && activeBookings.length > 0 && <span className="sidebar-live-dot" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-stats">
          <div className="sidebar-stat"><span className="sidebar-stat-dot free" /><span>{stats.free_slots ?? 0} Available</span></div>
          <div className="sidebar-stat"><span className="sidebar-stat-dot occ" /><span>{stats.occupied_slots ?? 0} Occupied</span></div>
        </div>

        <button className="sidebar-book-btn" onClick={() => setTab("booking")}>🅿️ Book Now</button>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="app-main">
        <header className="topbar" ref={topbarRef}>
          <button className="topbar-menu" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="topbar-logo"><img src={parksmartLogo} alt="ParkSmart" style={{ width: 24, height: 24, objectFit: "contain", verticalAlign: "middle", marginRight: 6 }} />Park<span>Smart</span></div>

          {/* SEARCH BAR */}
          <div className="topbar-search" style={{ position: "relative" }}>
            <span className="topbar-search-icon">🔍</span>
            <input
              placeholder="Find parking by location..."
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              onFocus={() => searchQuery.trim().length >= 2 && setShowSearchResults(true)}
            />
            <button className="topbar-filter" onClick={() => handleSearchChange(searchQuery)}>⊞</button>

            {/* SEARCH DROPDOWN */}
            {showSearchResults && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0,
                background: "var(--surface)", border: "1.5px solid var(--border)",
                borderRadius: 14, zIndex: 500, overflow: "hidden",
                boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
              }}>
                {searchResults.length === 0 ? (
                  <div style={{ padding: "20px 16px", color: "var(--muted)", fontSize: 13, textAlign: "center" }}>
                    No parking found for "{searchQuery}"
                  </div>
                ) : (
                  <>
                    <div style={{ padding: "10px 16px 6px", fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid var(--border)" }}>
                      {searchResults.length} parking lots found
                    </div>
                    {searchResults.map(lot => (
                      <div key={lot.id}
                        onClick={() => {
                          setShowSearchResults(false);
                          setSearchQuery(lot.name);
                          setTab("dashboard");
                          if (!lot.name.includes("Connaught Place")) {
                            setSelectedLot({ ...lot, highlight: false });
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          } else {
                            setSelectedLot(null);
                          }
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "12px 16px", cursor: "pointer",
                          borderBottom: "1px solid var(--border)",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                          {lot.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 2 }}>{lot.name}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{lot.area} · {lot.distance}</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                          <span style={{ background: lot.tagColor + "22", color: lot.tagColor, border: `1px solid ${lot.tagColor}44`, borderRadius: 20, fontSize: 10, fontWeight: 700, padding: "2px 8px" }}>{lot.tag}</span>
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>₹{lot.rate}/hr</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="topbar-spacer" />
          <div className="topbar-actions">

            {/* NOTIFICATIONS BUTTON */}
            <div style={{ position: "relative" }}>
              <button
                className="topbar-action-btn"
                title="Notifications"
                onClick={() => { setShowNotifPanel(!showNotifPanel); setShowProfileMenu(false); setShowHelpPanel(false); }}
                style={showNotifPanel ? { background: "var(--accent-lt)", borderColor: "var(--accent)", color: "var(--accent)" } : {}}
              >
                🔔
                {unreadCount > 0 && <span className="topbar-notif-dot" />}
              </button>
              {showNotifPanel && (
                <div style={{
                  position: "absolute", top: "calc(100% + 10px)", right: 0,
                  width: 320, background: "var(--surface)", border: "1.5px solid var(--border)",
                  borderRadius: 16, zIndex: 500, boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
                  overflow: "hidden",
                }}>
                  <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>Notifications</div>
                      {unreadCount > 0 && <div style={{ fontSize: 11, color: "var(--muted)" }}>{unreadCount} unread</div>}
                    </div>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Mark all read</button>
                    )}
                  </div>
                  {notifications.map(n => (
                    <div key={n.id}
                      onClick={() => setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))}
                      style={{
                        display: "flex", gap: 12, padding: "12px 16px",
                        background: n.read ? "transparent" : "rgba(67,97,238,0.05)",
                        borderBottom: "1px solid var(--border)", cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
                      onMouseLeave={e => e.currentTarget.style.background = n.read ? "transparent" : "rgba(67,97,238,0.05)"}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                        {n.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{n.title}</div>
                          {!n.read && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", marginTop: 4, flexShrink: 0 }} />}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{n.msg}</div>
                        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4, opacity: 0.7 }}>{n.time}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ padding: "10px 16px", textAlign: "center" }}>
                    <button style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      onClick={() => { setShowAllNotifs(true); setShowNotifPanel(false); }}>
                      View all notifications →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* HELP BUTTON */}
            <div style={{ position: "relative" }}>
              <button
                className="topbar-action-btn"
                title="Help"
                onClick={() => { setShowHelpPanel(!showHelpPanel); setShowNotifPanel(false); setShowProfileMenu(false); }}
                style={showHelpPanel ? { background: "var(--accent-lt)", borderColor: "var(--accent)", color: "var(--accent)" } : {}}
              >
                ❓
              </button>
              {showHelpPanel && (
                <div style={{
                  position: "absolute", top: "calc(100% + 10px)", right: 0,
                  width: 300, background: "var(--surface)", border: "1.5px solid var(--border)",
                  borderRadius: 16, zIndex: 500, boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
                  overflow: "hidden",
                }}>
                  <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>Help & Support</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>Quick links & FAQs</div>
                  </div>
                  {[
                    {
                      icon: "🅿️", title: "How to Book a Slot",
                      desc: "Go to Book a Slot → select a slot → enter vehicle number → confirm.",
                      detail: "Step-by-step booking:\n1. Click 'Book a Slot' in the sidebar\n2. Click any green (free) slot on the grid\n3. Enter your vehicle number (format: MH12AB1234)\n4. Click 'Confirm Booking'\n5. Show the QR code at the entry gate",
                    },
                    {
                      icon: "🤖", title: "AI Slot Recommendation",
                      desc: "Use the 'Find Best Slot with AI' button for smart suggestions.",
                      detail: "Our DQN-based AI model analyzes current slot occupancy and recommends the optimal slot for you — factoring in zone balance, proximity to entry, and real-time availability. Just click 'Find Best Slot with AI' on the booking page.",
                    },
                    {
                      icon: "📱", title: "QR Code Entry",
                      desc: "After booking, show your QR code at the parking gate.",
                      detail: "After confirming a booking, a unique QR code is generated. Present this QR at the parking entry gate for quick, contactless check-in. You can also download the QR from the Active Booking screen anytime.",
                    },
                    {
                      icon: "💳", title: "Pricing",
                      desc: "₹20/hr at ParkSmart CP. Rates vary at nearby lots.",
                      detail: "Pricing breakdown:\n• ParkSmart (Connaught Place): ₹20/hr\n• Palika Bazar Basement: ₹30/hr\n• Hudson Lane Parking: ₹20/hr\n• Janpath Multi-Level: ₹40/hr\n• Mandi House Parking: ₹20/hr\n\nMinimum charge applies per booking.",
                    },
                    {
                      icon: "🔓", title: "Release a Slot",
                      desc: "Go to Active Booking and click 'End Session' when done.",
                      detail: "To release your slot:\n1. Go to 'Active Booking' in the sidebar\n2. Click 'End Session' on your active booking\n3. Your fare will be calculated automatically\n4. The slot becomes available for others immediately",
                    },
                  ].map((item, i) => (
                    <div key={i}
                      onClick={() => { setShowHelpDetail(item); setShowHelpPanel(false); }}
                      style={{
                        display: "flex", gap: 12, padding: "12px 16px",
                        borderBottom: "1px solid var(--border)", cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>
                        {item.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text)", marginBottom: 2 }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>{item.desc}</div>
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: 14, alignSelf: "center" }}>›</div>
                    </div>
                  ))}
                  <div style={{ padding: "10px 16px", textAlign: "center" }}>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        const subject = encodeURIComponent("ParkSmart Support Request");
                        const body = encodeURIComponent(`Hi ParkSmart Support Team,\n\nI need help with:\n\n[Describe your issue here]\n\nUsername: ${username}\nDate: ${new Date().toLocaleDateString("en-IN")}`);
                        window.open(`https://mail.google.com/mail/?view=cm&to=chananadaksh14@gmail.com&subject=${subject}&body=${body}`, "_blank");
                      }}
                      style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      📧 Contact Support
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* USER AVATAR / PROFILE MENU */}
            <div style={{ position: "relative" }}>
              <div
                className="topbar-avatar"
                onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifPanel(false); setShowHelpPanel(false); }}
                style={{ cursor: "pointer", outline: showProfileMenu ? "2px solid var(--accent)" : "none", outlineOffset: 2 }}
              >
                {username[0]?.toUpperCase()}
              </div>
              {showProfileMenu && (
                <div style={{
                  position: "absolute", top: "calc(100% + 10px)", right: 0,
                  width: 240, background: "var(--surface)", border: "1.5px solid var(--border)",
                  borderRadius: 16, zIndex: 500, boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
                  overflow: "hidden",
                }}>
                  {/* User info header */}
                  <div style={{ padding: "16px", background: "var(--surface2)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#4361ee,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, color: "#fff", flexShrink: 0 }}>
                      {username[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>{username}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>Member Account</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00e676", display: "inline-block" }} />
                        <span style={{ fontSize: 10, color: "#00e676" }}>Online</span>
                      </div>
                    </div>
                  </div>
                  {/* Menu items */}
                  {[
                    { icon: "⊞", label: "Dashboard", action: () => { setTab("dashboard"); setShowProfileMenu(false); } },
                    { icon: "📋", label: "Booking History", action: () => { setTab("history"); setShowProfileMenu(false); } },
                    { icon: "⚡", label: "Active Booking", action: () => { setTab("active"); setShowProfileMenu(false); } },
                    { icon: "🔐", label: "Change Password", action: () => { setShowProfileMenu(false); setShowChangePassword(true); } },
                  ].map((item, i) => (
                    <button key={i} onClick={item.action} style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12,
                      padding: "11px 16px", background: "none", border: "none",
                      color: "var(--text2)", fontSize: 13, fontWeight: 600, cursor: "pointer",
                      borderBottom: "1px solid var(--border)", textAlign: "left",
                      transition: "background 0.15s",
                      fontFamily: "inherit",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--surface2)"; e.currentTarget.style.color = "var(--text)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text2)"; }}
                    >
                      <span style={{ fontSize: 16 }}>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                  {/* Logout */}
                  <button onClick={logout} style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px", background: "none", border: "none",
                    color: "#ff3d5a", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    textAlign: "left", transition: "background 0.15s", fontFamily: "inherit",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,61,90,0.08)"}
                    onMouseLeave={e => e.currentTarget.style.background = "none"}
                  >
                    <span style={{ fontSize: 16 }}>↪</span>
                    Logout
                  </button>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* DASHBOARD */}
        {tab === "dashboard" && (
          <div className="page">
            {/* Lot switcher banner — shown when a nearby lot is selected */}
            {selectedLot && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10, marginBottom: 10,
                background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)",
                borderRadius: 10, padding: "8px 16px",
              }}>
                <span style={{ fontSize: 18 }}>{selectedLot.icon}</span>
                <span style={{ color: "#00d4ff", fontWeight: 700, fontSize: 14 }}>
                  Viewing: {selectedLot.name}
                </span>
                <span style={{ color: "#888", fontSize: 12 }}>{selectedLot.area} · {selectedLot.distance}</span>
                <button
                  onClick={() => setSelectedLot(null)}
                  style={{
                    marginLeft: "auto", background: "none", border: "1px solid #333",
                    borderRadius: 6, color: "#aaa", fontSize: 11, padding: "3px 10px", cursor: "pointer"
                  }}
                >
                  ← Back to Your Lot
                </button>
              </div>
            )}

            <div className="stats-row">
              {(() => {
                // When a nearby lot is selected, show its data; otherwise show live backend stats
                const isOwn = !selectedLot;
                const dispTotal    = isOwn ? stats.total_slots    : selectedLot.total;
                const dispFree     = isOwn ? stats.free_slots     : selectedLot.available;
                const dispOccupied = isOwn ? stats.occupied_slots : (selectedLot.total - selectedLot.available);
                const occPct       = dispTotal ? Math.round((dispOccupied / dispTotal) * 100) : 0;
                const subTotal     = isOwn ? "Across 4 zones" : `${selectedLot.area}`;
                const subBookings  = isOwn ? `${stats.active_bookings} active now` : "External lot";
                return [
                  { c: "#00d4ff", icon: "🅿️", label: "Total Slots",    val: dispTotal,                                    sub: subTotal },
                  { c: "#00e676", icon: "✅",  label: "Available",      val: dispFree,     color: "var(--green)",           sub: "Free right now" },
                  { c: "#ff3d5a", icon: "🚗", label: "Occupied",       val: dispOccupied, color: "var(--red)",             sub: `${occPct}% capacity` },
                  { c: "#ffd600", icon: "📋", label: "Total Bookings", val: isOwn ? stats.total_bookings : "—",           sub: subBookings },
                ];
              })().map(s => (
                <div key={s.label} className="stat-card" style={{ "--c": s.c }}>
                  <div className="stat-icon">{s.icon}</div>
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value" style={s.color ? { color: s.color } : {}}>{s.val}</div>
                  <div className="stat-sub">{s.sub}</div>
                </div>
              ))}
            </div>

            <div className="dashboard-body">
              <div className="dashboard-map-wrap">
                <div className="map-outer">
                  <div className="map-current-area">
                    <div className="map-current-area-label">Current Area</div>
                    <div className="map-current-area-name">Connaught Place</div>
                    <div className="map-current-area-stats">
                      <div className="map-avail"><span className="map-avail-dot" />{stats.free_slots ?? 0} Available</div>
                      <div className="map-occ"><span className="map-occ-dot" />{stats.occupied_slots ?? 0} Occupied</div>
                    </div>
                  </div>
                  <div className="map-controls">
                    <button className="map-ctrl-btn" title="My location">📍</button>
                    <button className="map-ctrl-btn" title="Layers">🗂</button>
                  </div>
                  <MapView slots={slots} stats={stats} activeBookings={activeBookings} />
                </div>
              </div>

              <div className="dashboard-right">
                {activeBookings.length > 0 && (
                  <div className="section active-session-card">
                    <div className="active-session-header">
                      <span className="active-session-badge">ACTIVE SESSIONS</span>
                      <span className="active-live"><span className="active-dot" />{activeBookings.length} PARKED</span>
                    </div>
                    {activeBookings.map((b, i) => (
                      <div key={b.booking_id} style={i > 0 ? { borderTop: "1px solid #1e2d45", paddingTop: 10, marginTop: 10 } : {}}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div className="active-session-slot" style={{ fontSize: 20 }}>S{b.slot_number}</div>
                          <div className="active-session-vehicle" style={{ fontSize: 13 }}>{b.vehicle_number}</div>
                        </div>
                        <div className="active-session-timer-row">
                          <div><div className="active-session-timer-label">Duration</div><LiveTimer bookedAt={b.booked_at} /></div>
                          <div><div className="active-session-timer-label">Est. Cost</div><span className="active-session-cost">₹{Math.max(10, Math.ceil((Date.now() - parseUTC(b.booked_at)) / 1800000) * 10)}</span></div>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button className="end-session-btn" style={{ flex: 1, fontSize: 12 }} onClick={() => releaseSlot(b.booking_id)}>Release →</button>
                          <button className="qr-session-btn" style={{ flex: 1, fontSize: 12 }} onClick={() => { setQrBookingId(b.booking_id); setShowQr(true); }}>QR</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* NEARBY LOTS PANEL */}
                <NearbyLots onBook={() => setTab("booking")} username={username} stats={stats} onLotSelect={lot => { setSelectedLot(lot); window.scrollTo({ top: 0, behavior: "smooth" }); }} selectedLotId={selectedLot?.id ?? null} />
              </div>
            </div>
          </div>
        )}

        {/* MAP VIEW */}
        {tab === "map" && (
          <div className="page">
            <div className="page-title">🗺 Map View</div>
            <div className="map-page-layout">
              <div className="map-page-main section">
                <MapView slots={slots} stats={stats} activeBookings={activeBookings} />
              </div>
              <div className="map-page-side">
                <div className="section" style={{ marginBottom: 16 }}>
                  <div className="section-title" style={{ marginBottom: 10 }}>📍 Current Area</div>
                  <div className="map-area-name">Connaught Place</div>
                  <div className="map-area-sub">New Delhi, India</div>
                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <div className="map-badge map-badge-green">● {stats.free_slots ?? 0} Available</div>
                    <div className="map-badge map-badge-red">● {stats.occupied_slots ?? 0} Occupied</div>
                  </div>
                </div>
                <div className="section" style={{ marginBottom: 16 }}>
                  <div className="section-title" style={{ marginBottom: 12 }}>Lot Status</div>
                  <div className="map-status-bar"><div className="map-status-fill" style={{ width: stats.total_slots ? `${(stats.occupied_slots / stats.total_slots) * 100}%` : "0%" }} /></div>
                  <div className="map-status-labels">
                    <span style={{ color: "var(--green)" }}>{stats.free_slots} free</span>
                    <span style={{ color: "var(--red)" }}>{stats.occupied_slots} occupied</span>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    {["A", "B"].map(zone => {
                      const zSlots = slots.filter(s => s.zone === zone);
                      return (
                        <div key={zone} className="map-zone-row">
                          <div className="map-zone-name">Zone {zone}</div>
                          <div className="map-zone-slots">{zSlots.map(s => <div key={s.slot_number} className={`map-mini-slot ${s.is_occupied ? "occ" : "free"} ${activeBookings && activeBookings.some(b => b.slot_number === s.slot_number) ? "yours" : ""}`} />)}</div>
                          <div className="map-zone-count">{zSlots.filter(s => !s.is_occupied).length}/{zSlots.length}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <a href="https://www.google.com/maps/dir/?api=1&destination=28.6139,77.2090" target="_blank" rel="noopener noreferrer" className="map-directions-btn">🧭 Get Directions</a>
              </div>
            </div>
          </div>
        )}

        {/* BOOK A SLOT */}
        {tab === "booking" && (
          <div className="page">
            <div className="page-title">🅿️ Book a Slot</div>
            <div className="booking-page-layout">
              <div className="section">
                <div className="section-header">
                  <div><div className="section-title">Parking Lot</div><div className="section-sub">Click a free slot to select it</div></div>
                  <div className="legend">
                    <span><span className="legend-dot" style={{ background: "rgba(0,230,118,0.4)" }} />Free</span>
                    <span><span className="legend-dot" style={{ background: "rgba(255,61,90,0.4)" }} />Occupied</span>
                    <span><span className="legend-dot" style={{ background: "var(--accent)" }} />AI Pick</span>
                  </div>
                </div>
                {Object.entries(
                  slots.reduce((acc, s) => { (acc[s.zone] = acc[s.zone] || []).push(s); return acc; }, {})
                ).sort().map(([zone, data]) => (
                  <div className="zone-block" key={zone}>
                    <div className="zone-label">Zone {zone}</div>
                    <div className="slots-grid">
                      {data.map(s => {
                        const isSelected = selectedSlots.some(sel => sel.slot_number === s.slot_number);
                        const isActive = activeBookings.some(b => b.slot_number === s.slot_number);
                        return (
                          <div key={s.slot_number} onClick={() => handleSlotClick(s.slot_number, s.is_occupied)}
                            className={`slot ${s.is_occupied ? "occupied" : "free"} ${recommended === s.slot_number && !s.is_occupied ? "recommended" : ""} ${isSelected ? "recommended" : ""}`}
                            style={isSelected ? { outline: "2px solid #00d4ff", outlineOffset: 1 } : isActive ? { outline: "2px solid #00e676", outlineOffset: 1 } : {}}>
                            {isActive ? "✓" : s.is_occupied ? "🚗" : isSelected ? "●" : "P"}
                            <span className="slot-num">S{s.slot_number}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <button className="ai-btn" onClick={findBestSlot} disabled={aiLoading}>{aiLoading ? "Analysing..." : "🤖 Find Best Slot with AI"}</button>
                {recommended !== null && <div className="ai-result"><div className="ai-result-slot">AI Recommends: Slot S{recommended}</div><div className="ai-result-text">{explanation}</div></div>}
              </div>

              <div className="booking-panel">
                <div className="section">
                  <div className="section-title" style={{ marginBottom: 4 }}>
                    Book Slots
                    {selectedSlots.length > 0 && (
                      <span style={{ marginLeft: 8, background: "#00d4ff22", color: "#00d4ff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, border: "1px solid #00d4ff44" }}>
                        {selectedSlots.length} selected
                      </span>
                    )}
                  </div>
                  <div className="section-sub" style={{ marginBottom: 16 }}>
                    {selectedSlots.length === 0 ? "Click slots on the grid to select (multiple allowed)" : `${selectedSlots.length} slot${selectedSlots.length > 1 ? "s" : ""} selected — enter vehicle number${selectedSlots.length > 1 ? "s" : ""} below`}
                  </div>

                  {selectedSlots.length === 0 ? (
                    <div style={{ color: "#555", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                      No slots selected yet
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {selectedSlots.map((s, idx) => (
                        <div key={s.slot_number} style={{ background: "var(--card2, #111827)", borderRadius: 10, padding: "10px 12px", border: "1px solid #1e2d45" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontWeight: 700, color: "#00d4ff", fontSize: 13 }}>Slot S{s.slot_number}</span>
                            <button onClick={() => setSelectedSlots(prev => prev.filter(x => x.slot_number !== s.slot_number))}
                              style={{ background: "none", border: "none", color: "#ff3d5a", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}>✕</button>
                          </div>
                          <input
                            className="text-input"
                            placeholder="Vehicle No. e.g. MH12AB1234"
                            value={s.vehicle}
                            onChange={e => setSelectedSlots(prev => prev.map((x, i) => i === idx ? { ...x, vehicle: e.target.value.toUpperCase() } : x))}
                            style={{ marginBottom: 0 }}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <button className="book-btn" style={{ marginTop: 16 }} onClick={bookSlots}
                    disabled={selectedSlots.length === 0 || selectedSlots.some(s => !s.vehicle.trim())}>
                    Confirm {selectedSlots.length > 1 ? `${selectedSlots.length} Bookings` : "Booking"} →
                  </button>
                  {bookMsg.text && <div className={`msg msg-${bookMsg.type}`}>{bookMsg.text}</div>}
                </div>

                {activeBookings.length > 0 && (
                  <div className="section" style={{ marginTop: 16 }}>
                    <div className="section-title" style={{ marginBottom: 12 }}>
                      Active Bookings
                      <span style={{ marginLeft: 8, background: "#00e67622", color: "#00e676", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, border: "1px solid #00e67644" }}>
                        {activeBookings.length} parked
                      </span>
                    </div>
                    {activeBookings.map(b => (
                      <div key={b.booking_id} className="active-booking" style={{ marginBottom: 10 }}>
                        <div className="active-booking-header"><div className="active-booking-title">S{b.slot_number} · {b.vehicle_number}</div><div className="active-dot" /></div>
                        <div className="active-booking-row"><span>Since</span><span>{timeAgo(b.booked_at)}</span></div>
                        <div className="active-booking-row"><span>Est. Cost</span><span style={{ color: "#ffd600" }}>₹{Math.max(10, Math.ceil((Date.now() - parseUTC(b.booked_at)) / 1800000) * 10)}</span></div>
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button className="book-btn" style={{ flex: 1, fontSize: 12 }} onClick={() => { setQrBookingId(b.booking_id); setShowQr(true); }}>QR</button>
                          <button className="release-btn" style={{ flex: 2, fontSize: 12 }} onClick={() => releaseSlot(b.booking_id)}>Release →</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ACTIVE BOOKING */}
        {tab === "active" && (
          <div className="page">
            <div className="page-title">
              ⚡ Active Bookings
              {activeBookings.length > 0 && (
                <span style={{ marginLeft: 10, background: "#00e67622", color: "#00e676", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20, border: "1px solid #00e67644", verticalAlign: "middle" }}>
                  {activeBookings.length} parked
                </span>
              )}
            </div>

            {activeBookings.length === 0 ? (
              <div className="section" style={{ textAlign: "center", padding: "60px 24px" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🅿️</div>
                <div className="section-title" style={{ marginBottom: 8 }}>No Active Bookings</div>
                <div className="section-sub" style={{ marginBottom: 20 }}>You are not currently parked anywhere</div>
                <button className="book-btn" style={{ width: "auto", padding: "12px 28px" }} onClick={() => setTab("booking")}>Book a Slot →</button>
              </div>
            ) : (
              <div className="active-page-layout">
                {activeBookings.map(b => (
                  <div key={b.booking_id} className="section active-page-card" style={{ marginBottom: 16 }}>
                    <div className="active-session-header">
                      <span className="active-session-badge">ACTIVE SESSION</span>
                      <span className="active-live"><span className="active-dot" />LIVE</span>
                    </div>
                    <div className="active-page-slot">Slot S{b.slot_number}</div>
                    <div className="active-page-vehicle">{b.vehicle_number}</div>
                    <div className="active-page-meta">
                      <div className="active-page-meta-item">
                        <div className="active-page-meta-label">Duration</div>
                        <LiveTimer bookedAt={b.booked_at} />
                      </div>
                      <div className="active-page-meta-item">
                        <div className="active-page-meta-label">Est. Cost</div>
                        <div className="active-page-cost">₹{Math.max(10, Math.ceil((Date.now() - parseUTC(b.booked_at)) / 1800000) * 10)}</div>
                      </div>
                      <div className="active-page-meta-item">
                        <div className="active-page-meta-label">Since</div>
                        <div style={{ fontSize: 13, color: "var(--text)" }}>{timeAgo(b.booked_at)}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                      <button className="end-session-btn" style={{ flex: 1 }} onClick={() => releaseSlot(b.booking_id)}>End Session →</button>
                      <button className="qr-session-btn" style={{ flex: 1 }} onClick={() => { setQrBookingId(b.booking_id); setShowQr(true); }}>Show QR Code</button>
                    </div>
                    {bookMsg.text && <div className={`msg msg-${bookMsg.type}`} style={{ marginTop: 14 }}>{bookMsg.text}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* HISTORY */}
        {tab === "history" && (
          <div className="page">
            <div className="page-title">📋 Booking History</div>
            <div className="section">
              <div className="section-sub" style={{ marginBottom: 16 }}>All your past and active bookings</div>
              {history.length === 0 ? (
                <div className="empty-state">No bookings yet. Book your first slot!</div>
              ) : (
                <div className="history-table-wrap">
                  <table className="history-table">
                    <thead><tr><th>#</th><th>Slot</th><th>Vehicle</th><th>Booked At</th><th>Released At</th><th>Fare</th><th>Status</th></tr></thead>
                    <tbody>
                      {history.map((b, i) => (
                        <tr key={b.id}>
                          <td style={{ color: "var(--muted)" }}>{i + 1}</td>
                          <td>S{b.slot_number}</td><td>{b.vehicle_number}</td>
                          <td>{formatDate(b.booked_at)}</td><td>{formatDate(b.released_at)}</td>
                          <td style={{ color: "var(--green)", fontWeight: 600 }}>{b.status === "completed" && b.released_at && b.booked_at ? "₹" + Math.max(10, Math.ceil((parseUTC(b.released_at) - parseUTC(b.booked_at)) / 1800000) * 10) : "—"}</td>
                          <td><span className={`status-badge status-${b.status}`}>{b.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
