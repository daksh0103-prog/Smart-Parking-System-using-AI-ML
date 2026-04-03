import React, { useState } from "react";
import "./Login.css";
import parksmartLogo from "./parksmart-logo.png";

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

function Login({ setLoggedIn, setUsername, setIsAdmin }) {
  const [tab, setTab] = useState("login");
  const [username, setUsernameInput] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState({ type: "", text: "" });
  const [forgotLoading, setForgotLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!username || !password) { setError("Please fill all fields"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) { setUsername(username); setLoggedIn(true); }
      else { const data = await res.json(); setError(data.detail || "Login failed"); }
    } catch { setError("Cannot connect to server. Is the backend running?"); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    setError("");
    if (!username || !email || !password) { setError("Please fill all fields"); return; }
    if (!email.includes("@")) { setError("Enter a valid email address"); return; }
    if (password.length < 4) { setError("Password must be at least 4 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      if (res.ok) { setError(""); setTab("login"); alert("Registered! You can now log in."); }
      else { const data = await res.json(); setError(data.detail || "Registration failed"); }
    } catch { setError("Cannot connect to server."); }
    finally { setLoading(false); }
  };

  const handleForgot = async () => {
    setForgotMsg({ type: "", text: "" });
    if (!forgotEmail.trim()) { setForgotMsg({ type: "error", text: "Please enter your email." }); return; }
    if (!forgotEmail.includes("@")) { setForgotMsg({ type: "error", text: "Enter a valid email." }); return; }
    setForgotLoading(true);
    try {
      const res = await fetch(`${API}/forgot-password`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (res.ok) { setForgotMsg({ type: "success", text: "Reset link sent! Check your inbox." }); setForgotEmail(""); }
      else { setForgotMsg({ type: "error", text: data.detail || "Could not send reset email." }); }
    } catch { setForgotMsg({ type: "error", text: "Cannot connect to server." }); }
    finally { setForgotLoading(false); }
  };

  return (
    <div className="lp-root">
      <div className="lp-card">

        {/* LEFT PANEL */}
        <div className="lp-left">
          <div className="lp-city-bg">
            <svg viewBox="0 0 600 300" preserveAspectRatio="xMidYMax meet" className="lp-skyline">
              <g fill="rgba(255,255,255,0.07)">
                <rect x="0" y="180" width="40" height="120"/><rect x="10" y="140" width="20" height="40"/>
                <rect x="50" y="200" width="30" height="100"/><rect x="85" y="150" width="50" height="150"/>
                <rect x="95" y="120" width="30" height="30"/><rect x="140" y="185" width="35" height="115"/>
                <rect x="180" y="145" width="55" height="155"/><rect x="190" y="115" width="35" height="30"/>
                <rect x="240" y="165" width="40" height="135"/><rect x="285" y="135" width="60" height="165"/>
                <rect x="295" y="105" width="40" height="30"/><rect x="350" y="175" width="35" height="125"/>
                <rect x="390" y="150" width="50" height="150"/><rect x="400" y="120" width="30" height="30"/>
                <rect x="445" y="170" width="40" height="130"/><rect x="490" y="155" width="55" height="145"/>
                <rect x="500" y="125" width="35" height="30"/><rect x="550" y="180" width="50" height="120"/>
              </g>
            </svg>
          </div>

          <div className="lp-brand">
            <div className="lp-brand-logo"><img src={parksmartLogo} alt="ParkSmart" /></div>
            <span className="lp-brand-name">ParkSmart</span>
          </div>

          <div className="lp-marquee-wrap"><div className="lp-marquee"><span>Smart City Living &nbsp;&nbsp;&nbsp; Smart City Living &nbsp;&nbsp;&nbsp;</span></div></div>

          <div className="lp-hero">
            <h2 className="lp-hero-title">Effortless access to the city's pulse.</h2>
            <div className="lp-hero-card">
              <p className="lp-hero-desc">Smart sensors, real-time availability, and frictionless payments—all managed from your fingertips.</p>
            </div>
          </div>

          <div className="lp-marquee-wrap lp-marquee-bottom"><div className="lp-marquee lp-marquee-rev"><span>Safe for work &nbsp;&nbsp;&nbsp; Safe for work &nbsp;&nbsp;&nbsp;</span></div></div>

          <div className="lp-social-proof">
            <div className="lp-avatars">
              <div className="lp-avatar" style={{background:"#6c63ff"}}>A</div>
              <div className="lp-avatar" style={{background:"#ff6584",marginLeft:-8}}>B</div>
              <div className="lp-avatar lp-avatar-count" style={{marginLeft:-8}}>+2k</div>
            </div>
            <span>Join 15,000+ smart parkers</span>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="lp-right">
          {tab === "forgot" ? (
            <div className="lp-form-wrap">
              <button className="lp-back-btn" onClick={() => { setTab("login"); setForgotMsg({ type: "", text: "" }); setForgotEmail(""); }}>← Back to Login</button>
              <h2 className="lp-welcome">Reset Password</h2>
              <p className="lp-sub">Enter your registered email and we'll send you a reset link.</p>
              <div className="lp-field">
                <label className="lp-label">EMAIL ADDRESS</label>
                <div className="lp-input-wrap">
                  <span className="lp-input-icon">✉</span>
                  <input type="email" className="lp-input" placeholder="your@email.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleForgot()} />
                </div>
              </div>
              <button className="lp-btn-primary" onClick={handleForgot} disabled={forgotLoading}>{forgotLoading ? "Sending..." : "Send Reset Link →"}</button>
              {forgotMsg.text && <div className={forgotMsg.type === "success" ? "lp-success" : "lp-error"}>{forgotMsg.text}</div>}
            </div>
          ) : (
            <div className="lp-form-wrap">
              <h2 className="lp-welcome">{tab === "login" ? "Welcome Back" : "Create Account"}</h2>
              <p className="lp-sub">{tab === "login" ? "Access your dashboard to manage your parking." : "Join 15,000+ smart parkers today."}</p>

              {tab === "login" && (
                <>
                  <div className="lp-social-btns">
                    <button className="lp-social-btn" onClick={() => setError("Google login coming soon!")}>
                      <svg width="17" height="17" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                      Google
                    </button>
                    <button className="lp-social-btn" onClick={() => setError("Apple login coming soon!")}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                      Apple
                    </button>
                  </div>
                  <div className="lp-divider"><span>OR USE EMAIL</span></div>
                </>
              )}

              <div className="lp-field">
                <label className="lp-label">USERNAME</label>
                <div className="lp-input-wrap">
                  <span className="lp-input-icon">👤</span>
                  <input className="lp-input" placeholder={tab === "login" ? "Enter your username" : "Choose a username"} value={username} onChange={e => setUsernameInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (tab === "login" ? handleLogin() : handleRegister())} />
                </div>
              </div>

              {tab === "register" && (
                <div className="lp-field">
                  <label className="lp-label">EMAIL ADDRESS</label>
                  <div className="lp-input-wrap">
                    <span className="lp-input-icon">✉</span>
                    <input type="email" className="lp-input" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleRegister()} />
                  </div>
                </div>
              )}

              <div className="lp-field">
                <label className="lp-label">PASSWORD</label>
                <div className="lp-input-wrap">
                  <span className="lp-input-icon">🔒</span>
                  <input type={showPassword ? "text" : "password"} className="lp-input" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && (tab === "login" ? handleLogin() : handleRegister())} />
                  <button type="button" className="lp-pw-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                    {showPassword
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              {tab === "login" && (
                <div className="lp-row-between">
                  <label className="lp-remember" onClick={() => setRememberMe(!rememberMe)}>
                    <div className={`lp-toggle ${rememberMe ? "lp-toggle-on" : ""}`}><div className="lp-toggle-thumb" /></div>
                    <span>Remember Me</span>
                  </label>
                  <button className="lp-forgot" onClick={() => { setTab("forgot"); setError(""); }}>Forgot Password?</button>
                </div>
              )}

              {error && <div className="lp-error">{error}</div>}

              <button className="lp-btn-primary" onClick={tab === "login" ? handleLogin : handleRegister} disabled={loading}>
                {loading ? "Please wait..." : tab === "login" ? "Sign In to ParkSmart" : "Create Account →"}
              </button>

              <p className="lp-switch">
                {tab === "login" ? "New here?" : "Already have an account?"}{" "}
                <button className="lp-switch-link" onClick={() => { setTab(tab === "login" ? "register" : "login"); setError(""); }}>
                  {tab === "login" ? "Create an account →" : "Sign in →"}
                </button>
              </p>
            </div>
          )}

          <div className="lp-footer">
            <div className="lp-footer-links">
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
              <span>Support</span>
              <button className="lp-footer-admin" onClick={() => setIsAdmin(true)}>🔐 Admin</button>
            </div>
            <span className="lp-footer-copy">© 2025 PARKSMART INC.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
