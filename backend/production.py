"""Production entry point with deployment-specific request handling.

This module keeps the hardened application from ``main`` while adapting
booking rate limits to Render's reverse-proxy environment, providing a
transaction-like booking flow for MongoDB Atlas Free, and supporting a
separate opening window for every day of the week.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Dict, Optional

from fastapi import Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, model_validator
from pymongo import ASCENDING
from pymongo.errors import DuplicateKeyError

import main as hardened


_original_rate_limit = hardened.rate_limit


async def production_rate_limit(key: str, limit: int, seconds: int) -> None:
    """Use fresh, practical booking limits without weakening admin login limits."""
    if key.startswith("booking-ip:"):
        versioned_key = key.replace("booking-ip:", "booking-v2-ip:", 1)
        await _original_rate_limit(versioned_key, 30, 3600)
        return

    if key.startswith("booking-phone:"):
        versioned_key = key.replace("booking-phone:", "booking-v2-phone:", 1)
        await _original_rate_limit(versioned_key, 8, 3600)
        return

    await _original_rate_limit(key, limit, seconds)


hardened.rate_limit = production_rate_limit
app = hardened.app


class DayScheduleInput(BaseModel):
    enabled: bool = False
    open_time: str = Field(default="11:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    close_time: str = Field(default="18:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")

    @model_validator(mode="after")
    def validate_window(self):
        if self.enabled and self.open_time >= self.close_time:
            raise ValueError("La hora de cierre debe ser posterior a la apertura")
        return self


class ScheduleUpdateInput(BaseModel):
    weekly_schedule: Optional[Dict[str, DayScheduleInput]] = None
    open_days: Optional[list[int]] = None
    open_hour: Optional[int] = Field(default=None, ge=0, le=23)
    close_hour: Optional[int] = Field(default=None, ge=1, le=24)
    min_notice_minutes: Optional[int] = Field(default=None, ge=0, le=10080)
    slot_step_minutes: Optional[int] = Field(default=None, ge=5, le=120)


DAY_KEYS = [str(day) for day in range(7)]


def default_weekly_schedule() -> Dict[str, dict]:
    return {
        str(day): {
            "enabled": day == 0,
            "open_time": "11:00",
            "close_time": "18:00",
        }
        for day in range(7)
    }


def normalize_weekly_schedule(settings: dict) -> Dict[str, dict]:
    stored = settings.get("weekly_schedule")
    if isinstance(stored, dict):
        normalized: Dict[str, dict] = {}
        defaults = default_weekly_schedule()
        for key in DAY_KEYS:
            value = stored.get(key, defaults[key])
            normalized[key] = {
                "enabled": bool(value.get("enabled", False)),
                "open_time": str(value.get("open_time", defaults[key]["open_time"])),
                "close_time": str(value.get("close_time", defaults[key]["close_time"])),
            }
        return normalized

    open_days = {int(day) for day in settings.get("open_days", [0])}
    open_hour = int(settings.get("open_hour", 11))
    close_hour = int(settings.get("close_hour", 18))
    return {
        str(day): {
            "enabled": day in open_days,
            "open_time": f"{open_hour:02d}:00",
            "close_time": f"{close_hour:02d}:00",
        }
        for day in range(7)
    }


def public_schedule(settings: dict) -> dict:
    weekly = normalize_weekly_schedule(settings)
    enabled_days = [int(key) for key, value in weekly.items() if value["enabled"]]
    first_enabled = next((weekly[str(day)] for day in enabled_days), weekly["0"])
    return {
        "weekly_schedule": weekly,
        "open_days": enabled_days,
        # Legacy compatibility for the old settings panel. New UI uses weekly_schedule.
        "open_hour": int(first_enabled["open_time"].split(":", 1)[0]),
        "close_hour": int(first_enabled["close_time"].split(":", 1)[0]),
        "min_notice_minutes": int(settings.get("min_notice_minutes", 60)),
        "slot_step_minutes": int(settings.get("slot_step_minutes", 15)),
        "schedule_mode": "per_day",
    }


def day_key_for_date(date_value: str) -> str:
    parsed = datetime.strptime(date_value, "%Y-%m-%d").date()
    return str((parsed.weekday() + 1) % 7)


def datetime_for(date_value: str, hhmm: str) -> datetime:
    parsed_date = datetime.strptime(date_value, "%Y-%m-%d").date()
    parsed_time = datetime.strptime(hhmm, "%H:%M").time()
    return datetime.combine(parsed_date, parsed_time, tzinfo=hardened.APP_TIMEZONE)


async def validate_time_weekly(service: dict, date_value: str, time_value: str) -> dict:
    settings = await hardened.db.booking_settings.find_one({}, {"_id": 0}) or {}
    schedule = public_schedule(settings)
    day = schedule["weekly_schedule"][day_key_for_date(date_value)]
    if not day["enabled"]:
        raise HTTPException(status_code=400, detail="Ese día no está habilitado para reservas")

    start = hardened.parse_start(date_value, time_value)
    opening = datetime_for(date_value, day["open_time"])
    closing = datetime_for(date_value, day["close_time"])
    duration = int(service["duration_minutes"])
    if start < opening or start + timedelta(minutes=duration) > closing:
        raise HTTPException(status_code=400, detail="El servicio queda fuera del horario disponible para ese día")
    if start < hardened.local_now() + timedelta(minutes=schedule["min_notice_minutes"]):
        raise HTTPException(status_code=400, detail="No hay suficiente anticipación para esa hora")
    elapsed_minutes = int((start - opening).total_seconds() // 60)
    if elapsed_minutes % schedule["slot_step_minutes"] != 0:
        raise HTTPException(status_code=400, detail="La hora no coincide con los intervalos configurados")
    return schedule


hardened.validate_time = validate_time_weekly


async def upsert_booking_client(payload: hardened.BookingInput, phone_key: str) -> None:
    """Create or update the client without conflicting MongoDB operators."""
    await hardened.db.clients.update_one(
        {"phone_key": phone_key},
        {
            "$set": {
                "phone": payload.phone,
                "name": payload.name,
                "last_seen_at": hardened.now_iso(),
                "last_address": payload.address,
                "last_neighborhood": payload.neighborhood,
                "last_latitude": payload.latitude,
                "last_longitude": payload.longitude,
            },
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "phone_key": phone_key,
                "first_seen_at": hardened.now_iso(),
                "notes": "",
                "tags": [],
            },
            "$inc": {"bookings_count": 1},
        },
        upsert=True,
    )


def public_booking(document: dict) -> dict:
    return {
        key: value
        for key, value in document.items()
        if key not in {"_id", "lock_keys", "blocks_calendar"}
    }


# Replace routes that need production-specific behavior.
REPLACED_ROUTES = {
    ("/api/bookings", "POST"),
    ("/api/available-slots", "GET"),
    ("/api/booking-settings", "GET"),
    ("/api/admin/booking-settings", "PUT"),
    ("/api/admin/bookings/{booking_id}/status", "PUT"),
}
app.router.routes = [
    route
    for route in app.router.routes
    if not any(
        getattr(route, "path", "") == path
        and method in (getattr(route, "methods", set()) or set())
        for path, method in REPLACED_ROUTES
    )
]


@app.get("/api/booking-settings")
async def booking_settings_weekly():
    settings = await hardened.db.booking_settings.find_one({}, {"_id": 0}) or {}
    return public_schedule(settings)


@app.put("/api/admin/booking-settings")
async def update_booking_settings_weekly(
    payload: ScheduleUpdateInput,
    email: str = Depends(hardened.require_phase1_admin),
):
    current = await hardened.db.booking_settings.find_one({}, {"_id": 0}) or {}
    weekly = normalize_weekly_schedule(current)

    if payload.weekly_schedule is not None:
        incoming = payload.weekly_schedule
        missing = [key for key in DAY_KEYS if key not in incoming]
        if missing:
            raise HTTPException(status_code=422, detail="Debes configurar los siete días")
        weekly = {key: incoming[key].model_dump() for key in DAY_KEYS}
    elif payload.open_days is not None:
        # Compatibility with the old panel: enable or disable days without
        # destroying individual opening windows already configured.
        enabled = set(payload.open_days)
        for day in range(7):
            weekly[str(day)]["enabled"] = day in enabled

    update = {
        "weekly_schedule": weekly,
        "open_days": [int(key) for key, value in weekly.items() if value["enabled"]],
        "min_notice_minutes": (
            payload.min_notice_minutes
            if payload.min_notice_minutes is not None
            else int(current.get("min_notice_minutes", 60))
        ),
        "slot_step_minutes": (
            payload.slot_step_minutes
            if payload.slot_step_minutes is not None
            else int(current.get("slot_step_minutes", 15))
        ),
        "updated_at": hardened.now_iso(),
    }
    await hardened.db.booking_settings.update_one({}, {"$set": update}, upsert=True)
    await hardened.audit(email, "schedule_update", "booking_settings", "Horario semanal actualizado")
    return public_schedule(update)


@app.get("/api/available-slots")
async def available_slots_weekly(service_id: str, date_str: str):
    service = await hardened.db.services.find_one({"id": service_id, "active": True}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Fecha inválida") from exc

    settings = await hardened.db.booking_settings.find_one({}, {"_id": 0}) or {}
    schedule = public_schedule(settings)
    day = schedule["weekly_schedule"][day_key_for_date(date_str)]
    if not day["enabled"]:
        return {"date": date_str, "slots": [], "reason": "closed"}

    occupied: set[str] = set()
    bookings = await hardened.db.bookings.find(
        {"date": date_str, "blocks_calendar": True},
        {"_id": 0, "lock_keys": 1},
    ).to_list(500)
    for booking in bookings:
        occupied.update(booking.get("lock_keys", []))

    current = datetime_for(date_str, day["open_time"])
    closing = datetime_for(date_str, day["close_time"])
    last_start = closing - timedelta(minutes=int(service["duration_minutes"]))
    earliest = hardened.local_now() + timedelta(minutes=schedule["min_notice_minutes"])
    occupied_minutes = int(service["duration_minutes"]) + int(service.get("buffer_minutes", 20))
    slots: list[str] = []
    while current <= last_start:
        candidate = current.strftime("%H:%M")
        if current >= earliest and not occupied.intersection(
            hardened.lock_keys(date_str, candidate, occupied_minutes)
        ):
            slots.append(candidate)
        current += timedelta(minutes=schedule["slot_step_minutes"])
    return {"date": date_str, "slots": slots}


@app.post("/api/bookings")
async def create_booking_production(payload: hardened.BookingInput, request: Request):
    if not payload.accepted_policies or not payload.accepted_privacy:
        raise HTTPException(
            status_code=400,
            detail="Debes aceptar las políticas y el aviso de privacidad",
        )

    service = await hardened.db.services.find_one(
        {"id": payload.service_id, "active": True}, {"_id": 0}
    )
    if not service:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    await validate_time_weekly(service, payload.date, payload.time)
    phone_key = hardened.normalize_phone(payload.phone)
    ip = request.client.host if request.client else "unknown"
    await production_rate_limit(f"booking-ip:{ip}", 30, 3600)
    await production_rate_limit(f"booking-phone:{phone_key}", 8, 3600)

    occupied_minutes = int(service["duration_minutes"]) + int(
        service.get("buffer_minutes", 20)
    )
    booking = {
        "id": str(uuid.uuid4()),
        "service_id": service["id"],
        "service_name": service["name"],
        "service_duration": int(service["duration_minutes"]),
        "service_price": int(service["price"]),
        "service_buffer": int(service.get("buffer_minutes", 20)),
        "date": payload.date,
        "time": payload.time,
        "name": payload.name,
        "phone": payload.phone,
        "phone_key": phone_key,
        "address": payload.address,
        "neighborhood": payload.neighborhood,
        "note": payload.note,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "accepted_policies": True,
        "accepted_privacy": True,
        "accepted_at": hardened.now_iso(),
        "privacy_notice_version": hardened.PRIVACY_NOTICE_VERSION,
        "status": "pending_confirmation",
        # Pending reservations also hold the slot so another customer cannot
        # take it while Miguel is confirming the details through WhatsApp.
        "blocks_calendar": True,
        "lock_keys": hardened.lock_keys(
            payload.date, payload.time, occupied_minutes
        ),
        "created_at": hardened.now_iso(),
        "updated_at": hardened.now_iso(),
    }

    try:
        await hardened.db.bookings.insert_one(booking.copy())
    except DuplicateKeyError as exc:
        existing = await hardened.db.bookings.find_one(
            {
                "service_id": service["id"],
                "date": payload.date,
                "time": payload.time,
                "phone_key": phone_key,
                "status": {"$in": list(hardened.ACTIVE_STATUSES)},
            },
            {"_id": 0},
        )
        if existing:
            return {
                "ok": True,
                "booking": public_booking(existing),
                "message": "Tu solicitud ya estaba registrada y está pendiente de confirmación por Miguel.",
                "replayed": True,
            }
        raise HTTPException(
            status_code=409, detail="Ese horario ya no está disponible"
        ) from exc

    try:
        await upsert_booking_client(payload, phone_key)
    except Exception:
        await hardened.db.bookings.delete_one({"id": booking["id"]})
        raise

    return {
        "ok": True,
        "booking": public_booking(booking),
        "message": "Tu solicitud fue registrada y está pendiente de confirmación por Miguel.",
    }


@app.put("/api/admin/bookings/{booking_id}/status")
async def change_booking_status_production(
    booking_id: str,
    payload: hardened.StatusInput,
    email: str = Depends(hardened.require_phase1_admin),
):
    booking = await hardened.db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    current = booking.get("status", "pending_confirmation")
    transitions = {
        "pending_confirmation": {"confirmed", "cancelled"},
        "confirmed": {"completed", "cancelled", "no_show"},
        "completed": set(),
        "cancelled": set(),
        "no_show": set(),
    }
    if payload.status != current and payload.status not in transitions.get(current, set()):
        raise HTTPException(
            status_code=409,
            detail=f"No se puede cambiar una reserva de {current} a {payload.status}",
        )

    update = {
        "status": payload.status,
        "blocks_calendar": payload.status in hardened.ACTIVE_STATUSES,
        "status_note": payload.note.strip(),
        "updated_at": hardened.now_iso(),
    }
    timestamp_fields = {
        "confirmed": "confirmed_at",
        "completed": "completed_at",
        "cancelled": "cancelled_at",
        "no_show": "no_show_at",
    }
    timestamp_field = timestamp_fields.get(payload.status)
    if timestamp_field and payload.status != current:
        update[timestamp_field] = hardened.now_iso()

    await hardened.db.bookings.update_one({"id": booking_id}, {"$set": update})
    await hardened.audit(email, "status", booking_id, f"{current} -> {payload.status}")
    booking.update(update)
    return public_booking(booking)


@app.exception_handler(Exception)
async def production_exception_handler(request: Request, exc: Exception):
    """Return a stable JSON error so browser clients do not see only Failed to fetch."""
    return JSONResponse(
        status_code=500,
        content={
            "detail": "No pudimos completar la operación. Inténtalo nuevamente.",
            "request_path": request.url.path,
        },
    )


@app.middleware("http")
async def use_forwarded_client_ip(request: Request, call_next):
    """Expose the original client IP supplied by Render's reverse proxy."""
    forwarded_for = request.headers.get("x-forwarded-for", "")
    client_ip = forwarded_for.split(",", 1)[0].strip()
    if client_ip:
        current_port = request.client.port if request.client else 0
        request.scope["client"] = (client_ip, current_port)
    return await call_next(request)


@app.on_event("startup")
async def migrate_weekly_schedule():
    settings = await hardened.db.booking_settings.find_one({}, {"_id": 0}) or {}
    if not settings.get("weekly_schedule"):
        weekly = normalize_weekly_schedule(settings)
        await hardened.db.booking_settings.update_one(
            {},
            {
                "$set": {
                    "weekly_schedule": weekly,
                    "open_days": [
                        int(key) for key, value in weekly.items() if value["enabled"]
                    ],
                    "updated_at": hardened.now_iso(),
                }
            },
            upsert=True,
        )
