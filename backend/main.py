from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse
from pydantic import BaseModel
from stable_baselines3 import DQN
from sqlalchemy.orm import Session
from sqlalchemy import Integer
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone

# Indian Standard Time offset (UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))

def to_ist(dt: datetime) -> datetime:
    """Convert a UTC datetime to IST for display purposes."""
    if dt is None:
        return dt
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST)
from typing import List
import threading
import qrcode
import json
import io
import secrets
import os
from dotenv import load_dotenv

load_dotenv()

from database import engine, SessionLocal
import models, schemas
from email_service import send_welcome_email, send_booking_confirmation, send_reset_email, send_otp_email
import random

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

app = FastAPI(title="ParkSmart AI API")

# Allow both local dev and production frontend
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    FRONTEND_URL,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create all tables
models.Base.metadata.create_all(bind=engine)

# Safe migration — add new 2FA columns if they don't exist yet
def run_migrations():
    try:
        with engine.connect() as conn:
            from sqlalchemy import text
            for col, coltype in [
                ("otp_code", "VARCHAR"),
                ("otp_expiry", "TIMESTAMP"),
                ("two_fa_enabled", "BOOLEAN DEFAULT TRUE"),
            ]:
                try:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {coltype}"))
                    conn.commit()
                    print(f"✅ Added column: {col}")
                except Exception:
                    pass  # Column already exists
    except Exception as e:
        print(f"⚠️ Migration warning: {e}")

run_migrations()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Load AI model safely
MODEL_PATH = "../ai_model/parksmart_dqn"
model = None
try:
    model = DQN.load(MODEL_PATH)
    print("✅ AI model loaded successfully")
except Exception as e:
    print(f"⚠️ AI model could not be loaded: {e}")
    print("⚠️ Falling back to rule-based slot recommendation")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def seed_slots(db: Session):
    """Seed 20 parking slots across 4 zones if not already present."""
    if db.query(models.ParkingSlot).count() == 0:
        zones = ["A"] * 5 + ["B"] * 5 + ["C"] * 5 + ["D"] * 5
        for i in range(20):
            db.add(models.ParkingSlot(slot_number=i, zone=zones[i]))
        db.commit()


def migrate_slots(db: Session):
    """Ensure DB always has 20 slots across 4 zones.
    Safe to call on every login/register — only adds missing slots."""
    TARGET = 20
    zones = ["A"] * 5 + ["B"] * 5 + ["C"] * 5 + ["D"] * 5
    current = db.query(models.ParkingSlot).count()
    if current < TARGET:
        for i in range(current, TARGET):
            db.add(models.ParkingSlot(slot_number=i, zone=zones[i]))
        db.commit()


# ─────────────────────────────────────────────
# ROOT
# ─────────────────────────────────────────────
@app.get("/")
def home():
    return {"message": "ParkSmart AI Backend Running"}


