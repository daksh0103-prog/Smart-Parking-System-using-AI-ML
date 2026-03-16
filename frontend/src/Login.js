import React, { useState } from "react";
import "./Login.css";

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

function Login({ setLoggedIn, setUsername, setIsAdmin }) {
  const [tab, setTab] = useState("login");
  const [username, setUsernameInput] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState({ type: "", text: "" });
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!username || !password) { setError("ERR // MISSING CREDENTIALS"); return; }
    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        setUsername(username);
        setLoggedIn(true);
      } else {
        const data = await res.json();
        setError("ERR // " + (data.detail || "ACCESS DENIED"));
      }
    } catch {
      setError("ERR // SERVER UNREACHABLE");
    }
  };

  const handleRegister = async () => {
    setError("");
    if (!username || !email || !password) { setError("ERR // ALL FIELDS REQUIRED"); return; }
    if (!email.includes("@")) { setError("ERR // INVALID EMAIL FORMAT"); return; }
    if (password.length < 4) { setError("ERR // PASSWORD TOO SHORT"); return; }
    try {
      const res = await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      if (res.ok) {
        setError("");
        setTab("login");
        alert("IDENTITY CREATED // Proceed to login");
      } else {
        const data = await res.json();
        setError("ERR // " + (data.detail || "REGISTRATION FAILED"));
      }
    } catch {
      setError("ERR // SERVER UNREACHABLE");
    }
  };

  const handleForgot = async () => {
    setForgotMsg({ type: "", text: "" });
    if (!forgotEmail.trim()) { setForgotMsg({ type: "error", text: "ERR // EMAIL REQUIRED" }); return; }
    if (!forgotEmail.includes("@")) { setForgotMsg({ type: "error", text: "ERR // INVALID EMAIL FORMAT" }); return; }
    setForgotLoading(true);
    try {
      const res = await fetch(`${API}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setForgotMsg({ type: "success", text: "OK // RESET LINK TRANSMITTED" });
        setForgotEmail("");
      } else {
        setForgotMsg({ type: "error", text: "ERR // " + (data.detail || "TRANSMISSION FAILED") });
      }
    } catch {
      setForgotMsg({ type: "error", text: "ERR // SERVER UNREACHABLE" });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Animated background */}
      <div className="login-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <div className="login-wrapper">

        {/* ══ LEFT PANEL ══ */}
        <div className="login-left">
          <div className="login-brand">
            <div className="login-brand-icon-wrap">
              <span style={{fontSize:"40px", filter:"drop-shadow(0 0 16px rgba(0,255,245,0.7))"}}>🚗</span>
            </div>
            <h1>PARK<span className="accent">SMART</span></h1>
            <div className="login-brand-sub">AI PARKING SYS v2.0<span>_</span></div>
            <div className="login-status">
              <div className="login-status-dot" />
              SYSTEM ONLINE
            </div>
          </div>

          <div className="login-features">
            <div className="login-feature">
              <div className="login-feature-icon">🤖</div>
              <div className="login-feature-text">
                <strong>DQN AI ENGINE</strong>
                <span>Reinforcement learning slot optimizer</span>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">📱</div>
              <div className="login-feature-text">
                <strong>QR ACCESS PASS</strong>
                <span>Encrypted entry code per booking</span>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">💰</div>
              <div className="login-feature-text">
                <strong>AUTO FARE CALC</strong>
                <span>₹10 per 30 min · live duration</span>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">🛡️</div>
              <div className="login-feature-text">
                <strong>ADMIN CONTROL</strong>
                <span>Full dashboard · revenue tracking</span>
              </div>
            </div>
          </div>
        </div>

        {/* ══ RIGHT PANEL ══ */}
        <div className="login-right">
          <div className="login-panel-header">
            <div className="login-panel-title">Access Terminal</div>
            <div className="login-panel-id">SYS:PARKSMART // NODE:AUTH-01</div>
          </div>

          {tab === "forgot" ? (
            <>
              <div className="forgot-header">
                <button className="forgot-back" onClick={() => { setTab("login"); setForgotMsg({ type: "", text: "" }); setForgotEmail(""); }}>
                  ← BACK
                </button>
                <div className="forgot-title">RESET ACCESS</div>
                <div className="forgot-sub">Enter your registered email. A reset link will be transmitted to your inbox.</div>
              </div>

              <div className="input-group">
                <label className="input-label">Registered Email</label>
                <input
                  type="email"
                  className="login-input"
                  placeholder="user@domain.com"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleForgot()}
                />
              </div>

              <button className="login-button" onClick={handleForgot} disabled={forgotLoading}>
                <span>{forgotLoading ? "TRANSMITTING..." : "SEND RESET LINK →"}</span>
              </button>

              {forgotMsg.text && (
                <div className={forgotMsg.type === "success" ? "login-success" : "login-error"}>
                  {forgotMsg.text}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="login-tabs">
                <button className={`login-tab ${tab === "login" ? "active" : ""}`} onClick={() => { setTab("login"); setError(""); }}>
                  Login
                </button>
                <button className={`login-tab ${tab === "register" ? "active" : ""}`} onClick={() => { setTab("register"); setError(""); }}>
                  Register
                </button>
              </div>

              <div className="input-group">
                <label className="input-label">Username</label>
                <input
                  className="login-input"
                  placeholder="Enter identifier..."
                  value={username}
                  onChange={e => setUsernameInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (tab === "login" ? handleLogin() : handleRegister())}
                />
              </div>

              {tab === "register" && (
                <div className="input-group">
                  <label className="input-label">Email</label>
                  <input
                    type="email"
                    className="login-input"
                    placeholder="user@domain.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleRegister()}
                  />
                </div>
              )}

              <div className="input-group">
                <label className="input-label">Password</label>
                <input
                  type="password"
                  className="login-input"
                  placeholder="Enter passkey..."
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (tab === "login" ? handleLogin() : handleRegister())}
                />
              </div>

              {tab === "login" && (
                <div className="forgot-link" onClick={() => { setTab("forgot"); setError(""); }}>
                  FORGOT ACCESS KEY?
                </div>
              )}

              <button className="login-button" onClick={tab === "login" ? handleLogin : handleRegister}>
                <span>{tab === "login" ? "INITIATE LOGIN →" : "CREATE IDENTITY →"}</span>
              </button>

              {error && <div className="login-error">{error}</div>}
            </>
          )}

          <div className="admin-link" onClick={() => setIsAdmin(true)}>
            🔐 ADMIN ACCESS
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
