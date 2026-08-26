from __future__ import annotations

import os
import re
import uuid
from datetime import datetime, time, timedelta, timezone
from typing import Any, Dict, List, Literal, Optional
from zoneinfo import ZoneInfo

import jwt
from fastapi import Depends, FastAPI, Header, HTTPException, Request, UploadFile, File
from pydantic import BaseModel, EmailStr, Field, field_validator
from pymongo import ASCENDING, ReturnDocument
from pymongo.errors import DuplicateKeyError, OperationFailure
from starlette.middleware.cors import CORSMiddleware

import server as legacy

APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
JWT_TTL_MINUTES = int(os.getenv("JWT_TTL_MINUTES", "720"))
APP_TIMEZONE = ZoneInfo(os.getenv("APP_TIMEZONE", "America/Monterrey"))
CORS_ORIGINS = [
    value.strip().rstrip("/")
    for value in os.getenv("CORS_ORIGINS", "http://localhost:8081,http://localhost:19006").split(",")
    if value.strip()
]
PRIVACY_NOTICE_VERSION = "2026-08-26"
ACTIVE_STATUSES = {"pending_confirmation", "confirmed"}

if APP_ENV == "production":
    if len(legacy.JWT_SECRET) < 32:
        raise RuntimeError("JWT_SECRET must contain at least 32 characters in production")
    if len(legacy.ADMIN_INITIAL_PASSWORD) < 12:
        raise RuntimeError("ADMIN_INITIAL_PASSWORD must contain at least 12 characters in production")
    if not CORS_ORIGINS or "*" in CORS_ORIGINS:
        raise RuntimeError("CORS_ORIGINS must contain explicit production origins")

app = FastAPI(title="Miguel Suárez API", version="1.0.0")
db = legacy.db
pwd_context = legacy.pwd_context

# Preserve the already-tested CRUD routes while replacing security- and booking-critical routes.
REPLACED_PATHS = {
    "/api/",
    "/api/services",
    "/api/zones",
    "/api/faqs",
    "/api/testimonials",
    "/api/available-slots",
    "/api/bookings",
    "/api/admin/login",
    "/api/admin/bookings",
    "/api/admin/change-password",
    "/api/admin/upload",
    "/api/files/{path:path}",
    "/api/content-blocks/{key}",
}
for route in legacy.app.router.routes:
    path = getattr(route, "path", "")
    if path.startswith("/api") and path not in REPLACED_PATHS:
        app.router.routes.append(route)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now_utc().isoformat()


def local_now() -> datetime:
    return now_utc().astimezone(APP_TIMEZONE)


def normalize_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    if not 10 <= len(digits) <= 15:
        raise HTTPException(status_code=422, detail="El teléfono debe contener entre 10 y 15 dígitos")
    return digits


def parse_start(date_value: str, time_value: str) -> datetime:
    try:
        parsed_date = datetime.strptime(date_value, "%Y-%m-%d").date()
        parsed_time = datetime.strptime(time_value, "%H:%M").time()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Fecha u hora inválida") from exc
    return datetime.combine(parsed_date, parsed_time, tzinfo=APP_TIMEZONE)


def lock_keys(date_value: str, time_value: str, minutes: int) -> List[str]:
    start = parse_start(date_value, time_value)
    return [
        (start + timedelta(minutes=offset)).strftime("%Y-%m-%dT%H:%M")
        for offset in range(max(1, minutes))
    ]


def decode_authorization(authorization: Optional[str]) -> Dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="No autorizado")
    try:
        return jwt.decode(authorization.split(" ", 1)[1].strip(), legacy.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="No autorizado") from exc


async def require_phase1_admin(authorization: Optional[str] = Header(None)) -> str:
    payload = decode_authorization(authorization)
    email = str(payload.get("sub", "")).lower()
    jti = payload.get("jti")
    version = payload.get("ver")
    user = await db.admin_users.find_one({"email": email, "active": {"$ne": False}}, {"_id": 0})
    session = await db.admin_sessions.find_one({"jti": jti, "email": email, "revoked_at": {"$exists": False}})
    if not user or not session or int(user.get("session_version", 1)) != int(version or 0):
        raise HTTPException(status_code=401, detail="No autorizado")
    return email


