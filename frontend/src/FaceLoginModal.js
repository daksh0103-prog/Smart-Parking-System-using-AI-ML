import React, { useRef, useState, useEffect, useCallback } from "react";

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

/**
 * FaceLoginModal
 * Props:
 *   mode       : "login" | "register"
 *   username   : string (required only for register mode)
 *   onSuccess  : (username) => void   — called after match/register
 *   onClose    : () => void
 */
export default function FaceLoginModal({ mode = "login", username = "", onSuccess, onClose }) {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);

  const [status, setStatus]   = useState("idle");   // idle | streaming | captured | loading | success | error
  const [message, setMessage] = useState("");
  const [snapshot, setSnapshot] = useState(null);   // base64 data-url

  // ── Start camera ──────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setStatus("streaming");
    setMessage("");
    setSnapshot(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      setStatus("error");
      setMessage("Camera access denied. Please allow camera permissions and try again.");
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  // ── Capture frame ─────────────────────────────────────────
  const capture = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setSnapshot(dataUrl);
    setStatus("captured");
    stopCamera();
  };

  const retake = () => {
    setSnapshot(null);
    setMessage("");
    startCamera();
  };

  // ── Submit to backend ─────────────────────────────────────
  const submit = async () => {
    if (!snapshot) return;
    setStatus("loading");
    setMessage("");

    try {
      const endpoint = mode === "register" ? "/face-register" : "/face-login";
      const body     = mode === "register"
        ? { username, image: snapshot }
        : { image: snapshot };

      const res  = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage(mode === "register" ? "✅ Face registered successfully!" : `✅ Welcome back, ${data.username}!`);
        setTimeout(() => onSuccess(data.username || username), 1200);
      } else {
        setStatus("error");
        setMessage(data.detail || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Cannot connect to server. Is the backend running?");
    }
  };

  // ── UI ────────────────────────────────────────────────────
  const isLoading = status === "loading";

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={header}>
          <span style={{ fontSize: 20 }}>{mode === "register" ? "📸 Register Your Face" : "🤳 Face Login"}</span>
          <button style={closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Sub-title */}
        <p style={sub}>
          {mode === "register"
            ? "We'll save your face so you can log in instantly next time."
            : "Look straight at the camera and click Capture."}
        </p>

        {/* Camera / Snapshot area */}
        <div style={camBox}>
          {status === "streaming" && (
            <>
              <video ref={videoRef} style={video} autoPlay muted playsInline />
              <div style={scanLine} />
              <div style={cornerTL} /><div style={cornerTR} />
              <div style={cornerBL} /><div style={cornerBR} />
            </>
          )}

          {(status === "captured" || status === "loading" || status === "success") && snapshot && (
            <img src={snapshot} alt="snapshot" style={video} />
          )}

          {status === "error" && !snapshot && (
            <div style={placeholder}>
              <span style={{ fontSize: 48 }}>📷</span>
              <p style={{ color: "#e63946", marginTop: 12, fontSize: 13 }}>{message}</p>
            </div>
          )}

          {status === "idle" && (
            <div style={placeholder}><span style={{ fontSize: 48 }}>📷</span></div>
          )}
        </div>

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* Message */}
        {message && status !== "error" && (
          <div style={{ ...msgBox, background: status === "success" ? "#dcfce7" : "#f0f2fb", color: status === "success" ? "#166534" : "#4361ee" }}>
            {message}
          </div>
        )}
        {message && status === "error" && snapshot && (
          <div style={{ ...msgBox, background: "#fee2e2", color: "#991b1b" }}>{message}</div>
        )}

        {/* Actions */}
        <div style={actions}>
          {status === "streaming" && (
            <button style={primaryBtn} onClick={capture}>📸 Capture</button>
          )}

          {status === "captured" && (
            <>
              <button style={secondaryBtn} onClick={retake}>🔄 Retake</button>
              <button style={primaryBtn} onClick={submit}>
                {mode === "register" ? "💾 Save Face" : "🔍 Verify Face"}
              </button>
            </>
          )}

          {isLoading && (
            <button style={{ ...primaryBtn, opacity: 0.7 }} disabled>
              {mode === "register" ? "Saving..." : "Verifying..."}
            </button>
          )}

          {status === "error" && (
            <button style={primaryBtn} onClick={retake}>Try Again</button>
          )}
        </div>

        <p style={hint}>
          {mode === "login"
            ? "Can't login with face? Close this and use OTP instead."
            : "You can always use OTP or password to login."}
        </p>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const overlay = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 9999, backdropFilter: "blur(4px)",
};
const modal = {
  background: "#fff", borderRadius: 20, padding: "28px 28px 20px",
  width: "100%", maxWidth: 400, boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
  display: "flex", flexDirection: "column", gap: 0,
};
const header = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  marginBottom: 6, fontWeight: 700, fontSize: 16, color: "#1a1d2e",
};
const closeBtn = {
  background: "none", border: "none", fontSize: 18, cursor: "pointer",
  color: "#8a91b4", lineHeight: 1,
};
const sub = { fontSize: 13, color: "#6b7280", marginBottom: 16, lineHeight: 1.5 };
const camBox = {
  width: "100%", aspectRatio: "4/3", background: "#0f1117",
  borderRadius: 14, overflow: "hidden", position: "relative",
  display: "flex", alignItems: "center", justifyContent: "center",
  marginBottom: 14,
};
const video = { width: "100%", height: "100%", objectFit: "cover", display: "block" };
const placeholder = {
  display: "flex", flexDirection: "column", alignItems: "center",
  justifyContent: "center", width: "100%", height: "100%",
};

// Scanning corner frames
const corner = {
  position: "absolute", width: 24, height: 24,
  border: "3px solid #4361ee",
};
const cornerTL = { ...corner, top: 12, left: 12, borderRight: "none", borderBottom: "none", borderRadius: "4px 0 0 0" };
const cornerTR = { ...corner, top: 12, right: 12, borderLeft: "none", borderBottom: "none", borderRadius: "0 4px 0 0" };
const cornerBL = { ...corner, bottom: 12, left: 12, borderRight: "none", borderTop: "none", borderRadius: "0 0 0 4px" };
const cornerBR = { ...corner, bottom: 12, right: 12, borderLeft: "none", borderTop: "none", borderRadius: "0 0 4px 0" };

const scanLine = {
  position: "absolute", left: 12, right: 12, height: 2,
  background: "linear-gradient(90deg, transparent, #4361ee, transparent)",
  animation: "scan 2s linear infinite", top: "50%",
};

const msgBox = {
  borderRadius: 10, padding: "10px 14px", fontSize: 13,
  marginBottom: 12, fontWeight: 500, textAlign: "center",
};
const actions = { display: "flex", gap: 10, marginBottom: 12 };
const primaryBtn = {
  flex: 1, padding: "12px 0", background: "#4361ee", color: "#fff",
  border: "none", borderRadius: 12, fontWeight: 700, fontSize: 14,
  cursor: "pointer", transition: "opacity 0.2s",
};
const secondaryBtn = {
  flex: 1, padding: "12px 0", background: "#f0f2fb", color: "#4361ee",
  border: "none", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer",
};
const hint = { fontSize: 11, color: "#9ca3af", textAlign: "center", margin: 0 };
