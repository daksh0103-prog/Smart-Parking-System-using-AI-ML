import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
import os
import qrcode
import io
import json

# ─────────────────────────────────────────────
# CONFIG — set these in your environment or
# replace directly for testing:
#   PARKSMART_EMAIL = "your_gmail@gmail.com"
#   PARKSMART_PASSWORD = "your_app_password"
#
# IMPORTANT: Use a Gmail App Password, NOT your
# real Gmail password. Generate one at:
# https://myaccount.google.com/apppasswords
# ─────────────────────────────────────────────

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = os.getenv("PARKSMART_EMAIL", "chananadaksh12@gmail.com")
SENDER_PASSWORD = os.getenv("PARKSMART_PASSWORD", "yqju llyw heqe erkw")


def _send(to_email: str, subject: str, html_body: str):
    """Internal helper — builds and sends a MIME email."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"ParkSmart 🚗 <{SENDER_EMAIL}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.sendmail(SENDER_EMAIL, to_email, msg.as_string())


def _send_with_qr(to_email: str, subject: str, html_body: str, qr_bytes: bytes):
    """Send email with an embedded QR code image (cid:qrcode)."""
    msg = MIMEMultipart("related")
    msg["Subject"] = subject
    msg["From"] = f"ParkSmart 🚗 <{SENDER_EMAIL}>"
    msg["To"] = to_email

    # Attach HTML body
    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(html_body, "html"))
    msg.attach(alt)

    # Attach QR image with Content-ID so HTML can reference it inline
    qr_img = MIMEImage(qr_bytes, _subtype="png")
    qr_img.add_header("Content-ID", "<qrcode>")
    qr_img.add_header("Content-Disposition", "inline", filename="booking_qr.png")
    msg.attach(qr_img)

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.sendmail(SENDER_EMAIL, to_email, msg.as_string())


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
    <div style="font-family:'DM Mono',monospace;background:#0a0e1a;padding:40px;min-height:100vh;">
      <div style="max-width:520px;margin:0 auto;background:#111827;border:1px solid #1e2d45;border-radius:16px;overflow:hidden;">

        <!-- Header bar -->
        <div style="background:linear-gradient(90deg,#00d4ff,#4d7cfe);height:4px;"></div>

        <!-- Body -->
        <div style="padding:36px 36px 28px;">
          <div style="font-size:28px;margin-bottom:6px;">🚗</div>
          <h1 style="font-family:Arial,sans-serif;font-size:22px;font-weight:800;color:#e8edf5;margin:0 0 6px;">
            Welcome to <span style="color:#00d4ff;">ParkSmart</span>
          </h1>
          <p style="color:#5a6a84;font-size:13px;margin:0 0 28px;">AI-Powered Parking Management</p>

          <p style="color:#e8edf5;font-size:14px;line-height:1.7;margin:0 0 20px;">
            Hey <strong style="color:#00d4ff;">{username}</strong>, your account has been created successfully.
            You can now log in and start booking parking slots instantly.
          </p>

          <!-- Feature highlights -->
          <div style="background:#0a0e1a;border:1px solid #1e2d45;border-radius:12px;padding:20px;margin-bottom:28px;">
            <p style="color:#5a6a84;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 14px;">What you can do</p>
            <div style="display:flex;flex-direction:column;gap:10px;">
              <div style="color:#e8edf5;font-size:13px;">🤖 &nbsp; AI-recommended parking slots</div>
              <div style="color:#e8edf5;font-size:13px;">📋 &nbsp; Real-time slot booking &amp; release</div>
              <div style="color:#e8edf5;font-size:13px;">📊 &nbsp; Full booking history</div>
            </div>
          </div>

          <a href="http://localhost:3000"
             style="display:inline-block;background:#00d4ff;color:#000;font-weight:700;font-size:14px;
                    padding:13px 28px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;">
            Go to ParkSmart →
          </a>
        </div>

        <!-- Footer -->
        <div style="padding:18px 36px;border-top:1px solid #1e2d45;">
          <p style="color:#5a6a84;font-size:11px;margin:0;">
            This email was sent because you registered on ParkSmart.<br>
            If this wasn't you, please ignore this email.
          </p>
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

    # QR code data — everything a guard needs to verify entry
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
    <div style="font-family:Arial,sans-serif;background:#0a0e1a;padding:40px;min-height:100vh;">
      <div style="max-width:520px;margin:0 auto;background:#111827;border:1px solid #1e2d45;border-radius:16px;overflow:hidden;">

        <!-- Header bar -->
        <div style="background:linear-gradient(90deg,#00e676,#00d4ff);height:4px;"></div>

        <!-- Body -->
        <div style="padding:36px 36px 28px;">
          <div style="font-size:28px;margin-bottom:6px;">✅</div>
          <h1 style="font-size:22px;font-weight:800;color:#e8edf5;margin:0 0 6px;">
            Booking <span style="color:#00e676;">Confirmed</span>
          </h1>
          <p style="color:#5a6a84;font-size:13px;margin:0 0 28px;">Your parking slot has been reserved</p>

          <!-- Booking details card -->
          <div style="background:#0a0e1a;border:1px solid #1e2d45;border-radius:12px;overflow:hidden;margin-bottom:24px;">
            <div style="padding:14px 20px;border-bottom:1px solid #1e2d45;">
              <p style="color:#5a6a84;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0;">Booking Details</p>
            </div>
            <div style="padding:20px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="color:#5a6a84;font-size:13px;padding:7px 0;">Booking ID</td>
                  <td style="color:#00d4ff;font-size:14px;font-weight:700;text-align:right;">#{booking_id}</td>
                </tr>
                <tr>
                  <td style="color:#5a6a84;font-size:13px;padding:7px 0;">Slot Number</td>
                  <td style="color:#00d4ff;font-size:16px;font-weight:700;text-align:right;">S{slot_number}</td>
                </tr>
                <tr>
                  <td style="color:#5a6a84;font-size:13px;padding:7px 0;">Zone</td>
                  <td style="color:#e8edf5;font-size:13px;text-align:right;">Zone {zone}</td>
                </tr>
                <tr>
                  <td style="color:#5a6a84;font-size:13px;padding:7px 0;">Vehicle</td>
                  <td style="color:#e8edf5;font-size:13px;text-align:right;">{vehicle_number}</td>
                </tr>
                <tr>
                  <td style="color:#5a6a84;font-size:13px;padding:7px 0;">Booked By</td>
                  <td style="color:#e8edf5;font-size:13px;text-align:right;">{username}</td>
                </tr>
                <tr>
                  <td style="color:#5a6a84;font-size:13px;padding:7px 0;">Booked At</td>
                  <td style="color:#e8edf5;font-size:13px;text-align:right;">{booked_at}</td>
                </tr>
              </table>
            </div>
          </div>

          <!-- QR Code section -->
          <div style="background:#0a0e1a;border:1px solid #1e2d45;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <p style="color:#5a6a84;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 16px;">
              Your Entry QR Code
            </p>
            <!-- Inline QR image referenced by Content-ID -->
            <img src="cid:qrcode" alt="Booking QR Code"
                 style="width:180px;height:180px;border-radius:12px;border:3px solid #1e2d45;" />
            <p style="color:#5a6a84;font-size:12px;margin:14px 0 0;">
              Show this QR code at the parking entry gate
            </p>
          </div>

          <a href="http://localhost:3000"
             style="display:inline-block;background:#00e676;color:#000;font-weight:700;font-size:14px;
                    padding:13px 28px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;">
            View My Booking →
          </a>
        </div>

        <!-- Footer -->
        <div style="padding:18px 36px;border-top:1px solid #1e2d45;">
          <p style="color:#5a6a84;font-size:11px;margin:0;">
            ParkSmart AI Parking · Booking ID #{booking_id} saved to your history.<br>
            Release your slot via the app when you leave.
          </p>
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
    <div style="font-family:Arial,sans-serif;background:#0a0e1a;padding:40px;min-height:100vh;">
      <div style="max-width:520px;margin:0 auto;background:#111827;border:1px solid #1e2d45;border-radius:16px;overflow:hidden;">

        <div style="background:linear-gradient(90deg,#ff3d5a,#ff6b35);height:4px;"></div>

        <div style="padding:36px 36px 28px;">
          <div style="font-size:28px;margin-bottom:6px;">🔐</div>
          <h1 style="font-size:22px;font-weight:800;color:#e8edf5;margin:0 0 6px;">
            Reset Your <span style="color:#ff6b35;">Password</span>
          </h1>
          <p style="color:#5a6a84;font-size:13px;margin:0 0 28px;">
            We received a request to reset the password for your ParkSmart account.
          </p>

          <p style="color:#e8edf5;font-size:14px;line-height:1.7;margin:0 0 24px;">
            Hey <strong style="color:#00d4ff;">{username}</strong>, click the button below
            to reset your password. This link is valid for <strong style="color:#ffd600;">30 minutes</strong>.
          </p>

          <a href="{reset_link}"
             style="display:inline-block;background:#ff6b35;color:#fff;font-weight:700;font-size:14px;
                    padding:13px 28px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;margin-bottom:24px;">
            Reset My Password →
          </a>

          <div style="background:#0a0e1a;border:1px solid #1e2d45;border-radius:10px;padding:16px;margin-bottom:20px;">
            <p style="color:#5a6a84;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 8px;">
              Or copy this link into your browser
            </p>
            <p style="color:#00d4ff;font-size:12px;word-break:break-all;margin:0;">{reset_link}</p>
          </div>

          <p style="color:#5a6a84;font-size:12px;line-height:1.6;margin:0;">
            If you did not request a password reset, you can safely ignore this email.
            Your password will not be changed.
          </p>
        </div>

        <div style="padding:18px 36px;border-top:1px solid #1e2d45;">
          <p style="color:#5a6a84;font-size:11px;margin:0;">
            ParkSmart AI Parking · This link expires in 30 minutes.
          </p>
        </div>
      </div>
    </div>
    """
    _send(to_email, subject, html)