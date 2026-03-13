import React, { useState, useEffect } from "react";
import "./ResetPassword.css";

const API = "http://127.0.0.1:8000";

export default function ResetPassword() {
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error | invalid
  const [msg, setMsg] = useState("");

  useEffect(() => {
    // Extract token from URL: /reset-password?token=xxx
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setStatus("invalid");
      setMsg("Invalid or missing reset link.");
    } else {
      setToken(t);
    }
  }, []);

  const handleReset = async () => {
    if (!newPassword || !confirmPassword) { setMsg("Please fill all fields."); return; }
    if (newPassword.length < 4) { setMsg("Password must be at least 4 characters."); return; }
    if (newPassword !== confirmPassword) { setMsg("Passwords do not match."); return; }

    setStatus("loading");
    setMsg("");
    try {
      const res = await fetch(`${API}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMsg("Password reset successfully! You can now log in.");
      } else {
        setStatus("error");
        setMsg(data.detail || "Reset failed. The link may have expired.");
      }
    } catch {
      setStatus("error");
      setMsg("Cannot connect to server.");
    }
  };

  return (
    <div className="reset-container">
      <div className="reset-card">
        <div className="reset-logo">
          <h1>🚗 Park<span>Smart</span></h1>
          <p>Reset Your Password</p>
        </div>

        {status === "invalid" && (
          <div className="reset-msg reset-error">
            ⚠️ Invalid or missing reset link. Please request a new one.
          </div>
        )}

        {status === "success" && (
          <div className="reset-msg reset-success">
            ✅ {msg}
            <br />
            <a href="http://localhost:3000" className="reset-login-link">
              Go to Login →
            </a>
          </div>
        )}

        {(status === "idle" || status === "loading" || status === "error") && token && (
          <>
            <div className="reset-input-group">
              <label className="reset-label">New Password</label>
              <input
                type="password"
                className="reset-input"
                placeholder="Enter new password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleReset()}
              />
            </div>

            <div className="reset-input-group">
              <label className="reset-label">Confirm Password</label>
              <input
                type="password"
                className="reset-input"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleReset()}
              />
            </div>

            <button
              className="reset-btn"
              onClick={handleReset}
              disabled={status === "loading"}
            >
              {status === "loading" ? "Resetting..." : "Reset Password →"}
            </button>

            {msg && status === "error" && (
              <div className="reset-msg reset-error">{msg}</div>
            )}
            {msg && status === "idle" && (
              <div className="reset-msg reset-error">{msg}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}