import React, { useState } from "react";
import "./Login.css";

const API = "http://127.0.0.1:8000";

function Login({ setLoggedIn, setUsername, setIsAdmin }) {
  const [tab, setTab] = useState("login"); // login | register | forgot
  const [username, setUsernameInput] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState({ type: "", text: "" });
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!username || !password) { setError("Please fill all fields"); return; }
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
        setError(data.detail || "Login failed");
      }
    } catch {
      setError("Cannot connect to server. Is the backend running?");
    }
  };

  const handleRegister = async () => {
    setError("");
    if (!username || !email || !password) { setError("Please fill all fields"); return; }
    if (!email.includes("@")) { setError("Enter a valid email address"); return; }
    if (password.length < 4) { setError("Password must be at least 4 characters"); return; }
    try {
      const res = await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      if (res.ok) {
        setError("");
        setTab("login");
        alert("Registered! Check your email for a welcome message, then log in.");
      } else {
        const data = await res.json();
        setError(data.detail || "Registration failed");
      }
    } catch {
      setError("Cannot connect to server. Is the backend running?");
    }
  };

  const handleForgot = async () => {
    setForgotMsg({ type: "", text: "" });
    if (!forgotEmail.trim()) { setForgotMsg({ type: "error", text: "Please enter your email." }); return; }
    if (!forgotEmail.includes("@")) { setForgotMsg({ type: "error", text: "Enter a valid email address." }); return; }
    setForgotLoading(true);
    try {
      const res = await fetch(`${API}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setForgotMsg({ type: "success", text: "✅ Reset link sent! Check your email inbox." });
        setForgotEmail("");
      } else {
        setForgotMsg({ type: "error", text: data.detail || "Could not send reset email." });
      }
    } catch {
      setForgotMsg({ type: "error", text: "Cannot connect to server." });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <h1>🚗 Park<span>Smart</span></h1>
          <p>AI-Powered Parking Management</p>
        </div>

        {/* ── FORGOT PASSWORD VIEW ── */}
        {tab === "forgot" ? (
          <>
            <div className="forgot-header">
              <button className="forgot-back" onClick={() => { setTab("login"); setForgotMsg({ type: "", text: "" }); setForgotEmail(""); }}>
                ← Back to Login
              </button>
              <div className="forgot-title">Forgot Password</div>
              <div className="forgot-sub">Enter your registered email and we'll send you a reset link.</div>
            </div>

            <div className="input-group">
              <label className="input-label">Registered Email</label>
              <input
                type="email"
                className="login-input"
                placeholder="Enter your email"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleForgot()}
              />
            </div>

            <button className="login-button" onClick={handleForgot} disabled={forgotLoading}>
              {forgotLoading ? "Sending..." : "Send Reset Link →"}
            </button>

            {forgotMsg.text && (
              <div className={forgotMsg.type === "success" ? "login-success" : "login-error"}>
                {forgotMsg.text}
              </div>
            )}
          </>
        ) : (
          <>
            {/* ── LOGIN / REGISTER TABS ── */}
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
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsernameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (tab === "login" ? handleLogin() : handleRegister())}
              />
            </div>

            {tab === "register" && (
              <div className="input-group">
                <label className="input-label">Email</label>
                <input
                  type="email"
                  className="login-input"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                />
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Password</label>
              <input
                type="password"
                className="login-input"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (tab === "login" ? handleLogin() : handleRegister())}
              />
            </div>

            {tab === "login" && (
              <div className="forgot-link" onClick={() => { setTab("forgot"); setError(""); }}>
                Forgot password?
              </div>
            )}

            <button className="login-button" onClick={tab === "login" ? handleLogin : handleRegister}>
              {tab === "login" ? "Login →" : "Create Account →"}
            </button>

            {error && <div className="login-error">{error}</div>}
          </>
        )}

        <div className="admin-link" onClick={() => setIsAdmin(true)}>
          🔐 Admin Login
        </div>
      </div>
    </div>
  );
}

export default Login;