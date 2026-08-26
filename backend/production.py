"""Production entry point with deployment-specific request handling.

This module keeps the hardened application from ``main`` while adapting
booking rate limits to Render's reverse-proxy environment and providing a
transaction-like booking flow for MongoDB Atlas Free.
"""

from __future__ import annotations

import uuid

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
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
            # MongoDB initializes a missing numeric field before incrementing it.
            # Keeping this field out of $setOnInsert avoids update-path conflicts.
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


# Replace the original route so a client-upsert failure cannot leave a booking
# stored while returning an error to the browser.
app.router.routes = [
    route
    for route in app.router.routes
    if not (
        getattr(route, "path", "") == "/api/bookings"
        and "POST" in (getattr(route, "methods", set()) or set())
    )
]


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

    await hardened.validate_time(service, payload.date, payload.time)
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
        # A browser retry after a lost response should receive the already-created
        # reservation instead of showing a false conflict or creating a duplicate.
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
            await upsert_booking_client(payload, phone_key)
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
        # Atlas Free does not support multi-document transactions. Compensate by
        # deleting the newly inserted booking when the client update fails.
        await hardened.db.bookings.delete_one({"id": booking["id"]})
        raise

    return {
        "ok": True,
        "booking": public_booking(booking),
        "message": "Tu solicitud fue registrada y está pendiente de confirmación por Miguel.",
    }


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