# ─────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────
@app.post("/register")
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    if db.query(models.User).filter(models.User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = pwd_context.hash(user.password)
    new_user = models.User(username=user.username, email=user.email, password=hashed)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    migrate_slots(db)
    # Send welcome email in background so it doesn't slow down the response
    threading.Thread(
        target=send_welcome_email,
        args=(user.email, user.username),
        daemon=True
    ).start()
    return {"message": "User registered successfully"}


@app.post("/login")
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if not db_user:
        raise HTTPException(status_code=400, detail="User not found")
    if not pwd_context.verify(user.password, db_user.password):
        raise HTTPException(status_code=400, detail="Wrong password")
    if db_user.is_blocked:
        raise HTTPException(status_code=403, detail="Your account has been blocked. Contact admin.")

    # Generate 6-digit OTP and send via email
    otp = str(random.randint(100000, 999999))
    db_user.otp_code = otp
    db_user.otp_expiry = datetime.now(timezone.utc) + timedelta(minutes=5)
    db.commit()

    threading.Thread(
        target=send_otp_email,
        args=(db_user.email, db_user.username, otp),
        daemon=True
    ).start()

    return {
        "message": "OTP sent to your email",
        "requires_otp": True,
        "username": db_user.username,
        "email_hint": db_user.email[:3] + "***@" + db_user.email.split("@")[1]
    }


# ─────────────────────────────────────────────
# VERIFY OTP — 2FA second step
# ─────────────────────────────────────────────
class VerifyOTPRequest(BaseModel):
    username: str
    otp: str

@app.post("/verify-otp")
def verify_otp(data: VerifyOTPRequest, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == data.username).first()
    if not db_user:
        raise HTTPException(status_code=400, detail="User not found")
    if not db_user.otp_code:
        raise HTTPException(status_code=400, detail="No OTP requested. Please login again.")
    if datetime.now(timezone.utc) > db_user.otp_expiry:
        db_user.otp_code = None
        db_user.otp_expiry = None
        db.commit()
        raise HTTPException(status_code=400, detail="OTP expired. Please login again.")
    if db_user.otp_code != data.otp.strip():
        raise HTTPException(status_code=400, detail="Incorrect OTP. Please try again.")

    # Clear OTP after successful verification
    db_user.otp_code = None
    db_user.otp_expiry = None
    db.commit()
    migrate_slots(db)
    return {"message": "Login successful", "username": db_user.username, "user_id": db_user.id}


# ─────────────────────────────────────────────
# RESEND OTP
# ─────────────────────────────────────────────
class ResendOTPRequest(BaseModel):
    username: str

@app.post("/resend-otp")
def resend_otp(data: ResendOTPRequest, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == data.username).first()
    if not db_user:
        raise HTTPException(status_code=400, detail="User not found")
    otp = str(random.randint(100000, 999999))
    db_user.otp_code = otp
    db_user.otp_expiry = datetime.now(timezone.utc) + timedelta(minutes=5)
    db.commit()
    threading.Thread(target=send_otp_email, args=(db_user.email, db_user.username, otp), daemon=True).start()
    return {"message": "New OTP sent to your email"}


# ─────────────────────────────────────────────
# GOOGLE AUTH — login or register via Google
# ─────────────────────────────────────────────
class GoogleAuthRequest(BaseModel):
    email: str
    name: str
    sub: str  # Google's unique user ID

@app.post("/google-auth")
def google_auth(data: GoogleAuthRequest, db: Session = Depends(get_db)):
    # Check if user exists by email
    existing = db.query(models.User).filter(models.User.email == data.email).first()
    if existing:
        if existing.is_blocked:
            raise HTTPException(status_code=403, detail="Your account has been blocked. Contact admin.")
        # Login — return existing username
        return {"message": "Login successful", "username": existing.username, "user_id": existing.id}

    # New user — register automatically
    google_username = data.name.replace(" ", "_").lower()
    # Ensure username is unique
    base = google_username
    counter = 1
    while db.query(models.User).filter(models.User.username == google_username).first():
        google_username = f"{base}_{counter}"
        counter += 1

    hashed = pwd_context.hash(f"google_{data.sub}")
    new_user = models.User(username=google_username, email=data.email, password=hashed)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    migrate_slots(db)
    threading.Thread(target=send_welcome_email, args=(data.email, google_username), daemon=True).start()
    return {"message": "Registered successfully", "username": google_username, "user_id": new_user.id}


# ─────────────────────────────────────────────
# FORGOT PASSWORD — send reset email
# ─────────────────────────────────────────────
class ForgotPasswordRequest(BaseModel):
    email: str

@app.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()
    # Always return success to prevent email enumeration attacks
    if not user:
        return {"message": "If this email is registered, a reset link has been sent."}

    # Generate a secure token valid for 30 minutes
    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expiry = datetime.now(timezone.utc) + timedelta(minutes=30)
    db.commit()

    reset_link = f"{FRONTEND_URL}?token={token}"
    threading.Thread(
        target=send_reset_email,
        args=(user.email, user.username, reset_link),
        daemon=True
    ).start()
    return {"message": "If this email is registered, a reset link has been sent."}


# ─────────────────────────────────────────────
# RESET PASSWORD — verify token and update
# ─────────────────────────────────────────────
class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@app.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.reset_token == data.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link.")
    if not user.reset_token_expiry or datetime.now(timezone.utc) > user.reset_token_expiry:
        raise HTTPException(status_code=400, detail="Reset link has expired. Please request a new one.")
    if len(data.new_password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters.")

    user.password = pwd_context.hash(data.new_password)
    user.reset_token = None
    user.reset_token_expiry = None
    db.commit()
    return {"message": "Password reset successfully."}


# ─────────────────────────────────────────────
# CHANGE PASSWORD (logged-in user)
# ─────────────────────────────────────────────
class ChangePasswordRequest(BaseModel):
    username: str
    old_password: str
    new_password: str

@app.post("/change-password")
def change_password(data: ChangePasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == data.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if not pwd_context.verify(data.old_password, user.password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if len(data.new_password) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters.")
    user.password = pwd_context.hash(data.new_password)
    db.commit()
    return {"message": "Password changed successfully."}


# ─────────────────────────────────────────────
# SLOTS — live state
# ─────────────────────────────────────────────
@app.get("/slots")
def get_slots(db: Session = Depends(get_db)):
    slots = db.query(models.ParkingSlot).order_by(models.ParkingSlot.slot_number).all()
    return [
        {
            "slot_number": s.slot_number,
            "is_occupied": s.is_occupied,
            "zone": s.zone,
        }
        for s in slots
    ]


# ─────────────────────────────────────────────
# AI RECOMMENDATION
# ─────────────────────────────────────────────
@app.post("/allocate-slot")
def allocate_slot(data: schemas.SlotRequest):
    slots = data.slots
    free_slots = [i for i, s in enumerate(slots) if s == 0]

    if not free_slots:
        raise HTTPException(status_code=400, detail="No free slots available")

    if model is not None:
        try:
            action, _ = model.predict(slots)
            recommended = int(action)
            if recommended in free_slots:
                explanation = f"Slot {recommended} recommended by AI based on learned parking patterns."
            else:
                recommended = free_slots[0]
                explanation = f"AI adjusted to nearest available slot {recommended}."
            return {"recommended_slot": recommended, "explanation": explanation}
        except Exception as e:
            print(f"Model prediction failed: {e}, using rule-based fallback")

    # Rule-based fallback
    zone_a = [i for i in free_slots if i < 5]
    recommended = zone_a[0] if zone_a else free_slots[0]
    explanation = f"Slot {recommended} recommended — closest to entrance in Zone A."
    return {"recommended_slot": recommended, "explanation": explanation}


# ─────────────────────────────────────────────
# BOOKING — create
# ─────────────────────────────────────────────
@app.post("/book")
def book_slot(data: schemas.BookingCreate, db: Session = Depends(get_db)):
    # Validate user
    user = db.query(models.User).filter(models.User.username == data.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check slot exists and is free
    slot = db.query(models.ParkingSlot).filter(
        models.ParkingSlot.slot_number == data.slot_number
    ).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if slot.is_occupied:
        raise HTTPException(status_code=400, detail="Slot already occupied")

    # Check this specific slot is not already booked by this user
    already = db.query(models.Booking).filter(
        models.Booking.user_id == user.id,
        models.Booking.slot_number == data.slot_number,
        models.Booking.status == "active"
    ).first()
    if already:
        raise HTTPException(status_code=400, detail=f"You already have an active booking for slot {data.slot_number}")

    # Create booking
    booking = models.Booking(
        user_id=user.id,
        slot_id=slot.id,
        slot_number=data.slot_number,
        vehicle_number=data.vehicle_number.upper(),
        status="active",
    )
    booking.status = "active"
    slot.is_occupied = True
    db.add(booking)
    db.commit()
    db.refresh(booking)

    # Send booking confirmation email with QR code in background
    threading.Thread(
        target=send_booking_confirmation,
        args=(
            user.email,
            user.username,
            data.slot_number,
            booking.vehicle_number,
            to_ist(booking.booked_at).strftime("%d %b %Y, %I:%M %p IST"),
            slot.zone,
            booking.id,
        ),
        daemon=True
    ).start()

    return {
        "message": f"Slot {data.slot_number} booked successfully",
        "booking_id": booking.id,
        "slot_number": booking.slot_number,
        "vehicle_number": booking.vehicle_number,
        "booked_at": booking.booked_at,
    }


# ─────────────────────────────────────────────
# BOOKING — release / checkout
# ─────────────────────────────────────────────
@app.post("/release")
def release_slot(data: schemas.BookingRelease, db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter(models.Booking.id == data.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "active":
        raise HTTPException(status_code=400, detail="Booking is not active")

    slot = db.query(models.ParkingSlot).filter(
        models.ParkingSlot.slot_number == booking.slot_number
    ).first()
    if slot:
        slot.is_occupied = False

    booking.status = "completed"
    booking.released_at = datetime.now(timezone.utc)
    db.commit()

    duration_mins = int((booking.released_at - booking.booked_at).total_seconds() / 60)

    # Fare Calculation: Rs10 per 30 minutes, minimum Rs10
    slots_used = duration_mins // 30 + (1 if duration_mins % 30 > 0 else 0)
    fare = max(10, slots_used * 10)

    return {
        "message": f"Slot {booking.slot_number} released successfully",
        "duration_minutes": duration_mins,
        "fare": fare,
    }


# ─────────────────────────────────────────────
# BOOKING HISTORY — per user
# ─────────────────────────────────────────────
@app.get("/history/{username}", response_model=List[schemas.BookingOut])
def booking_history(username: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    bookings = (
        db.query(models.Booking)
        .filter(models.Booking.user_id == user.id)
        .order_by(models.Booking.booked_at.desc())
        .all()
    )
    return bookings


# ─────────────────────────────────────────────
# ACTIVE BOOKINGS — per user (multiple allowed)
# ─────────────────────────────────────────────
@app.get("/active-booking/{username}")
def active_booking(username: str, db: Session = Depends(get_db)):
    """Returns all active bookings for the user as a list."""
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    bookings = db.query(models.Booking).filter(
        models.Booking.user_id == user.id,
        models.Booking.status == "active"
    ).order_by(models.Booking.booked_at.asc()).all()
    if not bookings:
        return {"active": False, "bookings": []}
    return {
        "active": True,
        "bookings": [
            {
                "booking_id": b.id,
                "slot_number": b.slot_number,
                "vehicle_number": b.vehicle_number,
                "booked_at": b.booked_at,
            }
            for b in bookings
        ],
    }


# ─────────────────────────────────────────────
# ADMIN — all bookings with username
# ─────────────────────────────────────────────
@app.get("/admin/bookings")
def admin_get_bookings(db: Session = Depends(get_db)):
    bookings = db.query(models.Booking).order_by(models.Booking.booked_at.desc()).all()
    result = []
    for b in bookings:
        user = db.query(models.User).filter(models.User.id == b.user_id).first()
        result.append({
            "id": b.id,
            "username": user.username if user else "unknown",
            "slot_number": b.slot_number,
            "vehicle_number": b.vehicle_number,
            "status": b.status,
            "booked_at": b.booked_at,
            "released_at": b.released_at,
        })
    return result


# ─────────────────────────────────────────────
# ADMIN — all users with stats
# ─────────────────────────────────────────────
@app.get("/admin/users")
def admin_get_users(db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    result = []
    for u in users:
        total_bookings = db.query(models.Booking).filter(models.Booking.user_id == u.id).count()
        active_booking = db.query(models.Booking).filter(
            models.Booking.user_id == u.id,
            models.Booking.status == "active"
        ).first()
        result.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "total_bookings": total_bookings,
            "active_slot": active_booking.slot_number if active_booking else None,
            "is_blocked": u.is_blocked,
        })
    return result


# ─────────────────────────────────────────────
# ADMIN — force release a slot
# ─────────────────────────────────────────────
class ForceReleaseRequest(BaseModel):
    booking_id: int

@app.post("/admin/force-release")
def admin_force_release(data: ForceReleaseRequest, db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter(models.Booking.id == data.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "active":
        raise HTTPException(status_code=400, detail="Booking is not active")
    slot = db.query(models.ParkingSlot).filter(
        models.ParkingSlot.slot_number == booking.slot_number
    ).first()
    if slot:
        slot.is_occupied = False
    booking.status = "completed"
    booking.released_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": f"Slot S{booking.slot_number} force-released by admin"}


# ─────────────────────────────────────────────
# ADMIN — block / unblock user
# ─────────────────────────────────────────────
class ToggleBlockRequest(BaseModel):
    user_id: int

@app.post("/admin/toggle-block")
def admin_toggle_block(data: ToggleBlockRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_blocked = not user.is_blocked
    # If blocking, cancel all active bookings
    if user.is_blocked:
        active = db.query(models.Booking).filter(
            models.Booking.user_id == user.id,
            models.Booking.status == "active"
        ).all()
        for b in active:
            slot = db.query(models.ParkingSlot).filter(
                models.ParkingSlot.slot_number == b.slot_number
            ).first()
            if slot:
                slot.is_occupied = False
            b.status = "cancelled"
            b.released_at = datetime.now(timezone.utc)
    db.commit()


    action = "blocked" if user.is_blocked else "unblocked"
    return {"message": f"User {user.username} has been {action}"}


# ─────────────────────────────────────────────
# ADMIN — Dynamic Slot Management
# ─────────────────────────────────────────────

class AddSlotsRequest(BaseModel):
    count: int          # how many new slots to add
    zone: str           # zone label e.g. "E"

class RemoveZoneRequest(BaseModel):
    zone: str           # zone to remove (only if all slots in it are free)

@app.post("/admin/add-slots")
def admin_add_slots(data: AddSlotsRequest, db: Session = Depends(get_db)):
    """Add `count` new slots to a given zone. Zone is created if it doesn't exist."""
    if data.count < 1 or data.count > 100:
        raise HTTPException(status_code=400, detail="count must be between 1 and 100")
    zone = data.zone.strip().upper()
    if not zone:
        raise HTTPException(status_code=400, detail="zone cannot be empty")

    # Next slot_number = max existing + 1
    from sqlalchemy import func
    max_num = db.query(func.max(models.ParkingSlot.slot_number)).scalar()
    start = (max_num + 1) if max_num is not None else 0

    for i in range(data.count):
        db.add(models.ParkingSlot(slot_number=start + i, zone=zone))
    db.commit()

    total = db.query(models.ParkingSlot).count()
    return {
        "message": f"Added {data.count} slot(s) to Zone {zone}",
        "new_slots": list(range(start, start + data.count)),
        "total_slots": total,
    }


@app.delete("/admin/remove-zone")
def admin_remove_zone(data: RemoveZoneRequest, db: Session = Depends(get_db)):
    """Remove all slots in a zone — only if none are currently occupied."""
    zone = data.zone.strip().upper()
    slots_in_zone = db.query(models.ParkingSlot).filter(models.ParkingSlot.zone == zone).all()
    if not slots_in_zone:
        raise HTTPException(status_code=404, detail=f"Zone {zone} not found")
    occupied = [s for s in slots_in_zone if s.is_occupied]
    if occupied:
        raise HTTPException(
            status_code=400,
            detail=f"Zone {zone} has {len(occupied)} occupied slot(s). Release them first."
        )
    for s in slots_in_zone:
        db.delete(s)
    db.commit()
    total = db.query(models.ParkingSlot).count()
    return {
        "message": f"Zone {zone} removed ({len(slots_in_zone)} slots deleted)",
        "total_slots": total,
    }


@app.get("/admin/slot-summary")
def admin_slot_summary(db: Session = Depends(get_db)):
    """Return per-zone slot counts for the admin panel."""
    from sqlalchemy import func
    rows = (
        db.query(models.ParkingSlot.zone, func.count().label("total"),
                 func.sum(models.ParkingSlot.is_occupied.cast(Integer)).label("occupied"))
        .group_by(models.ParkingSlot.zone)
        .order_by(models.ParkingSlot.zone)
        .all()
    )
    zones = [
        {"zone": r.zone, "total": r.total, "occupied": r.occupied or 0, "free": r.total - (r.occupied or 0)}
        for r in rows
    ]
    grand_total = db.query(models.ParkingSlot).count()
    return {"zones": zones, "total_slots": grand_total}


# ─────────────────────────────────────────────
# QR CODE — generate for a booking
# ─────────────────────────────────────────────
@app.get("/qr/{booking_id}")
def get_qr(booking_id: int, db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    slot = db.query(models.ParkingSlot).filter(
        models.ParkingSlot.slot_number == booking.slot_number
    ).first()

    qr_data = {
        "booking_id": booking.id,
        "slot": f"S{booking.slot_number}",
        "zone": f"Zone {slot.zone if slot else 'A'}",
        "vehicle": booking.vehicle_number,
        "booked_at": to_ist(booking.booked_at).strftime("%d %b %Y, %I:%M %p IST"),
        "issued_by": "ParkSmart AI"
    }

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=8,
        border=3,
    )
    qr.add_data(json.dumps(qr_data))
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0a0e1a", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")


# ─────────────────────────────────────────────
# STATS — summary for dashboard
# ─────────────────────────────────────────────
@app.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total = db.query(models.ParkingSlot).count()
    occupied = db.query(models.ParkingSlot).filter(models.ParkingSlot.is_occupied == True).count()
    free = total - occupied
    total_bookings = db.query(models.Booking).count()
    active_bookings = db.query(models.Booking).filter(models.Booking.status == "active").count()

    # Calculate total revenue from completed bookings
    completed = db.query(models.Booking).filter(models.Booking.status == "completed").all()
    total_revenue = 0
    for b in completed:
        if b.released_at and b.booked_at:
            mins = int((b.released_at - b.booked_at).total_seconds() / 60)
            slots_used = mins // 30 + (1 if mins % 30 > 0 else 0)
            total_revenue += max(10, slots_used * 10)

    return {
        "total_slots": total,
        "occupied_slots": occupied,
        "free_slots": free,
        "total_bookings": total_bookings,
        "active_bookings": active_bookings,
        "total_revenue": total_revenue,
    }