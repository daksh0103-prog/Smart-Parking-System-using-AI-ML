import React, { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";
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

function MapView({ slots, stats, activeBooking }) {
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
      { lat: 28.6205, lng: 77.2012, name: "Shivaji Stadium Parking", area: "Baba Kharak Singh Marg", available: 12, total: 50, rate: 20 },
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
        const isAct = activeBooking && activeBooking.slot_number === s.slot_number;
        const color = isAct ? "#ffd600" : s.is_occupied ? "#ff3d5a" : "#00e676";
        const lbl = isAct ? "YOU" : s.is_occupied ? "🚗" : "P";
        const ic = L.divIcon({ className: "", html: `<div style="width:34px;height:34px;background:${color};color:#000;font-weight:800;font-size:10px;border-radius:7px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);border:2px solid rgba(255,255,255,0.4);">${lbl}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
        markersRef.current.push(L.marker([base.latBase, base.lngBase + i * 0.00032], { icon: ic }).addTo(map).bindPopup(`<b>S${s.slot_number}</b> · Zone ${zone}<br>${s.is_occupied ? "🔴 Occupied" : "🟢 Free"}`));
      });
    });
  }, [leafletReady, slots, stats, activeBooking]);

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
  },
  {
    id: 3,
    name: "Shivaji Stadium Parking",
    area: "Baba Kharak Singh Marg",
    distance: "0.7 km",
    available: 12,
    total: 50,
    rate: 20,
    rating: 3.9,
    tag: "OPEN",
    tagColor: "#00e676",
    icon: "🏟️",
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
            <button className="nl-book-btn" style={{ marginTop: 16 }} onClick={onClose}>Done</button>
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
                <button
                  className="nl-book-btn"
                  onClick={e => {
                    e.stopPropagation();
                    if (lot.highlight) { onBook(); }
                    else { setBookingLot(lot); }
                  }}
                >
                  Book a Spot →
                </button>
              </div>
            )}
          </div>
        ))}
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
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [activeBooking, setActiveBooking] = useState(null);
  const [bookMsg, setBookMsg] = useState({ type: "", text: "" });
  const [qrBookingId, setQrBookingId] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ total_slots: 0, occupied_slots: 0, free_slots: 0, total_bookings: 0, active_bookings: 0 });
  const [selectedLot, setSelectedLot] = useState(null); // null = YOUR LOT (live from stats)

  const fetchSlots = useCallback(async () => { try { const r = await fetch(`${API}/slots`); setSlots(await r.json()); } catch {} }, []);
  const fetchStats = useCallback(async () => { try { const r = await fetch(`${API}/stats`); setStats(await r.json()); } catch {} }, []);
  const fetchActiveBooking = useCallback(async () => { if (!username) return; try { const r = await fetch(`${API}/active-booking/${username}`); const d = await r.json(); setActiveBooking(d.active ? d : null); } catch {} }, [username]);
  const fetchHistory = useCallback(async () => { if (!username) return; try { const r = await fetch(`${API}/history/${username}`); setHistory(await r.json()); } catch {} }, [username]);

  useEffect(() => {
    if (loggedIn) {
      fetchSlots(); fetchStats(); fetchActiveBooking(); fetchHistory();
      const id = setInterval(() => { fetchSlots(); fetchStats(); fetchActiveBooking(); }, 5000);
      return () => clearInterval(id);
    }
  }, [loggedIn, fetchSlots, fetchStats, fetchActiveBooking]);

  useEffect(() => { if (tab === "history") fetchHistory(); }, [tab, fetchHistory]);

  const handleSlotClick = (slotNum, isOccupied) => { if (isOccupied) return; setSelectedSlot(slotNum); setRecommended(null); setBookMsg({ type: "", text: "" }); };

  const findBestSlot = async () => {
    setAiLoading(true); setRecommended(null);
    try {
      const r = await fetch(`${API}/allocate-slot`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slots: slots.map(s => s.is_occupied ? 1 : 0) }) });
      const d = await r.json(); setRecommended(d.recommended_slot); setSelectedSlot(d.recommended_slot); setExplanation(d.explanation);
    } catch { setExplanation("Could not connect to AI backend."); } finally { setAiLoading(false); }
  };

  const bookSlot = async () => {
    if (selectedSlot === null) { setBookMsg({ type: "error", text: "Please select a slot first." }); return; }
    if (!vehicle.trim()) { setBookMsg({ type: "error", text: "Enter your vehicle number." }); return; }
    if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/.test(vehicle.trim().toUpperCase())) { setBookMsg({ type: "error", text: "Invalid format! Example: MH12AB1234" }); return; }
    setBookMsg({ type: "", text: "" });
    try {
      const r = await fetch(`${API}/book`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot_number: selectedSlot, vehicle_number: vehicle, username }) });
      const d = await r.json();
      if (r.ok) { setBookMsg({ type: "success", text: `✓ Slot S${selectedSlot} booked!` }); setQrBookingId(d.booking_id); setShowQr(true); setVehicle(""); setSelectedSlot(null); setRecommended(null); fetchSlots(); fetchStats(); fetchActiveBooking(); }
      else { setBookMsg({ type: "error", text: d.detail || "Booking failed." }); }
    } catch { setBookMsg({ type: "error", text: "Server error." }); }
  };

  const releaseSlot = async () => {
    if (!activeBooking) return;
    try {
      const r = await fetch(`${API}/release`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ booking_id: activeBooking.booking_id }) });
      const d = await r.json();
      if (r.ok) { setBookMsg({ type: "success", text: `✓ Released! ${d.duration_minutes} min · ₹${d.fare}` }); setActiveBooking(null); setShowQr(false); setQrBookingId(null); fetchSlots(); fetchStats(); fetchHistory(); }
    } catch {}
  };

  const logout = () => { setLoggedIn(false); setUsername(""); setIsAdmin(false); };
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

      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🚗</div>
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
              {item.id === "active" && activeBooking && <span className="sidebar-live-dot" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-stats">
          <div className="sidebar-stat"><span className="sidebar-stat-dot free" /><span>{stats.free_slots ?? 0} Available</span></div>
          <div className="sidebar-stat"><span className="sidebar-stat-dot occ" /><span>{stats.occupied_slots ?? 0} Occupied</span></div>
        </div>

        <button className="sidebar-book-btn" onClick={() => setTab("booking")}>🅿️ Book Now</button>
        <button className="sidebar-logout" onClick={logout}>↪ Logout</button>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="app-main">
        <header className="topbar">
          <button className="topbar-menu" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="topbar-logo">🚗 Park<span>Smart</span></div>
          <div className="topbar-search">
            <span className="topbar-search-icon">🔍</span>
            <input placeholder="Find parking by location..." />
            <button className="topbar-filter">⊞</button>
          </div>
          <div className="topbar-spacer" />
          <div className="topbar-actions">
            <button className="topbar-action-btn" title="Notifications">
              🔔
              <span className="topbar-notif-dot" />
            </button>
            <button className="topbar-action-btn" title="Help">❓</button>
            <div className="topbar-avatar">{username[0]?.toUpperCase()}</div>
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
                  <MapView slots={slots} stats={stats} activeBooking={activeBooking} />
                </div>
              </div>

              <div className="dashboard-right">
                {activeBooking ? (
                  <div className="section active-session-card">
                    <div className="active-session-header">
                      <span className="active-session-badge">ACTIVE SESSION</span>
                      <span className="active-live"><span className="active-dot" />LIVE</span>
                    </div>
                    <div className="active-session-slot">Slot S{activeBooking.slot_number}</div>
                    <div className="active-session-vehicle">{activeBooking.vehicle_number}</div>
                    <div className="active-session-timer-row">
                      <div><div className="active-session-timer-label">Duration</div><LiveTimer bookedAt={activeBooking.booked_at} /></div>
                      <div><div className="active-session-timer-label">Est. Cost</div><span className="active-session-cost">₹{Math.max(10, Math.ceil((Date.now() - parseUTC(activeBooking.booked_at)) / 1800000) * 10)}</span></div>
                    </div>
                    <button className="end-session-btn" onClick={releaseSlot}>End Session →</button>
                    <button className="qr-session-btn" onClick={() => { setQrBookingId(activeBooking.booking_id); setShowQr(true); }}>Show QR Code</button>
                  </div>
                ) : null}

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
                <MapView slots={slots} stats={stats} activeBooking={activeBooking} />
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
                          <div className="map-zone-slots">{zSlots.map(s => <div key={s.slot_number} className={`map-mini-slot ${s.is_occupied ? "occ" : "free"} ${activeBooking && activeBooking.slot_number === s.slot_number ? "yours" : ""}`} />)}</div>
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
                {[{ label: "Zone A", data: zoneA }, { label: "Zone B", data: zoneB }].map(({ label, data }) => (
                  <div className="zone-block" key={label}>
                    <div className="zone-label">{label}</div>
                    <div className="slots-grid">
                      {data.map(s => (
                        <div key={s.slot_number} onClick={() => handleSlotClick(s.slot_number, s.is_occupied)}
                          className={`slot ${s.is_occupied ? "occupied" : "free"} ${(recommended === s.slot_number || selectedSlot === s.slot_number) && !s.is_occupied ? "recommended" : ""}`}>
                          {s.is_occupied ? "🚗" : "P"}<span className="slot-num">S{s.slot_number}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <button className="ai-btn" onClick={findBestSlot} disabled={aiLoading}>{aiLoading ? "Analysing..." : "🤖 Find Best Slot with AI"}</button>
                {recommended !== null && <div className="ai-result"><div className="ai-result-slot">AI Recommends: Slot S{recommended}</div><div className="ai-result-text">{explanation}</div></div>}
              </div>

              <div className="booking-panel">
                {activeBooking ? (
                  <div className="section">
                    <div className="section-title" style={{ marginBottom: 14 }}>Active Booking</div>
                    <div className="active-booking">
                      <div className="active-booking-header"><div className="active-booking-title">PARKED</div><div className="active-dot" /></div>
                      <div className="active-booking-row"><span>Slot</span><span>S{activeBooking.slot_number}</span></div>
                      <div className="active-booking-row"><span>Vehicle</span><span>{activeBooking.vehicle_number}</span></div>
                      <div className="active-booking-row"><span>Since</span><span>{timeAgo(activeBooking.booked_at)}</span></div>
                      <button className="book-btn" style={{ marginTop: 10, fontSize: 13 }} onClick={() => { setQrBookingId(activeBooking.booking_id); setShowQr(true); }}>Show Entry QR</button>
                      <button className="release-btn" onClick={releaseSlot}>Release Slot →</button>
                    </div>
                    {bookMsg.text && <div className={`msg msg-${bookMsg.type}`}>{bookMsg.text}</div>}
                  </div>
                ) : (
                  <div className="section">
                    <div className="section-title" style={{ marginBottom: 4 }}>Book a Slot</div>
                    <div className="section-sub" style={{ marginBottom: 16 }}>{selectedSlot !== null ? `Slot S${selectedSlot} selected` : "Select a slot from the grid"}</div>
                    <label className="input-label">Selected Slot</label>
                    <input className="text-input" value={selectedSlot !== null ? `Slot S${selectedSlot}` : ""} placeholder="Click a slot on the grid" readOnly />
                    <div style={{ marginTop: 14 }}>
                      <label className="input-label">Vehicle Number</label>
                      <input className="text-input" placeholder="e.g. MH12AB1234" value={vehicle} onChange={e => setVehicle(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && bookSlot()} />
                    </div>
                    <button className="book-btn" style={{ marginTop: 16 }} onClick={bookSlot} disabled={selectedSlot === null || !vehicle.trim()}>Confirm Booking →</button>
                    {bookMsg.text && <div className={`msg msg-${bookMsg.type}`}>{bookMsg.text}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ACTIVE BOOKING */}
        {tab === "active" && (
          <div className="page">
            <div className="page-title">⚡ Active Booking</div>
            {activeBooking ? (
              <div className="active-page-layout">
                <div className="section active-page-card">
                  <div className="active-session-header">
                    <span className="active-session-badge">ACTIVE SESSION</span>
                    <span className="active-live"><span className="active-dot" />LIVE</span>
                  </div>
                  <div className="active-page-slot">Slot S{activeBooking.slot_number}</div>
                  <div className="active-page-vehicle">{activeBooking.vehicle_number}</div>
                  <div className="active-page-meta">
                    <div className="active-page-meta-item"><div className="active-page-meta-label">Duration</div><LiveTimer bookedAt={activeBooking.booked_at} /></div>
                    <div className="active-page-meta-item"><div className="active-page-meta-label">Est. Cost</div><div className="active-page-cost">₹{Math.max(10, Math.ceil((Date.now() - parseUTC(activeBooking.booked_at)) / 1800000) * 10)}</div></div>
                    <div className="active-page-meta-item"><div className="active-page-meta-label">Since</div><div style={{ fontSize: 13, color: "var(--text)" }}>{timeAgo(activeBooking.booked_at)}</div></div>
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                    <button className="end-session-btn" style={{ flex: 1 }} onClick={releaseSlot}>End Session →</button>
                    <button className="qr-session-btn" style={{ flex: 1 }} onClick={() => { setQrBookingId(activeBooking.booking_id); setShowQr(true); }}>Show QR Code</button>
                  </div>
                  {bookMsg.text && <div className={`msg msg-${bookMsg.type}`} style={{ marginTop: 14 }}>{bookMsg.text}</div>}
                </div>
              </div>
            ) : (
              <div className="section" style={{ textAlign: "center", padding: "60px 24px" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🅿️</div>
                <div className="section-title" style={{ marginBottom: 8 }}>No Active Booking</div>
                <div className="section-sub" style={{ marginBottom: 20 }}>You are not currently parked anywhere</div>
                <button className="book-btn" style={{ width: "auto", padding: "12px 28px" }} onClick={() => setTab("booking")}>Book a Slot →</button>
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
