import React, { useState } from "react";
import "./Login.css";

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

function Login({ setLoggedIn, setUsername, setIsAdmin }) {
  const [tab, setTab] = useState("login");
  const [username, setUsernameInput] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState({ type: "", text: "" });
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!username || !password) { setError("ERR // ALL FIELDS REQUIRED"); return; }
    setLoading(true);
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
        setError(data.detail || "ERR // INVALID CREDENTIALS");
      }
    } catch {
      setError("ERR // CANNOT CONNECT TO SERVER");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError("");
    if (!username || !email || !password) { setError("ERR // ALL FIELDS REQUIRED"); return; }
    if (!email.includes("@")) { setError("ERR // INVALID EMAIL FORMAT"); return; }
    if (password.length < 4) { setError("ERR // PASSWORD MIN 4 CHARACTERS"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      if (res.ok) {
        setError("");
        setTab("login");
        alert("Registered successfully! You can now log in.");
      } else {
        const data = await res.json();
        setError(data.detail || "ERR // REGISTRATION FAILED");
      }
    } catch {
      setError("ERR // CANNOT CONNECT TO SERVER");
    } finally {
      setLoading(false);
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
        setForgotMsg({ type: "success", text: "✓ RESET LINK SENT — CHECK YOUR EMAIL" });
        setForgotEmail("");
      } else {
        setForgotMsg({ type: "error", text: data.detail || "ERR // COULD NOT SEND RESET EMAIL" });
      }
    } catch {
      setForgotMsg({ type: "error", text: "ERR // CANNOT CONNECT TO SERVER" });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Background orbs */}
      <div className="login-bg">
        <div className="login-orb login-orb1" />
        <div className="login-orb login-orb2" />
      </div>

      <div className="login-wrapper">
        {/* Corner brackets */}
        <div className="lg-corner lg-tl" />
        <div className="lg-corner lg-tr" />
        <div className="lg-corner lg-bl" />
        <div className="lg-corner lg-br" />

        {/* Scan line */}
        <div className="login-scanline" />

        {/* Icon */}
        <div className="lg-icon-wrap">
          <div className="lg-icon-ring1" />
          <div className="lg-icon-ring2" />
          <div className="lg-icon-bg" />
          <span className="lg-icon">🚗</span>
        </div>

        {/* Brand */}
        <div className="lg-brand">
          <h1>PARK<span>SMART</span></h1>
          <div className="lg-badge">
            <span className="lg-badge-dot" />
            ACCESS TERMINAL
          </div>
          <p className="lg-sub">SYS:PARKSMART // NODE:AUTH-01</p>
        </div>

        {/* Divider */}
        <div className="lg-divider" />

        {/* ── FORGOT PASSWORD VIEW ── */}
        {tab === "forgot" ? (
          <>
            <div className="lg-forgot-header">
              <button
                className="lg-forgot-back"
                onClick={() => { setTab("login"); setForgotMsg({ type: "", text: "" }); setForgotEmail(""); }}
              >
                ← BACK TO LOGIN
              </button>
              <div className="lg-forgot-title">RESET ACCESS KEY</div>
              <div className="lg-forgot-sub">Enter your registered email to receive a reset link.</div>
            </div>

            <div className="lg-input-group">
              <label className="lg-label">// Registered Email</label>
              <input
                type="email"
                className="lg-input"
                placeholder="Enter email identifier..."
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleForgot()}
              />
            </div>

            <button className="lg-btn" onClick={handleForgot} disabled={forgotLoading}>
              <span>{forgotLoading ? "TRANSMITTING..." : "SEND RESET LINK →"}</span>
            </button>

            {forgotMsg.text && (
              <div className={forgotMsg.type === "success" ? "lg-success" : "lg-error"}>
                {forgotMsg.text}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Tabs */}
            <div className="lg-tabs">
              <button
                className={`lg-tab ${tab === "login" ? "active" : ""}`}
                onClick={() => { setTab("login"); setError(""); }}
              >
                LOGIN
              </button>
              <button
                className={`lg-tab ${tab === "register" ? "active" : ""}`}
                onClick={() => { setTab("register"); setError(""); }}
              >
                REGISTER
              </button>
            </div>

            {/* Username */}
            <div className="lg-input-group">
              <label className="lg-label">// Username</label>
              <input
                className="lg-input"
                placeholder="Enter identifier..."
                value={username}
                onChange={e => setUsernameInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (tab === "login" ? handleLogin() : handleRegister())}
              />
            </div>

            {/* Email (register only) */}
            {tab === "register" && (
              <div className="lg-input-group">
                <label className="lg-label">// Email</label>
                <input
                  type="email"
                  className="lg-input"
                  placeholder="Enter email address..."
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleRegister()}
                />
              </div>
            )}

            {/* Password */}
            <div className="lg-input-group">
              <label className="lg-label">// Password</label>
              <input
                type="password"
                className="lg-input"
                placeholder="Enter passkey..."
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (tab === "login" ? handleLogin() : handleRegister())}
              />
            </div>

            {/* Forgot password link */}
            {tab === "login" && (
              <div className="lg-forgot-link" onClick={() => { setTab("forgot"); setError(""); }}>
                FORGOT ACCESS KEY?
              </div>
            )}

            {/* Submit button */}
            <button
              className="lg-btn"
              onClick={tab === "login" ? handleLogin : handleRegister}
              disabled={loading}
            >
              <span>
                {loading
                  ? "AUTHENTICATING..."
                  : tab === "login"
                  ? "INITIATE LOGIN →"
                  : "CREATE ACCOUNT →"}
              </span>
            </button>

            {error && <div className="lg-error">{error}</div>}
          </>
        )}

        {/* Admin link */}
        <div className="lg-admin-link" onClick={() => setIsAdmin(true)}>
          🔐 Admin Access
        </div>

        {/* Bottom bar */}
        <div className="lg-bottom">
          <span className="lg-bottom-dot" />
          <span className="lg-bottom-text">SYS:PARKSMART // NODE:AUTH-01</span>
        </div>
      </div>
    </div>
  );
}

export default Login;
