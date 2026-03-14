import os
import qrcode
import io
import json
import resend
import base64

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
SENDER_EMAIL = os.getenv("PARKSMART_EMAIL", "chananadaksh14@gmail.com")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

resend.api_key = RESEND_API_KEY


def _send(to_email: str, subject: str, html_body: str):
    """Send email via Resend."""
    try:
        params = {
            "from": "ParkSmart <onboarding@resend.dev>",
            "to": [to_email],
            "subject": subject,
            "html": html_body,
        }
        resend.Emails.send(params)
        print(f"✅ Email sent to {to_email}")
    except Exception as e:
        print(f"❌ Email failed: {e}")


def _send_with_qr(to_email: str, subject: str, html_body: str, qr_bytes: bytes):
    """Send email with embedded QR code via Resend."""
    try:
        encoded_qr = base64.b64encode(qr_bytes).decode()
        params = {
            "from": "ParkSmart <onboarding@resend.dev>",
            "to": [to_email],
            "subject": subject,
            "html": html_body,
            "attachments": [
                {
                    "filename": "booking_qr.png",
                    "content": encoded_qr,
                }
            ],
        }
        resend.Emails.send(params)
        print(f"✅ Email with QR sent to {to_email}")
    except Exception as e:
        print(f"❌ Email with QR failed: {e}")


