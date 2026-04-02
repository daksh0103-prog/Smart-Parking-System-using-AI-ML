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
    markersRef.current.push(L.marker([PARKING_LAT, PARKING_LNG], { icon: pi }).addTo(map).bindPopup(`<b>ParkSmart</b><br>${stats.free_slots ?? 0} slots free`));

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
    { id: "map", icon: "🗺", label: "Map View" },
    { id: "booking", icon: "🅿️", label: "Book a Slot" },
    { id: "active", icon: "⚡", label: "Active Booking" },
    { id: "history", icon: "📋", label: "Booking History" },
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
          <span>🚗</span>
          <span className="sidebar-logo-text">Park<span>Smart</span></span>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-avatar">{username[0]?.toUpperCase()}</div>
          <div>
            <div className="sidebar-username">{username}</div>
            <div className="sidebar-role">Member</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button key={item.id} className={`sidebar-item ${tab === item.id ? "active" : ""}`} onClick={() => { setTab(item.id); setSidebarOpen(false); }}>
              <span className="sidebar-item-icon">{item.icon}</span>
              <span className="sidebar-item-label">{item.label}</span>
              {item.id === "active" && activeBooking && <span className="sidebar-live-dot" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-stats">
          <div className="sidebar-stat"><span className="sidebar-stat-dot free" /><span>{stats.free_slots ?? 0} Available</span></div>
          <div className="sidebar-stat"><span className="sidebar-stat-dot occ" /><span>{stats.occupied_slots ?? 0} Occupied</span></div>
        </div>

        <button className="sidebar-logout" onClick={logout}>↪ Logout</button>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="app-main">
        <header className="topbar">
          <button className="topbar-menu" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="topbar-logo">🚗 Park<span>Smart</span></div>
          <div className="topbar-user">{username[0]?.toUpperCase()}</div>
        </header>

        {/* DASHBOARD */}
        {tab === "dashboard" && (
          <div className="page">
            <div className="stats-row">
              {[
                { c: "#00d4ff", icon: "🅿️", label: "Total Slots", val: stats.total_slots, sub: "Across 2 zones" },
                { c: "#00e676", icon: "✅", label: "Available", val: stats.free_slots, color: "var(--green)", sub: "Free right now" },
                { c: "#ff3d5a", icon: "🚗", label: "Occupied", val: stats.occupied_slots, color: "var(--red)", sub: `${stats.total_slots ? Math.round((stats.occupied_slots / stats.total_slots) * 100) : 0}% capacity` },
                { c: "#ffd600", icon: "📋", label: "Total Bookings", val: stats.total_bookings, sub: `${stats.active_bookings} active now` },
              ].map(s => (
                <div key={s.label} className="stat-card" style={{ "--c": s.c }}>
                  <div className="stat-icon">{s.icon}</div>
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value" style={s.color ? { color: s.color } : {}}>{s.val}</div>
                  <div className="stat-sub">{s.sub}</div>
                </div>
              ))}
            </div>

            <div className="dashboard-body">
              <div className="dashboard-map-wrap section">
                <div className="section-header" style={{ marginBottom: 14 }}>
                  <div>
                    <div className="section-title">📍 Parking Lot Location</div>
                    <div className="section-sub">Live markers · green = free · red = occupied</div>
                  </div>
                  <div className="map-legend">
                    <span><span className="map-dot" style={{ background: "#00e676" }} />Free</span>
                    <span><span className="map-dot" style={{ background: "#ff3d5a" }} />Occupied</span>
                    {activeBooking && <span><span className="map-dot" style={{ background: "#ffd600" }} />You</span>}
                  </div>
                </div>
                <MapView slots={slots} stats={stats} activeBooking={activeBooking} />
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
                ) : (
                  <div className="section no-session-card">
                    <div className="no-session-icon">🅿️</div>
                    <div className="no-session-text">No Active Session</div>
                    <div className="no-session-sub">Book a slot to start parking</div>
                    <button className="book-now-btn" onClick={() => setTab("booking")}>Book Now →</button>
                  </div>
                )}

                {history.length > 0 && (
                  <div className="section" style={{ marginTop: 16 }}>
                    <div className="section-header" style={{ marginBottom: 12 }}>
                      <div className="section-title">Recent Bookings</div>
                      <button className="view-all-btn" onClick={() => setTab("history")}>View All →</button>
                    </div>
                    {history.slice(0, 3).map(b => (
                      <div key={b.id} className="recent-booking-row">
                        <div className="recent-booking-icon">🎫</div>
                        <div className="recent-booking-info">
                          <div className="recent-booking-slot">Slot S{b.slot_number} · {b.vehicle_number}</div>
                          <div className="recent-booking-date">{formatDate(b.booked_at)}</div>
                        </div>
                        <div className="recent-booking-fare">
                          {b.status === "completed" && b.released_at ? `₹${Math.max(10, Math.ceil((parseUTC(b.released_at) - parseUTC(b.booked_at)) / 1800000) * 10)}` : <span className={`status-badge status-${b.status}`}>{b.status}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
