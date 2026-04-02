import React, { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";
import Login from "./Login";
import AdminLogin from "./AdminLogin";
import AdminPanel from "./AdminPanel";
import ResetPassword from "./ResetPassword";

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-IN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Kolkata"
  });
}

// Live timer for active booking
function LiveTimer({ bookedAt }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const calc = () => setElapsed(Math.floor((Date.now() - new Date(bookedAt)) / 1000));
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [bookedAt]);
  const h = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const s = String(elapsed % 60).padStart(2, "0");
  return <>{h}:{m}:{s}</>;
}

function computeFare(bookedAt) {
  const mins = Math.floor((Date.now() - new Date(bookedAt)) / 60000);
  return Math.max(10, Math.ceil(mins / 30) * 10);
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [tab, setTab] = useState("parking");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

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

  const [liveFare, setLiveFare] = useState(0);

  // Update fare live
  useEffect(() => {
    if (!activeBooking) return;
    const id = setInterval(() => setLiveFare(computeFare(activeBooking.booked_at)), 5000);
    setLiveFare(computeFare(activeBooking.booked_at));
    return () => clearInterval(id);
  }, [activeBooking]);

  const fetchSlots = useCallback(async () => {
    try { const r = await fetch(`${API}/slots`); setSlots(await r.json()); } catch {}
  }, []);

  const fetchStats = useCallback(async () => {
    try { const r = await fetch(`${API}/stats`); setStats(await r.json()); } catch {}
  }, []);

  const fetchActiveBooking = useCallback(async () => {
    if (!username) return;
    try {
      const r = await fetch(`${API}/active-booking/${username}`);
      const d = await r.json();
      setActiveBooking(d.active ? d : null);
    } catch {}
  }, [username]);

  const fetchHistory = useCallback(async () => {
    if (!username) return;
    try { const r = await fetch(`${API}/history/${username}`); setHistory(await r.json()); } catch {}
  }, [username]);

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
    setSelectedSlot(slotNum);
    setRecommended(null);
    setBookMsg({ type: "", text: "" });
  };

  const findBestSlot = async () => {
    setAiLoading(true); setRecommended(null);
    try {
      const r = await fetch(`${API}/allocate-slot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: slots.map(s => s.is_occupied ? 1 : 0) }),
      });
      const d = await r.json();
      setRecommended(d.recommended_slot);
      setSelectedSlot(d.recommended_slot);
      setExplanation(d.explanation);
    } catch { setExplanation("Could not connect to AI backend."); }
    finally { setAiLoading(false); }
  };

  const bookSlot = async () => {
    if (selectedSlot === null) { setBookMsg({ type: "error", text: "Please select a slot first." }); return; }
    if (!vehicle.trim()) { setBookMsg({ type: "error", text: "Enter your vehicle number." }); return; }
    const vehicleRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/;
    if (!vehicleRegex.test(vehicle.trim().toUpperCase())) {
      setBookMsg({ type: "error", text: "Invalid format! Example: MH12AB1234" }); return;
    }
    setBookMsg({ type: "", text: "" });
    try {
      const r = await fetch(`${API}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_number: selectedSlot, vehicle_number: vehicle, username }),
      });
      const d = await r.json();
      if (r.ok) {
        setBookMsg({ type: "success", text: `✓ Slot S${selectedSlot} booked!` });
        setQrBookingId(d.booking_id); setShowQr(true);
        setVehicle(""); setSelectedSlot(null); setRecommended(null);
        fetchSlots(); fetchStats(); fetchActiveBooking();
      } else {
        setBookMsg({ type: "error", text: d.detail || "Booking failed." });
      }
    } catch { setBookMsg({ type: "error", text: "Server error." }); }
  };

  const releaseSlot = async () => {
    if (!activeBooking) return;
    try {
      const r = await fetch(`${API}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: activeBooking.booking_id }),
      });
      const d = await r.json();
      if (r.ok) {
        setBookMsg({ type: "success", text: `✓ Released! ${d.duration_minutes} min · ₹${d.fare}` });
        setActiveBooking(null); setShowQr(false); setQrBookingId(null);
        fetchSlots(); fetchStats(); fetchHistory();
      }
    } catch {}
  };

  const logout = () => { setLoggedIn(false); setUsername(""); setIsAdmin(false); };

  const zoneA = slots.filter(s => s.zone === "A");
  const zoneB = slots.filter(s => s.zone === "B");
  const recentHistory = history.slice(0, 4);

  if (isAdmin) return <AdminPanel onLogout={logout} />;
  if (showAdminLogin) return <AdminLogin onLogin={() => { setShowAdminLogin(false); setIsAdmin(true); }} />;
  if (window.location.pathname === "/reset-password" || window.location.search.includes("token=")) return <ResetPassword />;
  if (!loggedIn) return <Login setLoggedIn={setLoggedIn} setUsername={setUsername} setIsAdmin={() => setShowAdminLogin(true)} />;

  return (
    <div className="app">

      {/* QR MODAL */}
      {showQr && qrBookingId && (
        <div className="qr-overlay" onClick={() => setShowQr(false)}>
          <div className="qr-modal" onClick={e => e.stopPropagation()}>
            <div className="qr-modal-header">
              <div>
                <div className="qr-modal-title">✅ Booking Confirmed!</div>
                <div className="qr-modal-sub">Show this QR at the parking entry gate</div>
              </div>
              <button className="qr-close" onClick={() => setShowQr(false)}>✕</button>
            </div>
            <div className="qr-img-wrap">
              <img src={`${API}/qr/${qrBookingId}`} alt="Booking QR" className="qr-img" />
            </div>
            <div className="qr-note">📧 This QR code has also been sent to your email</div>
            <button className="qr-download" onClick={() => {
              const a = document.createElement("a");
              a.href = `${API}/qr/${qrBookingId}`;
              a.download = `parksmart_booking_${qrBookingId}.png`;
              a.click();
            }}>⬇ Download QR Code</button>
          </div>
        </div>
      )}

      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🚗</div>
          <div className="sidebar-logo-text">Park<span>Smart</span></div>
        </div>

        {/* User */}
        <div className="sidebar-user">
          <div className="sidebar-avatar">{username[0]?.toUpperCase()}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-username">{username}</div>
            <div className="sidebar-role">Member</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <button
            className={`sidebar-nav-item ${tab === "parking" ? "active" : ""}`}
            onClick={() => setTab("parking")}
          >
            <span className="sidebar-nav-icon">🅿️</span>
            <span>Dashboard</span>
          </button>
          <button
            className={`sidebar-nav-item ${tab === "history" ? "active" : ""}`}
            onClick={() => setTab("history")}
          >
            <span className="sidebar-nav-icon">🕐</span>
            <span>Booking History</span>
          </button>
        </nav>

        {/* Availability */}
        <div className="sidebar-avail">
          <div className="sidebar-avail-label">Current Area</div>
          <div className="sidebar-avail-row">
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div className="sidebar-avail-dot" style={{ background: "#00c853" }} />
              <span className="sidebar-avail-text">Available</span>
            </div>
            <span className="sidebar-avail-num">{stats.free_slots}</span>
          </div>
          <div className="sidebar-avail-row">
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div className="sidebar-avail-dot" style={{ background: "#ff3d5a" }} />
              <span className="sidebar-avail-text">Occupied</span>
            </div>
            <span className="sidebar-avail-num">{stats.occupied_slots}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <button className="sidebar-logout" onClick={logout}>
            <span>↩</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="main-content">

        {/* Top bar */}
        <div className="topbar">
          <div className="topbar-title">
            {tab === "parking" ? "Parking Dashboard" : "Booking History"}
          </div>
          <div className="topbar-right">
            <div className="topbar-stat free">
              <span className="topbar-stat-dot" />
              {stats.free_slots} Available
            </div>
            <div className="topbar-stat occupied">
              <span className="topbar-stat-dot" />
              {stats.occupied_slots} Occupied
            </div>
          </div>
        </div>

        {/* ── PARKING TAB ── */}
        {tab === "parking" && (
          <div className="page-body">

            {/* Center — slot grid */}
            <div className="center-panel">
              {/* Stats row */}
              <div className="stats-row">
                <div className="stat-card">
                  <div className="stat-card-top">
                    <div>
                      <div className="stat-label">Total Slots</div>
                      <div className="stat-value">{stats.total_slots}</div>
                    </div>
                    <div className="stat-icon" style={{ background: "#ebf0ff" }}>🅿️</div>
                  </div>
                  <div className="stat-sub">Across 2 zones</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-top">
                    <div>
                      <div className="stat-label">Available</div>
                      <div className="stat-value" style={{ color: "var(--green)" }}>{stats.free_slots}</div>
                    </div>
                    <div className="stat-icon" style={{ background: "var(--green-light)" }}>✅</div>
                  </div>
                  <div className="stat-sub">Free right now</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-top">
                    <div>
                      <div className="stat-label">Occupied</div>
                      <div className="stat-value" style={{ color: "var(--red)" }}>{stats.occupied_slots}</div>
                    </div>
                    <div className="stat-icon" style={{ background: "var(--red-light)" }}>🚗</div>
                  </div>
                  <div className="stat-sub">
                    {stats.total_slots ? Math.round((stats.occupied_slots / stats.total_slots) * 100) : 0}% capacity
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-top">
                    <div>
                      <div className="stat-label">Total Bookings</div>
                      <div className="stat-value">{stats.total_bookings}</div>
                    </div>
                    <div className="stat-icon" style={{ background: "#fef9e7" }}>📋</div>
                  </div>
                  <div className="stat-sub">{stats.active_bookings} active now</div>
                </div>
              </div>

              {/* Parking lot */}
              <div className="card">
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
                  <div>
                    <div className="card-title">Parking Lot</div>
                    <div className="card-sub">Click a free slot to select it</div>
                  </div>
                  <div className="legend">
                    <span><span className="legend-dot" style={{ background: "#d0f5e0", border: "1px solid #00c853" }}></span>Free</span>
                    <span><span className="legend-dot" style={{ background: "#ffe4e8", border: "1px solid #ff3d5a" }}></span>Occupied</span>
                    <span><span className="legend-dot" style={{ background: "#ebf0ff", border: "1px solid #4d7cfe" }}></span>AI Pick</span>
                  </div>
                </div>

                {[{ label: "Zone A", data: zoneA }, { label: "Zone B", data: zoneB }].map(({ label, data }) => (
                  <div className="zone-block" key={label}>
                    <div className="zone-label">{label}</div>
                    <div className="slots-grid">
                      {data.map(s => (
                        <div
                          key={s.slot_number}
                          onClick={() => handleSlotClick(s.slot_number, s.is_occupied)}
                          className={`slot ${s.is_occupied ? "occupied" : "free"} ${(recommended === s.slot_number || selectedSlot === s.slot_number) && !s.is_occupied ? "recommended" : ""}`}
                        >
                          {s.is_occupied ? "🚗" : "P"}
                          <span className="slot-num">S{s.slot_number}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <button className="ai-btn" onClick={findBestSlot} disabled={aiLoading}>
                  {aiLoading ? "🤖 Analysing..." : "🤖 Find Best Slot with AI"}
                </button>

                {recommended !== null && (
                  <div className="ai-result">
                    <div className="ai-result-slot">✨ AI Recommends: Slot S{recommended}</div>
                    <div className="ai-result-text">{explanation}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Right panel */}
            <div className="right-panel">

              {/* Active session card */}
              {activeBooking ? (
                <div className="active-session-card">
                  <div className="active-session-header">
                    <div className="active-session-label">Active Session</div>
                    <div className="live-badge"><span className="live-dot" /> LIVE</div>
                  </div>
                  <div className="active-session-slot">Spot S{activeBooking.slot_number}</div>
                  <div className="active-session-time">
                    <LiveTimer bookedAt={activeBooking.booked_at} />
                  </div>
                  <div className="active-session-cost-row">
                    <div className="active-session-cost-label">Current Cost</div>
                    <div className="active-session-cost">₹{liveFare}</div>
                  </div>
                  <button className="qr-btn" onClick={() => { setQrBookingId(activeBooking.booking_id); setShowQr(true); }}>
                    🔲 Show Entry QR Code
                  </button>
                  <button className="release-btn" onClick={releaseSlot}>End Session →</button>
                </div>
              ) : (
                /* Book slot form */
                <div className="book-card">
                  <div className="card-title">Book a Slot</div>
                  <div className="card-sub" style={{ marginBottom: 14 }}>
                    {selectedSlot !== null ? `Slot S${selectedSlot} selected` : "Select a slot from the grid"}
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label className="input-label">Selected Slot</label>
                    <input
                      className="text-input"
                      value={selectedSlot !== null ? `Slot S${selectedSlot}` : ""}
                      placeholder="Click a slot on the grid"
                      readOnly
                    />
                  </div>

                  <div style={{ marginBottom: 4 }}>
                    <label className="input-label">Vehicle Number</label>
                    <input
                      className="text-input"
                      value={vehicle}
                      placeholder="e.g. MH12AB1234"
                      onChange={e => setVehicle(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === "Enter" && bookSlot()}
                    />
                  </div>

                  <button
                    className="book-btn"
                    onClick={bookSlot}
                    disabled={selectedSlot === null || !vehicle.trim()}
                  >
                    Confirm Booking →
                  </button>

                  {bookMsg.text && <div className={`msg msg-${bookMsg.type}`}>{bookMsg.text}</div>}
                </div>
              )}

              {/* Release success message */}
              {!activeBooking && bookMsg.text && bookMsg.type === "success" && (
                <div className="msg msg-success">{bookMsg.text}</div>
              )}

              {/* Recent bookings */}
              {recentHistory.length > 0 && (
                <div className="card">
                  <div className="card-title">Recent Bookings</div>
                  <div style={{ cursor: "pointer", fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 12 }} onClick={() => setTab("history")}>
                    View All →
                  </div>
                  {recentHistory.map((b) => (
                    <div className="recent-booking-item" key={b.id}>
                      <div className="recent-booking-icon">🚗</div>
                      <div className="recent-booking-info">
                        <div className="recent-booking-slot">Slot S{b.slot_number} — {b.vehicle_number}</div>
                        <div className="recent-booking-meta">
                          {formatDate(b.booked_at)} · <span className={`status-badge status-${b.status}`}>{b.status}</span>
                        </div>
                      </div>
                      <div className="recent-booking-fare">
                        {b.status === "completed" && b.released_at && b.booked_at
                          ? "₹" + Math.max(10, (Math.ceil((new Date(b.released_at) - new Date(b.booked_at)) / (1000 * 60) / 30)) * 10)
                          : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && (
          <div className="history-page">
            <div className="card-title" style={{ marginBottom: 16, fontSize: 16 }}>All Bookings</div>
            {history.length === 0 ? (
              <div className="empty-state">No bookings yet. Book your first slot!</div>
            ) : (
              <div className="history-table-wrap">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Slot</th>
                      <th>Vehicle</th>
                      <th>Booked At</th>
                      <th>Released At</th>
                      <th>Fare</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((b, i) => (
                      <tr key={b.id}>
                        <td style={{ color: "var(--muted)" }}>{i + 1}</td>
                        <td><span className="slot-chip">S{b.slot_number}</span></td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{b.vehicle_number}</td>
                        <td>{formatDate(b.booked_at)}</td>
                        <td>{formatDate(b.released_at)}</td>
                        <td style={{ color: "var(--green)", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                          {b.status === "completed" && b.released_at && b.booked_at
                            ? "₹" + Math.max(10, (Math.ceil((new Date(b.released_at) - new Date(b.booked_at)) / (1000 * 60) / 30)) * 10)
                            : "—"}
                        </td>
                        <td>
                          <span className={`status-badge status-${b.status}`}>{b.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
