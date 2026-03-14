import React, { useState, useEffect, useCallback } from "react";
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
  return new Date(dateStr).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" });
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [tab, setTab] = useState("parking");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  // Parking state
  const [slots, setSlots] = useState([]);
  const [recommended, setRecommended] = useState(null);
  const [explanation, setExplanation] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Booking state
  const [vehicle, setVehicle] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [activeBooking, setActiveBooking] = useState(null);
  const [bookMsg, setBookMsg] = useState({ type: "", text: "" });
  const [qrBookingId, setQrBookingId] = useState(null);
  const [showQr, setShowQr] = useState(false);

  // History state
  const [history, setHistory] = useState([]);

  // Stats
  const [stats, setStats] = useState({ total_slots: 0, occupied_slots: 0, free_slots: 0, total_bookings: 0, active_bookings: 0 });

  // ── Fetch helpers ────────────────────────
  const fetchSlots = useCallback(async () => {
    try {
      const res = await fetch(`${API}/slots`);
      const data = await res.json();
      setSlots(data);
    } catch {}
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/stats`);
      const data = await res.json();
      setStats(data);
    } catch {}
  }, []);

  const fetchActiveBooking = useCallback(async () => {
    if (!username) return;
    try {
      const res = await fetch(`${API}/active-booking/${username}`);
      const data = await res.json();
      setActiveBooking(data.active ? data : null);
    } catch {}
  }, [username]);

  const fetchHistory = useCallback(async () => {
    if (!username) return;
    try {
      const res = await fetch(`${API}/history/${username}`);
      const data = await res.json();
      setHistory(data);
    } catch {}
  }, [username]);

  // ── On login, load everything ────────────
  useEffect(() => {
    if (loggedIn) {
      fetchSlots();
      fetchStats();
      fetchActiveBooking();
      fetchHistory();
      const interval = setInterval(() => {
        fetchSlots();
        fetchStats();
        fetchActiveBooking();
      }, 5000); // poll every 5s
      return () => clearInterval(interval);
    }
  }, [loggedIn, fetchSlots, fetchStats, fetchActiveBooking]);

  useEffect(() => {
    if (tab === "history") fetchHistory();
  }, [tab, fetchHistory]);

  // ── Slot click ───────────────────────────
  const handleSlotClick = (slotNum, isOccupied) => {
    if (isOccupied) return;
    setSelectedSlot(slotNum);
    setRecommended(null);
    setBookMsg({ type: "", text: "" });
  };

  // ── AI Recommendation ────────────────────
  const findBestSlot = async () => {
    setAiLoading(true);
    setRecommended(null);
    try {
      const slotArray = slots.map(s => s.is_occupied ? 1 : 0);
      const res = await fetch(`${API}/allocate-slot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: slotArray }),
      });
      const data = await res.json();
      setRecommended(data.recommended_slot);
      setSelectedSlot(data.recommended_slot);
      setExplanation(data.explanation);
    } catch {
      setExplanation("Could not connect to AI backend.");
    } finally {
      setAiLoading(false);
    }
  };

  // ── Book slot ────────────────────────────
  const bookSlot = async () => {
    if (selectedSlot === null) { setBookMsg({ type: "error", text: "Please select a slot first." }); return; }
    if (!vehicle.trim()) { setBookMsg({ type: "error", text: "Enter your vehicle number." }); return; }
    setBookMsg({ type: "", text: "" });
    try {
      const res = await fetch(`${API}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_number: selectedSlot, vehicle_number: vehicle, username }),
      });
      const data = await res.json();
      if (res.ok) {
        setBookMsg({ type: "success", text: `✓ Slot ${selectedSlot} booked for ${data.vehicle_number}` });
        setQrBookingId(data.booking_id);
        setShowQr(true);
        setVehicle("");
        setSelectedSlot(null);
        setRecommended(null);
        fetchSlots();
        fetchStats();
        fetchActiveBooking();
      } else {
        setBookMsg({ type: "error", text: data.detail || "Booking failed." });
      }
    } catch {
      setBookMsg({ type: "error", text: "Server error." });
    }
  };

  // ── Release slot ─────────────────────────
  const releaseSlot = async () => {
    if (!activeBooking) return;
    try {
      const res = await fetch(`${API}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: activeBooking.booking_id }),
      });
      const data = await res.json();
      if (res.ok) {
        setBookMsg({ type: "success", text: `✓ Released! Parked for ${data.duration_minutes} min. Total Fare: ₹${data.fare}` });
        setActiveBooking(null);
        setShowQr(false);
        setQrBookingId(null);
        fetchSlots();
        fetchStats();
        fetchHistory();
      }
    } catch {}
  };

  const logout = () => { setLoggedIn(false); setUsername(""); setIsAdmin(false); };

  // ── Slot arrays by zone ───────────────────
  const zoneA = slots.filter(s => s.zone === "A");
  const zoneB = slots.filter(s => s.zone === "B");

  // ── Admin routing ─────────────────────────
  if (isAdmin) return <AdminPanel onLogout={logout} />;
  if (showAdminLogin) return <AdminLogin onLogin={() => { setShowAdminLogin(false); setIsAdmin(true); }} />;

  // ── Reset password route ──────────────────
  if (window.location.pathname === "/reset-password" || window.location.search.includes("token=")) {
    return <ResetPassword />;
  }

  if (!loggedIn) return <Login setLoggedIn={setLoggedIn} setUsername={setUsername} setIsAdmin={() => setShowAdminLogin(true)} />;

  return (
    <div className="app">

      {/* QR MODAL — shown right after booking */}
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
              <img
                src={`${API}/qr/${qrBookingId}`}
                alt="Booking QR Code"
                className="qr-img"
              />
            </div>
            <div className="qr-note">
              📧 This QR code has also been sent to your email
            </div>
            <button className="qr-download" onClick={() => {
              const a = document.createElement("a");
              a.href = `${API}/qr/${qrBookingId}`;
              a.download = `parksmart_booking_${qrBookingId}.png`;
              a.click();
            }}>
              ⬇ Download QR Code
            </button>
          </div>
        </div>
      )}
      {/* NAV */}
      <nav className="nav">
        <div className="nav-logo">🚗 Park<span>Smart</span></div>
        <div className="nav-tabs">
          {["parking", "history"].map(t => (
            <button key={t} className={`nav-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="nav-right">
          <span>{username}</span>
          <div className="nav-user-badge">{username[0]?.toUpperCase()}</div>
          <button className="logout-btn" onClick={logout}>Logout</button>
        </div>
      </nav>

      <div className="main">
        {/* STATS */}
        <div className="stats-row">
          <div className="stat-card" style={{ "--c": "#00d4ff" }}>
            <div className="stat-icon">🅿️</div>
            <div className="stat-label">Total Slots</div>
            <div className="stat-value">{stats.total_slots}</div>
            <div className="stat-sub">Across 2 zones</div>
          </div>
          <div className="stat-card" style={{ "--c": "#00e676" }}>
            <div className="stat-icon">✅</div>
            <div className="stat-label">Available</div>
            <div className="stat-value" style={{ color: "var(--green)" }}>{stats.free_slots}</div>
            <div className="stat-sub">Free right now</div>
          </div>
          <div className="stat-card" style={{ "--c": "#ff3d5a" }}>
            <div className="stat-icon">🚗</div>
            <div className="stat-label">Occupied</div>
            <div className="stat-value" style={{ color: "var(--red)" }}>{stats.occupied_slots}</div>
            <div className="stat-sub">
              {stats.total_slots ? Math.round((stats.occupied_slots / stats.total_slots) * 100) : 0}% capacity
            </div>
          </div>
          <div className="stat-card" style={{ "--c": "#ffd600" }}>
            <div className="stat-icon">📋</div>
            <div className="stat-label">Total Bookings</div>
            <div className="stat-value">{stats.total_bookings}</div>
            <div className="stat-sub">{stats.active_bookings} active now</div>
          </div>
        </div>

        {/* PARKING TAB */}
        {tab === "parking" && (
          <div className="two-col">
            {/* LEFT — slot grid */}
            <div className="section">
              <div className="section-header">
                <div>
                  <div className="section-title">Parking Lot</div>
                  <div className="section-sub">Click a free slot to select it</div>
                </div>
                <div className="legend">
                  <span><span className="legend-dot" style={{ background: "rgba(0,230,118,0.4)" }}></span>Free</span>
                  <span><span className="legend-dot" style={{ background: "rgba(255,61,90,0.4)" }}></span>Occupied</span>
                  <span><span className="legend-dot" style={{ background: "var(--accent)" }}></span>AI Pick</span>
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
                        className={`slot ${s.is_occupied ? "occupied" : "free"} ${recommended === s.slot_number ? "recommended" : ""} ${selectedSlot === s.slot_number && !s.is_occupied ? "recommended" : ""}`}
                      >
                        {s.is_occupied ? "🚗" : "P"}
                        <span className="slot-num">S{s.slot_number}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <button className="ai-btn" onClick={findBestSlot} disabled={aiLoading}>
                {aiLoading ? "Analysing..." : "🤖 Find Best Slot with AI"}
              </button>

              {recommended !== null && (
                <div className="ai-result">
                  <div className="ai-result-slot">AI Recommends: Slot S{recommended}</div>
                  <div className="ai-result-text">{explanation}</div>
                </div>
              )}
            </div>

            {/* RIGHT — booking panel */}
            <div className="booking-panel">
              {/* Active booking */}
              {activeBooking && (
                <div className="section">
                  <div className="section-title" style={{ marginBottom: 14 }}>Your Active Booking</div>
                  <div className="active-booking">
                    <div className="active-booking-header">
                      <div className="active-booking-title">PARKED</div>
                      <div className="active-dot"></div>
                    </div>
                    <div className="active-booking-row"><span>Slot</span><span>S{activeBooking.slot_number}</span></div>
                    <div className="active-booking-row"><span>Vehicle</span><span>{activeBooking.vehicle_number}</span></div>
                    <div className="active-booking-row"><span>Since</span><span>{timeAgo(activeBooking.booked_at)}</span></div>
                    <button
                      className="book-btn"
                      style={{ marginTop: 10, fontSize: 13 }}
                      onClick={() => { setQrBookingId(activeBooking.booking_id); setShowQr(true); }}
                    >
                      Show Entry QR Code
                    </button>
                    <button className="release-btn" onClick={releaseSlot}>Release Slot →</button>
                  </div>
                </div>
              )}

              {/* New booking form */}
              {!activeBooking && (
                <div className="section">
                  <div className="section-header">
                    <div>
                      <div className="section-title">Book a Slot</div>
                      <div className="section-sub">
                        {selectedSlot !== null ? `Slot S${selectedSlot} selected` : "Select a slot from the grid"}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="input-label">Selected Slot</label>
                    <input
                      className="text-input"
                      value={selectedSlot !== null ? `Slot S${selectedSlot}` : ""}
                      placeholder="Click a slot on the grid"
                      readOnly
                    />
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <label className="input-label">Vehicle Number</label>
                    <input
                      className="text-input"
                      placeholder="e.g. DL01AB1234"
                      value={vehicle}
                      onChange={e => setVehicle(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === "Enter" && bookSlot()}
                    />
                  </div>

                  <button
                    className="book-btn"
                    style={{ marginTop: 16 }}
                    onClick={bookSlot}
                    disabled={selectedSlot === null || !vehicle.trim()}
                  >
                    Confirm Booking →
                  </button>

                  {bookMsg.text && (
                    <div className={`msg msg-${bookMsg.type}`}>{bookMsg.text}</div>
                  )}
                </div>
              )}

              {/* Release success message when user has active booking */}
              {activeBooking && bookMsg.text && (
                <div className={`msg msg-${bookMsg.type}`}>{bookMsg.text}</div>
              )}
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === "history" && (
          <div className="section">
            <div className="section-header">
              <div>
                <div className="section-title">Booking History</div>
                <div className="section-sub">All your past and active bookings</div>
              </div>
            </div>

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
                      <td>S{b.slot_number}</td>
                      <td>{b.vehicle_number}</td>
                      <td>{formatDate(b.booked_at)}</td>
                      <td>{formatDate(b.released_at)}</td>
                      <td style={{ color: "var(--green)", fontWeight: 600 }}>
                        {b.status === "completed" && b.released_at && b.booked_at
                          ? "₹" + Math.max(10, (Math.floor((new Date(b.released_at) - new Date(b.booked_at)) / 60000) / 30 + 1 | 0) * 10)
                          : "—"}
                      </td>
                      <td>
                        <span className={`status-badge status-${b.status}`}>
                          {b.status}
                        </span>
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