def _generate_qr(data: dict) -> bytes:
    """Generate a QR code from a dict and return PNG bytes."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=8,
        border=3,
    )
    qr.add_data(json.dumps(data))
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0a0e1a", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ─────────────────────────────────────────────
# EMAIL 1 — Welcome on register
# ─────────────────────────────────────────────
def send_welcome_email(to_email: str, username: str):
    subject = "Welcome to ParkSmart 🚗"
    html = f"""
    <div style="font-family:Arial,sans-serif;background:#0a0e1a;padding:40px;">
      <div style="max-width:520px;margin:0 auto;background:#111827;border:1px solid #1e2d45;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(90deg,#00d4ff,#4d7cfe);height:4px;"></div>
        <div style="padding:36px;">
          <div style="font-size:28px;margin-bottom:6px;">🚗</div>
          <h1 style="font-size:22px;font-weight:800;color:#e8edf5;margin:0 0 6px;">
            Welcome to <span style="color:#00d4ff;">ParkSmart</span>
          </h1>
          <p style="color:#5a6a84;font-size:13px;margin:0 0 28px;">AI-Powered Parking Management</p>
          <p style="color:#e8edf5;font-size:14px;line-height:1.7;margin:0 0 20px;">
            Hey <strong style="color:#00d4ff;">{username}</strong>, your account has been created successfully!
            You can now log in and start booking parking slots instantly.
          </p>
          <div style="background:#0a0e1a;border:1px solid #1e2d45;border-radius:12px;padding:20px;margin-bottom:28px;">
            <p style="color:#5a6a84;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 14px;">What you can do</p>
            <div style="color:#e8edf5;font-size:13px;margin-bottom:8px;">🤖 &nbsp; AI-recommended parking slots</div>
            <div style="color:#e8edf5;font-size:13px;margin-bottom:8px;">📋 &nbsp; Real-time slot booking &amp; release</div>
            <div style="color:#e8edf5;font-size:13px;">📊 &nbsp; Full booking history</div>
          </div>
          <a href="{FRONTEND_URL}" style="display:inline-block;background:#00d4ff;color:#000;font-weight:700;font-size:14px;padding:13px 28px;border-radius:10px;text-decoration:none;">
            Go to ParkSmart →
          </a>
        </div>
        <div style="padding:18px 36px;border-top:1px solid #1e2d45;">
          <p style="color:#5a6a84;font-size:11px;margin:0;">This email was sent because you registered on ParkSmart.</p>
        </div>
      </div>
    </div>
    """
    _send(to_email, subject, html)


# ─────────────────────────────────────────────
# EMAIL 2 — Booking confirmation + QR code
# ─────────────────────────────────────────────
def send_booking_confirmation(to_email: str, username: str, slot_number: int,
                               vehicle_number: str, booked_at: str, zone: str = "A",
                               booking_id: int = 0):
    subject = f"Booking Confirmed — Slot S{slot_number} 🅿️"
    qr_data = {
        "booking_id": booking_id,
        "slot": f"S{slot_number}",
        "zone": f"Zone {zone}",
        "vehicle": vehicle_number,
        "user": username,
        "booked_at": booked_at,
        "issued_by": "ParkSmart AI"
    }
    qr_bytes = _generate_qr(qr_data)
    html = f"""
    <div style="font-family:Arial,sans-serif;background:#0a0e1a;padding:40px;">
      <div style="max-width:520px;margin:0 auto;background:#111827;border:1px solid #1e2d45;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(90deg,#00e676,#00d4ff);height:4px;"></div>
        <div style="padding:36px;">
          <div style="font-size:28px;margin-bottom:6px;">✅</div>
          <h1 style="font-size:22px;font-weight:800;color:#e8edf5;margin:0 0 6px;">
            Booking <span style="color:#00e676;">Confirmed</span>
          </h1>
          <p style="color:#5a6a84;font-size:13px;margin:0 0 28px;">Your parking slot has been reserved</p>
          <div style="background:#0a0e1a;border:1px solid #1e2d45;border-radius:12px;overflow:hidden;margin-bottom:24px;">
            <div style="padding:14px 20px;border-bottom:1px solid #1e2d45;">
              <p style="color:#5a6a84;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0;">Booking Details</p>
            </div>
            <div style="padding:20px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="color:#5a6a84;font-size:13px;padding:7px 0;">Booking ID</td><td style="color:#00d4ff;font-weight:700;text-align:right;">#{booking_id}</td></tr>
                <tr><td style="color:#5a6a84;font-size:13px;padding:7px 0;">Slot</td><td style="color:#00d4ff;font-size:16px;font-weight:700;text-align:right;">S{slot_number}</td></tr>
                <tr><td style="color:#5a6a84;font-size:13px;padding:7px 0;">Zone</td><td style="color:#e8edf5;font-size:13px;text-align:right;">Zone {zone}</td></tr>
                <tr><td style="color:#5a6a84;font-size:13px;padding:7px 0;">Vehicle</td><td style="color:#e8edf5;font-size:13px;text-align:right;">{vehicle_number}</td></tr>
                <tr><td style="color:#5a6a84;font-size:13px;padding:7px 0;">Booked By</td><td style="color:#e8edf5;font-size:13px;text-align:right;">{username}</td></tr>
                <tr><td style="color:#5a6a84;font-size:13px;padding:7px 0;">Booked At</td><td style="color:#e8edf5;font-size:13px;text-align:right;">{booked_at}</td></tr>
              </table>
            </div>
          </div>
          <p style="color:#5a6a84;font-size:12px;text-align:center;margin-bottom:16px;">📎 Your QR code is attached to this email — show it at the parking entry gate</p>
          <a href="{FRONTEND_URL}" style="display:inline-block;background:#00e676;color:#000;font-weight:700;font-size:14px;padding:13px 28px;border-radius:10px;text-decoration:none;">
            View My Booking →
          </a>
        </div>
        <div style="padding:18px 36px;border-top:1px solid #1e2d45;">
          <p style="color:#5a6a84;font-size:11px;margin:0;">ParkSmart AI Parking · Booking ID #{booking_id}</p>
        </div>
      </div>
    </div>
    """
    _send_with_qr(to_email, subject, html, qr_bytes)


# ─────────────────────────────────────────────
# EMAIL 3 — Password reset link
# ─────────────────────────────────────────────
def send_reset_email(to_email: str, username: str, reset_link: str):
    subject = "Reset Your ParkSmart Password 🔐"
    html = f"""
    <div style="font-family:Arial,sans-serif;background:#0a0e1a;padding:40px;">
      <div style="max-width:520px;margin:0 auto;background:#111827;border:1px solid #1e2d45;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(90deg,#ff3d5a,#ff6b35);height:4px;"></div>
        <div style="padding:36px;">
          <div style="font-size:28px;margin-bottom:6px;">🔐</div>
          <h1 style="font-size:22px;font-weight:800;color:#e8edf5;margin:0 0 6px;">
            Reset Your <span style="color:#ff6b35;">Password</span>
          </h1>
          <p style="color:#5a6a84;font-size:13px;margin:0 0 28px;">We received a request to reset your ParkSmart password.</p>
          <p style="color:#e8edf5;font-size:14px;line-height:1.7;margin:0 0 24px;">
            Hey <strong style="color:#00d4ff;">{username}</strong>, click below to reset your password.
            This link is valid for <strong style="color:#ffd600;">30 minutes</strong>.
          </p>
          <a href="{reset_link}" style="display:inline-block;background:#ff6b35;color:#fff;font-weight:700;font-size:14px;padding:13px 28px;border-radius:10px;text-decoration:none;margin-bottom:24px;">
            Reset My Password →
          </a>
          <div style="background:#0a0e1a;border:1px solid #1e2d45;border-radius:10px;padding:16px;margin-bottom:20px;">
            <p style="color:#5a6a84;font-size:11px;margin:0 0 8px;">Or copy this link:</p>
            <p style="color:#00d4ff;font-size:12px;word-break:break-all;margin:0;">{reset_link}</p>
          </div>
          <p style="color:#5a6a84;font-size:12px;">If you did not request this, ignore this email.</p>
        </div>
        <div style="padding:18px 36px;border-top:1px solid #1e2d45;">
          <p style="color:#5a6a84;font-size:11px;margin:0;">ParkSmart AI Parking · Link expires in 30 minutes.</p>
        </div>
      </div>
    </div>
    """
    _send(to_email, subject, html)
