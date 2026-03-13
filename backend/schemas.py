from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    username: str
    email: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class SlotRequest(BaseModel):
    slots: list


class BookingCreate(BaseModel):
    slot_number: int
    vehicle_number: str
    username: str


class BookingRelease(BaseModel):
    booking_id: int


class BookingOut(BaseModel):
    id: int
    slot_number: int
    vehicle_number: str
    status: str
    booked_at: datetime
    released_at: Optional[datetime] = None

    class Config:
        from_attributes = True