async def rate_limit(key: str, limit: int, seconds: int) -> None:
    bucket = int(now_utc().timestamp()) // seconds
    doc = await db.rate_limits.find_one_and_update(
        {"_id": f"{key}:{bucket}"},
        {"$inc": {"count": 1}, "$setOnInsert": {"expires_at": now_utc() + timedelta(seconds=seconds * 2)}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    if int(doc.get("count", 0)) > limit:
        raise HTTPException(status_code=429, detail="Demasiados intentos. Inténtalo más tarde")


async def audit(email: str, action: str, entity_id: str, summary: str = "") -> None:
    await db.admin_audit.insert_one({
        "id": str(uuid.uuid4()),
        "user_email": email,
        "action": action,
        "entity_type": "booking" if action in {"status", "reschedule"} else "admin_user",
        "entity_id": entity_id,
        "summary": summary[:300],
        "created_at": now_iso(),
    })


class BookingInput(BaseModel):
    service_id: str = Field(min_length=1, max_length=100)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(pattern=r"^\d{2}:\d{2}$")
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=8, max_length=30)
    address: str = Field(min_length=5, max_length=300)
    neighborhood: str = Field(min_length=2, max_length=120)
    note: str = Field(default="", max_length=1000)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    accepted_policies: bool
    accepted_privacy: bool = False

    @field_validator("name", "phone", "address", "neighborhood", "note")
    @classmethod
    def clean(cls, value: str) -> str:
        return value.strip()


class LoginInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class ChangePasswordInput(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=12, max_length=200)

    @field_validator("new_password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        if not re.search(r"[a-z]", value) or not re.search(r"[A-Z]", value):
            raise ValueError("La contraseña debe incluir mayúsculas y minúsculas")
        if not re.search(r"\d", value) or not re.search(r"[^A-Za-z0-9]", value):
            raise ValueError("La contraseña debe incluir un número y un símbolo")
        return value


class StatusInput(BaseModel):
    status: Literal["pending_confirmation", "confirmed", "completed", "cancelled", "no_show"]
    note: str = Field(default="", max_length=500)


class RescheduleInput(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(pattern=r"^\d{2}:\d{2}$")


async def validate_time(service: Dict[str, Any], date_value: str, time_value: str) -> Dict[str, Any]:
    settings = await db.booking_settings.find_one({}, {"_id": 0}) or legacy.BookingSettings().model_dump()
    start = parse_start(date_value, time_value)
    if (start.weekday() + 1) % 7 not in settings["open_days"]:
        raise HTTPException(status_code=400, detail="Ese día no está habilitado para reservas")
    opening = start.replace(hour=int(settings["open_hour"]), minute=0)
    closing = start.replace(hour=int(settings["close_hour"]), minute=0)
    if start < opening or start + timedelta(minutes=int(service["duration_minutes"])) > closing:
        raise HTTPException(status_code=400, detail="El servicio queda fuera del horario disponible")
    if start < local_now() + timedelta(minutes=int(settings["min_notice_minutes"])):
        raise HTTPException(status_code=400, detail="No hay suficiente anticipación para esa hora")
    if start.minute % int(settings["slot_step_minutes"]) != 0:
        raise HTTPException(status_code=400, detail="La hora no coincide con los intervalos configurados")
    return settings


@app.middleware("http")
async def admin_session_guard(request: Request, call_next):
    path = request.url.path
    if request.method != "OPTIONS" and path.startswith("/api/admin/") and path != "/api/admin/login":
        try:
            await require_phase1_admin(request.headers.get("authorization"))
        except HTTPException as exc:
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    return await call_next(request)


@app.get("/api/")
async def root():
    return {"ok": True, "name": "Miguel Suárez API", "environment": APP_ENV}


@app.get("/api/health")
async def health():
    await legacy.client.admin.command("ping")
    return {"ok": True, "database": "connected"}


@app.get("/api/services")
async def services():
    return await db.services.find({"active": True}, {"_id": 0}).sort("display_order", 1).to_list(500)


@app.get("/api/zones")
async def zones():
    return await db.zones.find({"active": True}, {"_id": 0}).sort("display_order", 1).to_list(500)


@app.get("/api/faqs")
async def faqs():
    return await db.faqs.find({"active": True}, {"_id": 0}).sort("display_order", 1).to_list(500)


@app.get("/api/testimonials")
async def testimonials():
    return await db.testimonials.find({"active": True, "permission_confirmed": True}, {"_id": 0}).sort("display_order", 1).to_list(500)


@app.get("/api/privacy-notice")
async def privacy_notice():
    return {
        "version": PRIVACY_NOTICE_VERSION,
        "controller": "Miguel Ángel Suárez",
        "purpose": "Gestionar solicitudes de reserva, contactar al cliente y prestar el servicio de barbería a domicilio.",
        "data": ["nombre", "teléfono", "dirección", "colonia", "fecha y hora", "nota opcional", "ubicación opcional"],
        "retention": "Los datos se conservan mientras sean necesarios para administrar la relación con el cliente.",
        "rights": "Puedes solicitar acceso, corrección o eliminación mediante los datos de contacto publicados en el sitio.",
    }


@app.get("/api/content-blocks/{key}")
async def active_content_block(key: str):
    block = await db.content_blocks.find_one({"section_key": key, "active": True}, {"_id": 0})
    if not block:
        raise HTTPException(status_code=404, detail="Bloque no encontrado")
    return block


@app.get("/api/available-slots")
async def available_slots(service_id: str, date_str: str):
    service = await db.services.find_one({"id": service_id, "active": True}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    try:
        target = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Fecha inválida") from exc
    settings = await db.booking_settings.find_one({}, {"_id": 0}) or legacy.BookingSettings().model_dump()
    if (target.weekday() + 1) % 7 not in settings["open_days"]:
        return {"date": date_str, "slots": [], "reason": "closed"}
    occupied: set[str] = set()
    for booking in await db.bookings.find({"date": date_str, "blocks_calendar": True}, {"_id": 0, "lock_keys": 1}).to_list(500):
        occupied.update(booking.get("lock_keys", []))
    current = datetime.combine(target, time(int(settings["open_hour"]), 0), tzinfo=APP_TIMEZONE)
    closing = datetime.combine(target, time(int(settings["close_hour"]), 0), tzinfo=APP_TIMEZONE)
    last_start = closing - timedelta(minutes=int(service["duration_minutes"]))
    earliest = local_now() + timedelta(minutes=int(settings["min_notice_minutes"]))
    occupied_minutes = int(service["duration_minutes"]) + int(service.get("buffer_minutes", 20))
    slots: List[str] = []
    while current <= last_start:
        candidate = current.strftime("%H:%M")
        if current >= earliest and not occupied.intersection(lock_keys(date_str, candidate, occupied_minutes)):
            slots.append(candidate)
        current += timedelta(minutes=int(settings["slot_step_minutes"]))
    return {"date": date_str, "slots": slots}


@app.post("/api/bookings")
async def create_booking(payload: BookingInput, request: Request):
    if not payload.accepted_policies or not payload.accepted_privacy:
        raise HTTPException(status_code=400, detail="Debes aceptar las políticas y el aviso de privacidad")
    service = await db.services.find_one({"id": payload.service_id, "active": True}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    await validate_time(service, payload.date, payload.time)
    phone_key = normalize_phone(payload.phone)
    ip = request.client.host if request.client else "unknown"
    await rate_limit(f"booking-ip:{ip}", 10, 3600)
    await rate_limit(f"booking-phone:{phone_key}", 4, 86400)
    occupied_minutes = int(service["duration_minutes"]) + int(service.get("buffer_minutes", 20))
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
        "accepted_at": now_iso(),
        "privacy_notice_version": PRIVACY_NOTICE_VERSION,
        "status": "pending_confirmation",
        "blocks_calendar": True,
        "lock_keys": lock_keys(payload.date, payload.time, occupied_minutes),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    try:
        await db.bookings.insert_one(booking.copy())
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="Ese horario ya no está disponible") from exc
    await db.clients.update_one(
        {"phone_key": phone_key},
        {
            "$set": {
                "phone": payload.phone,
                "name": payload.name,
                "last_seen_at": now_iso(),
                "last_address": payload.address,
                "last_neighborhood": payload.neighborhood,
                "last_latitude": payload.latitude,
                "last_longitude": payload.longitude,
            },
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "phone_key": phone_key,
                "first_seen_at": now_iso(),
                "bookings_count": 0,
                "notes": "",
                "tags": [],
            },
            "$inc": {"bookings_count": 1},
        },
        upsert=True,
    )
    public_booking = {key: value for key, value in booking.items() if key not in {"lock_keys", "blocks_calendar"}}
    return {"ok": True, "booking": public_booking, "message": "Tu solicitud fue registrada y está pendiente de confirmación por Miguel."}


@app.post("/api/admin/login")
async def login(payload: LoginInput, request: Request):
    email = str(payload.email).lower()
    ip = request.client.host if request.client else "unknown"
    await rate_limit(f"login:{ip}:{email}", 5, 900)
    user = await db.admin_users.find_one({"email": email, "active": {"$ne": False}}, {"_id": 0})
    if not user or not pwd_context.verify(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    issued = now_utc()
    expires = issued + timedelta(minutes=JWT_TTL_MINUTES)
    jti = str(uuid.uuid4())
    token = jwt.encode(
        {"sub": email, "ver": int(user.get("session_version", 1)), "jti": jti, "iat": issued, "exp": expires},
        legacy.JWT_SECRET,
        algorithm="HS256",
    )
    await db.admin_sessions.insert_one({"jti": jti, "email": email, "created_at": issued, "expires_at": expires, "ip": ip})
    return {"token": token, "email": email, "expires_at": expires.isoformat()}


@app.post("/api/admin/logout")
async def logout(authorization: Optional[str] = Header(None), email: str = Depends(require_phase1_admin)):
    payload = decode_authorization(authorization)
    await db.admin_sessions.update_one({"jti": payload["jti"], "email": email}, {"$set": {"revoked_at": now_utc()}})
    return {"ok": True}


@app.get("/api/admin/services")
async def admin_services(email: str = Depends(require_phase1_admin)):
    return await db.services.find({}, {"_id": 0}).sort("display_order", 1).to_list(500)


@app.get("/api/admin/zones")
async def admin_zones(email: str = Depends(require_phase1_admin)):
    return await db.zones.find({}, {"_id": 0}).sort("display_order", 1).to_list(500)


@app.get("/api/admin/faqs")
async def admin_faqs(email: str = Depends(require_phase1_admin)):
    return await db.faqs.find({}, {"_id": 0}).sort("display_order", 1).to_list(500)


@app.get("/api/admin/bookings")
async def admin_bookings(email: str = Depends(require_phase1_admin)):
    return await db.bookings.find({}, {"_id": 0, "lock_keys": 0, "blocks_calendar": 0}).sort([("date", ASCENDING), ("time", ASCENDING)]).to_list(1000)


@app.put("/api/admin/bookings/{booking_id}/status")
async def change_status(booking_id: str, payload: StatusInput, email: str = Depends(require_phase1_admin)):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    transitions = {
        "pending_confirmation": {"confirmed", "cancelled"},
        "confirmed": {"completed", "cancelled", "no_show"},
        "completed": set(), "cancelled": set(), "no_show": set(),
    }
    current = booking.get("status", "pending_confirmation")
    if payload.status != current and payload.status not in transitions.get(current, set()):
        raise HTTPException(status_code=409, detail=f"No se puede cambiar una reserva de {current} a {payload.status}")
    update = {
        "status": payload.status,
        "blocks_calendar": payload.status in ACTIVE_STATUSES,
        "status_note": payload.note.strip(),
        "updated_at": now_iso(),
    }
    await db.bookings.update_one({"id": booking_id}, {"$set": update})
    await audit(email, "status", booking_id, f"{current} -> {payload.status}")
    booking.update(update)
    booking.pop("lock_keys", None)
    booking.pop("blocks_calendar", None)
    return booking


@app.put("/api/admin/bookings/{booking_id}/reschedule")
async def reschedule(booking_id: str, payload: RescheduleInput, email: str = Depends(require_phase1_admin)):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    if booking.get("status") not in ACTIVE_STATUSES:
        raise HTTPException(status_code=409, detail="Solo se pueden reprogramar reservas pendientes o confirmadas")
    service = {"duration_minutes": booking["service_duration"], "buffer_minutes": booking.get("service_buffer", 20)}
    await validate_time(service, payload.date, payload.time)
    update = {
        "date": payload.date,
        "time": payload.time,
        "lock_keys": lock_keys(payload.date, payload.time, int(service["duration_minutes"]) + int(service["buffer_minutes"])),
        "updated_at": now_iso(),
    }
    try:
        await db.bookings.update_one({"id": booking_id}, {"$set": update})
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="Ese horario ya no está disponible") from exc
    await audit(email, "reschedule", booking_id, f"{payload.date} {payload.time}")
    booking.update(update)
    booking.pop("lock_keys", None)
    booking.pop("blocks_calendar", None)
    return booking


@app.post("/api/admin/change-password")
async def change_password(payload: ChangePasswordInput, email: str = Depends(require_phase1_admin)):
    user = await db.admin_users.find_one({"email": email}, {"_id": 0})
    if not user or not pwd_context.verify(payload.current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Contraseña actual incorrecta")
    if pwd_context.verify(payload.new_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="La nueva contraseña debe ser diferente")
    await db.admin_users.update_one(
        {"email": email},
        {"$set": {"password_hash": pwd_context.hash(payload.new_password), "password_updated_at": now_iso()}, "$inc": {"session_version": 1}},
    )
    await db.admin_sessions.update_many({"email": email, "revoked_at": {"$exists": False}}, {"$set": {"revoked_at": now_utc()}})
    await audit(email, "change_password", email)
    return {"ok": True, "reauthenticate": True}


@app.post("/api/admin/upload")
async def disabled_upload(file: UploadFile = File(...), category: str = "gallery", email: str = Depends(require_phase1_admin)):
    raise HTTPException(status_code=503, detail="La carga de fotografías está deshabilitada durante el lanzamiento gratuito. Las imágenes se publican desde GitHub.")


@app.get("/api/files/{path:path}")
async def disabled_legacy_files(path: str):
    raise HTTPException(status_code=410, detail="El almacenamiento anterior ya no está disponible")


async def migrate_and_index() -> None:
    current = await db.admin_users.find_one({"email": {"$regex": f"^{re.escape(legacy.ADMIN_EMAIL)}$", "$options": "i"}})
    if current:
        await db.admin_users.update_one(
            {"_id": current["_id"]},
            {"$set": {"email": legacy.ADMIN_EMAIL.lower(), "session_version": int(current.get("session_version", 1)), "active": True}},
        )
    await db.admin_users.update_many({"session_version": {"$exists": False}}, {"$set": {"session_version": 1, "active": True}})
    active = await db.bookings.find({"status": {"$in": list(ACTIVE_STATUSES)}}).to_list(5000)
    for booking in active:
        duration = int(booking.get("service_duration", 30)) + int(booking.get("service_buffer", 20))
        await db.bookings.update_one(
            {"_id": booking["_id"]},
            {"$set": {
                "phone_key": booking.get("phone_key") or re.sub(r"\D", "", booking.get("phone", "")),
                "service_buffer": int(booking.get("service_buffer", 20)),
                "blocks_calendar": True,
                "lock_keys": lock_keys(booking["date"], booking["time"], duration),
            }},
        )
    await db.bookings.update_many({"status": {"$nin": list(ACTIVE_STATUSES)}}, {"$set": {"blocks_calendar": False}})
    await db.admin_users.create_index("email", unique=True)
    await db.admin_sessions.create_index("jti", unique=True)
    await db.admin_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.rate_limits.create_index("expires_at", expireAfterSeconds=0)
    await db.clients.create_index("phone_key", unique=True)
    await db.bookings.create_index("id", unique=True)
    await db.bookings.create_index([("date", ASCENDING), ("status", ASCENDING)])
    try:
        await db.bookings.create_index(
            "lock_keys",
            unique=True,
            partialFilterExpression={"blocks_calendar": True},
            name="unique_active_booking_minutes",
        )
    except OperationFailure:
        if APP_ENV == "production":
            raise


@app.on_event("startup")
async def startup():
    await legacy.client.admin.command("ping")
    await legacy.seed()
    await migrate_and_index()


@app.on_event("shutdown")
async def shutdown():
    legacy.client.close()


app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
