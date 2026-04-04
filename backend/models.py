from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, timezone


def utcnow():
    """Return current UTC time as timezone-aware datetime."""
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    is_blocked = Column(Boolean, default=False)
    reset_token = Column(String, nullable=True)
    reset_token_expiry = Column(DateTime, nullable=True)
    otp_code = Column(String, nullable=True)
    otp_expiry = Column(DateTime, nullable=True)
    two_fa_enabled = Column(Boolean, default=True)
    bookings = relationship("Booking", back_populates="user")


class ParkingSlot(Base):
    __tablename__ = "parking_slots"
    id = Column(Integer, primary_key=True, index=True)
    slot_number = Column(Integer, unique=True, index=True)
    is_occupied = Column(Boolean, default=False)
    zone = Column(String, default="A")
    bookings = relationship("Booking", back_populates="slot")


class Booking(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    slot_id = Column(Integer, ForeignKey("parking_slots.id"))
    slot_number = Column(Integer)
    vehicle_number = Column(String)
    status = Column(String, default="active")   # active | completed | cancelled
    booked_at = Column(DateTime(timezone=True), default=utcnow)
    released_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="bookings")
    slot = relationship("ParkingSlot", back_populates="bookings")