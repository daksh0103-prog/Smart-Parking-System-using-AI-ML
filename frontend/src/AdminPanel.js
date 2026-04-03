import React, { useState, useEffect, useCallback } from "react";
import "./AdminPanel.css";

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-IN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Kolkata"
  });
}

export default function AdminPanel({ onLogout }) {
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState({});
  const [allBookings, setAllBookings] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [slots, setSlots] = useState([]);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [zoneSummary, setZoneSummary] = useState([]);
  const [addZone, setAddZone] = useState("");
  const [addCount, setAddCount] = useState(5);
  const [removeZone, setRemoveZone] = useState("");
  const [slotLoading, setSlotLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, bookingsRes, usersRes, slotsRes, zoneRes] = await Promise.all([
        fetch(`${API}/stats`),
        fetch(`${API}/admin/bookings`),
        fetch(`${API}/admin/users`),
        fetch(`${API}/slots`),
        fetch(`${API}/admin/slot-summary`),
      ]);
      setStats(await statsRes.json());
      setAllBookings(await bookingsRes.json());
      setAllUsers(await usersRes.json());
      setSlots(await slotsRes.json());
      const zd = await zoneRes.json(); setZoneSummary(zd.zones || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 6000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const showMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: "", text: "" }), 3000);
  };

  const forceRelease = async (bookingId, slotNumber) => {
    try {
      const res = await fetch(`${API}/admin/force-release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId }),
      });
      if (res.ok) {
        showMsg("success", `✓ Slot S${slotNumber} force-released successfully`);
        fetchAll();
      } else {
        const data = await res.json();
        showMsg("error", data.detail || "Release failed");
      }
    } catch { showMsg("error", "Server error"); }
  };

  const toggleBlock = async (userId, isBlocked) => {
    try {
      const res = await fetch(`${API}/admin/toggle-block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      if (res.ok) {
        showMsg("success", `✓ User ${isBlocked ? "unblocked" : "blocked"} successfully`);
        fetchAll();
      } else {
        const data = await res.json();
        showMsg("error", data.detail || "Action failed");
      }
    } catch { showMsg("error", "Server error"); }
  };

  const activeBookings = allBookings.filter(b => b.status === "active");
  const completedBookings = allBookings.filter(b => b.status === "completed");

  return (
    <div className="admin-app">
      {/* NAV */}
      <nav className="admin-nav">
        <div className="admin-nav-left">
          <div className="admin-logo">🚗 Park<span>Smart</span></div>
          <div className="admin-badge">ADMIN</div>
        </div>
        <div className="admin-nav-tabs">
          {["overview", "bookings", "users", "slots"].map(t => (
            <button
              key={t}
              className={`admin-tab ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <button className="admin-logout" onClick={onLogout}>Logout</button>
      </nav>

      <div className="admin-main">

        {/* GLOBAL MESSAGE */}
        {msg.text && (
          <div className={`admin-msg admin-msg-${msg.type}`}>{msg.text}</div>
        )}

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <>
            <div className="admin-page-title">Dashboard Overview</div>
            <div className="admin-stats-row">
              <div className="admin-stat" style={{ "--c": "#00d4ff" }}>
                <div className="admin-stat-icon">🅿️</div>
                <div className="admin-stat-label">Total Slots</div>
                <div className="admin-stat-value">{stats.total_slots ?? 0}</div>
              </div>
              <div className="admin-stat" style={{ "--c": "#00e676" }}>
                <div className="admin-stat-icon">✅</div>
                <div className="admin-stat-label">Free Slots</div>
                <div className="admin-stat-value" style={{ color: "var(--green)" }}>{stats.free_slots ?? 0}</div>
              </div>
              <div className="admin-stat" style={{ "--c": "#ff3d5a" }}>
                <div className="admin-stat-icon">🚗</div>
                <div className="admin-stat-label">Occupied</div>
                <div className="admin-stat-value" style={{ color: "var(--red)" }}>{stats.occupied_slots ?? 0}</div>
              </div>
              <div className="admin-stat" style={{ "--c": "#ffd600" }}>
                <div className="admin-stat-icon">👥</div>
                <div className="admin-stat-label">Total Users</div>
                <div className="admin-stat-value">{allUsers.length}</div>
              </div>
              <div className="admin-stat" style={{ "--c": "#a855f7" }}>
                <div className="admin-stat-icon">📋</div>
                <div className="admin-stat-label">Total Bookings</div>
                <div className="admin-stat-value">{stats.total_bookings ?? 0}</div>
              </div>
              <div className="admin-stat" style={{ "--c": "#ff6b35" }}>
                <div className="admin-stat-icon">⚡</div>
                <div className="admin-stat-label">Active Now</div>
                <div className="admin-stat-value">{stats.active_bookings ?? 0}</div>
              </div>
              <div className="admin-stat" style={{ "--c": "#00e676" }}>
                <div className="admin-stat-icon">💰</div>
                <div className="admin-stat-label">Total Revenue</div>
                <div className="admin-stat-value" style={{ color: "var(--green)" }}>₹{stats.total_revenue ?? 0}</div>
              </div>
            </div>

            {/* Active bookings quick view */}
            <div className="admin-section">
              <div className="admin-section-title">
                Active Bookings
                <span className="admin-count">{activeBookings.length}</span>
              </div>
              {activeBookings.length === 0 ? (
                <div className="admin-empty">No active bookings right now</div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Booking ID</th>
                      <th>User</th>
                      <th>Slot</th>
                      <th>Vehicle</th>
                      <th>Booked At</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeBookings.map(b => (
                      <tr key={b.id}>
                        <td style={{ color: "var(--muted)" }}>#{b.id}</td>
                        <td>{b.username}</td>
                        <td><span className="slot-chip">S{b.slot_number}</span></td>
                        <td>{b.vehicle_number}</td>
                        <td>{formatDate(b.booked_at)}</td>
                        <td>
                          <button
                            className="force-btn"
                            onClick={() => forceRelease(b.id, b.slot_number)}
                          >
                            Force Release
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ── BOOKINGS ── */}
        {tab === "bookings" && (
          <div className="admin-section">
            <div className="admin-section-title">
              All Bookings
              <span className="admin-count">{allBookings.length}</span>
            </div>
            {allBookings.length === 0 ? (
              <div className="admin-empty">No bookings found</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>User</th>
                    <th>Slot</th>
                    <th>Vehicle</th>
                    <th>Booked At</th>
                    <th>Released At</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allBookings.map((b, i) => (
                    <tr key={b.id}>
                      <td style={{ color: "var(--muted)" }}>{i + 1}</td>
                      <td>{b.username}</td>
                      <td><span className="slot-chip">S{b.slot_number}</span></td>
                      <td>{b.vehicle_number}</td>
                      <td>{formatDate(b.booked_at)}</td>
                      <td>{formatDate(b.released_at)}</td>
                      <td>
                        <span className={`status-badge status-${b.status}`}>{b.status}</span>
                      </td>
                      <td>
                        {b.status === "active" ? (
                          <button
                            className="force-btn"
                            onClick={() => forceRelease(b.id, b.slot_number)}
                          >
                            Force Release
                          </button>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── USERS ── */}
        {tab === "users" && (
          <div className="admin-section">
            <div className="admin-section-title">
              All Users
              <span className="admin-count">{allUsers.length}</span>
            </div>
            {allUsers.length === 0 ? (
              <div className="admin-empty">No users found</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Total Bookings</th>
                    <th>Active Booking</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map((u, i) => (
                    <tr key={u.id}>
                      <td style={{ color: "var(--muted)" }}>{i + 1}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div className="user-avatar">{u.username[0]?.toUpperCase()}</div>
                          {u.username}
                        </div>
                      </td>
                      <td style={{ color: "var(--muted)" }}>{u.email}</td>
                      <td>{u.total_bookings}</td>
                      <td>
                        {u.active_slot !== null
                          ? <span className="slot-chip">S{u.active_slot}</span>
                          : <span style={{ color: "var(--muted)", fontSize: 12 }}>None</span>
                        }
                      </td>
                      <td>
                        <span className={`status-badge ${u.is_blocked ? "status-cancelled" : "status-active"}`}>
                          {u.is_blocked ? "blocked" : "active"}
                        </span>
                      </td>
                      <td>
                        <button
                          className={u.is_blocked ? "unblock-btn" : "block-btn"}
                          onClick={() => toggleBlock(u.id, u.is_blocked)}
                        >
                          {u.is_blocked ? "Unblock" : "Block"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── SLOTS ── */}
        {tab === "slots" && (
          <div className="admin-section">

            {/* ── Zone Summary ── */}
            <div className="admin-section-title">Zone Summary</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
              {zoneSummary.map(z => (
                <div key={z.zone} style={{
                  background: "var(--card)", border: "1px solid var(--border)",
                  borderRadius: 12, padding: "14px 20px", minWidth: 130, textAlign: "center"
                }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--cyan)" }}>Zone {z.zone}</div>
                  <div style={{ fontSize: 13, marginTop: 6 }}>
                    <span style={{ color: "#00e676" }}>● {z.free} free</span>
                    {"  "}
                    <span style={{ color: "#ff3d5a" }}>● {z.occupied} occ</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{z.total} total</div>
                </div>
              ))}
            </div>

            {/* ── Add Slots ── */}
            <div className="admin-section-title">➕ Add Slots</div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 28 }}>
              <div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Zone label (e.g. E)</div>
                <input
                  value={addZone}
                  onChange={e => setAddZone(e.target.value.toUpperCase())}
                  placeholder="Zone"
                  maxLength={4}
                  style={{
                    background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8,
                    color: "#fff", padding: "8px 12px", width: 90, fontSize: 14, outline: "none"
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Number of slots</div>
                <input
                  type="number"
                  value={addCount}
                  onChange={e => setAddCount(Math.max(1, Math.min(100, Number(e.target.value))))}
                  min={1} max={100}
                  style={{
                    background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8,
                    color: "#fff", padding: "8px 12px", width: 100, fontSize: 14, outline: "none"
                  }}
                />
              </div>
              <button
                disabled={slotLoading || !addZone.trim()}
                onClick={async () => {
                  if (!addZone.trim()) return;
                  setSlotLoading(true);
                  try {
                    const r = await fetch(`${API}/admin/add-slots`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ count: addCount, zone: addZone.trim() }),
                    });
                    const d = await r.json();
                    if (!r.ok) { showMsg("error", d.detail || "Failed"); }
                    else { showMsg("success", `✓ ${d.message} — Total: ${d.total_slots} slots`); setAddZone(""); setAddCount(5); fetchAll(); }
                  } catch { showMsg("error", "Network error"); }
                  setSlotLoading(false);
                }}
                style={{
                  background: "var(--cyan)", color: "#000", border: "none", borderRadius: 8,
                  padding: "9px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer",
                  opacity: slotLoading || !addZone.trim() ? 0.5 : 1
                }}
              >
                {slotLoading ? "Adding…" : "Add Slots"}
              </button>
            </div>

            {/* ── Remove Zone ── */}
            <div className="admin-section-title">🗑️ Remove Zone</div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 28 }}>
              <div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Zone to remove (must be empty)</div>
                <input
                  value={removeZone}
                  onChange={e => setRemoveZone(e.target.value.toUpperCase())}
                  placeholder="Zone label"
                  maxLength={4}
                  style={{
                    background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8,
                    color: "#fff", padding: "8px 12px", width: 120, fontSize: 14, outline: "none"
                  }}
                />
              </div>
              <button
                disabled={slotLoading || !removeZone.trim()}
                onClick={async () => {
                  if (!removeZone.trim()) return;
                  if (!window.confirm(`Remove ALL slots in Zone ${removeZone}? This cannot be undone.`)) return;
                  setSlotLoading(true);
                  try {
                    const r = await fetch(`${API}/admin/remove-zone`, {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ zone: removeZone.trim() }),
                    });
                    const d = await r.json();
                    if (!r.ok) { showMsg("error", d.detail || "Failed"); }
                    else { showMsg("success", `✓ ${d.message} — Total: ${d.total_slots} slots`); setRemoveZone(""); fetchAll(); }
                  } catch { showMsg("error", "Network error"); }
                  setSlotLoading(false);
                }}
                style={{
                  background: "#ff3d5a22", color: "#ff3d5a", border: "1px solid #ff3d5a44",
                  borderRadius: 8, padding: "9px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer",
                  opacity: slotLoading || !removeZone.trim() ? 0.5 : 1
                }}
              >
                {slotLoading ? "Removing…" : "Remove Zone"}
              </button>
            </div>

            {/* ── Live Slot Grid ── */}
            <div className="admin-section-title">Live Slot Grid</div>
            <div className="admin-slots-grid">
              {slots.map(s => (
                <div key={s.slot_number} className={`admin-slot ${s.is_occupied ? "occupied" : "free"}`}>
                  <div className="admin-slot-icon">{s.is_occupied ? "🚗" : "P"}</div>
                  <div className="admin-slot-num">S{s.slot_number}</div>
                  <div className="admin-slot-zone">Zone {s.zone}</div>
                  <div className={`admin-slot-status ${s.is_occupied ? "occ" : "free"}`}>
                    {s.is_occupied ? "Occupied" : "Free"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}