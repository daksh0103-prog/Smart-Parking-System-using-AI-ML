import React, { useState } from "react";
import "./AdminLogin.css";

const ADMIN_USERNAME = "daksh";
const ADMIN_PASSWORD = "01032006";

export default function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setError("");
    if (!username || !password) { setError("ERR // ALL FIELDS REQUIRED"); return; }
    setLoading(true);
    setTimeout(() => {
      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        onLogin();
      } else {
        setError("ERR // INVALID ADMIN CREDENTIALS");
        setLoading(false);
      }
    }, 800);
  };

  return (
    <div className="al-container">
      <div className="al-bg">
        <div className="al-orb al-orb1" />
        <div className="al-orb al-orb2" />
      </div>

      <div className="al-wrapper">
        {/* Corner brackets */}
        <div className="al-corner al-tl" />
        <div className="al-corner al-tr" />
        <div className="al-corner al-bl" />
        <div className="al-corner al-br" />

        {/* Top scan line */}
        <div className="al-scanline" />

        {/* Icon */}
        <div className="al-icon-wrap">
          <div className="al-icon-ring1" />
          <div className="al-icon-ring2" />
          <span className="al-icon">🛡️</span>
        </div>

        {/* Brand */}
        <div className="al-brand">
          <h1>PARK<span>SMART</span></h1>
          <div className="al-badge">
            <span className="al-badge-dot" />
            ADMIN ACCESS TERMINAL
          </div>
          <p className="al-sub">Restricted — Authorized Personnel Only</p>
        </div>

        {/* Divider */}
        <div className="al-divider" />

        {/* Inputs */}
        <div className="al-input-group">
          <label className="al-label">// Admin Username</label>
          <input
            className="al-input"
            placeholder="Enter admin identifier..."
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
          />
        </div>

        <div className="al-input-group">
          <label className="al-label">// Admin Password</label>
          <input
            type="password"
            className="al-input"
            placeholder="Enter passkey..."
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
          />
        </div>

        {/* Button */}
        <button className="al-btn" onClick={handleLogin} disabled={loading}>
          <span>{loading ? "AUTHENTICATING..." : "ACCESS ADMIN PANEL →"}</span>
        </button>

        {error && <div className="al-error">{error}</div>}

        {/* Bottom bar */}
        <div className="al-bottom">
          <span className="al-bottom-dot" />
          <span className="al-bottom-text">SYS:PARKSMART // ADMIN-NODE-01</span>
        </div>
      </div>
    </div>
  );
}
