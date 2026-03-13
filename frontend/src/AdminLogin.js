import React, { useState } from "react";
import "./AdminLogin.css";

// Hardcoded admin credentials
const ADMIN_USERNAME = "daksh";
const ADMIN_PASSWORD = "01032006";

export default function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    setError("");
    if (!username || !password) { setError("Please fill all fields"); return; }
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      onLogin();
    } else {
      setError("Invalid admin credentials");
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <div className="admin-login-card::before"></div>
        <div className="admin-login-logo">
          <h1>🚗 Park<span>Smart</span></h1>
          <div className="admin-login-badge">ADMIN PANEL</div>
          <p>Restricted access — authorized personnel only</p>
        </div>

        <div className="admin-input-group">
          <label className="admin-input-label">Admin Username</label>
          <input
            className="admin-input"
            placeholder="Enter admin username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
          />
        </div>

        <div className="admin-input-group">
          <label className="admin-input-label">Admin Password</label>
          <input
            type="password"
            className="admin-input"
            placeholder="Enter admin password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
          />
        </div>

        <button className="admin-login-btn" onClick={handleLogin}>
          Access Admin Panel →
        </button>

        {error && <div className="admin-login-error">{error}</div>}

        <div className="admin-login-hint">
          Default credentials: <strong>admin</strong> / <strong>parksmart@admin123</strong>
        </div>
      </div>
    </div>
  );
}