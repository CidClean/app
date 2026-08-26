from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, UploadFile, File, Response
from fastapi.security import HTTPBearer
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import jwt
import requests
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta, date, time
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
ADMIN_EMAIL = os.environ['ADMIN_EMAIL']
ADMIN_INITIAL_PASSWORD = os.environ['ADMIN_INITIAL_PASSWORD']
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "miguel-suarez-barber"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI(title="Miguel Suarez API")
api = APIRouter(prefix="/api")

# ---------- Utils ----------

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def make_token(email: str) -> str:
    payload = {
        "sub": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def require_admin(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="No autorizado")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="No autorizado")
    email = payload.get("sub")
    user = await db.admin_users.find_one({"email": email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="No autorizado")
    return email

# ---------- Models ----------

class Service(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str
    short_description: str = ""
    full_description: str = ""
    price: int
    currency: str = "MXN"
    duration_minutes: int
    buffer_minutes: int = 20
    active: bool = True
    display_order: int = 0

class ServiceInput(BaseModel):
    name: str
    slug: Optional[str] = None
    short_description: str = ""
    full_description: str = ""
    price: int
    duration_minutes: int
    buffer_minutes: int = 20
    active: bool = True
    display_order: int = 0

class Zone(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    neighborhood: str
    featured: bool = False
    surcharge_amount: Optional[int] = None
    surcharge_status: str = "confirm_by_whatsapp"  # or "included" / "fixed"
    message: str = ""
    active: bool = True
    display_order: int = 0

class ZoneInput(BaseModel):
    neighborhood: str
    featured: bool = False
    surcharge_amount: Optional[int] = None
    surcharge_status: str = "confirm_by_whatsapp"
    message: str = ""
    active: bool = True
    display_order: int = 0

class Faq(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    question: str
    answer: str
    category: str = "general"
    pending_confirmation: bool = False
    active: bool = True
    display_order: int = 0

class FaqInput(BaseModel):
    question: str
    answer: str
    category: str = "general"
    pending_confirmation: bool = False
    active: bool = True
    display_order: int = 0

class Testimonial(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    display_name: str
    service_name: str = ""
    content: str
    permission_confirmed: bool = False
    active: bool = True
    display_order: int = 0

class TestimonialInput(BaseModel):
    display_name: str
    service_name: str = ""
    content: str
    permission_confirmed: bool = False
    active: bool = True
    display_order: int = 0

class BookingSettings(BaseModel):
    open_days: List[int] = [0]  # 0=Sunday ... 6=Saturday (Python weekday: Mon=0..Sun=6; we'll use ISO Sun=0..Sat=6? we'll use JS: Sun=0..Sat=6)
    open_hour: int = 11  # 11:00
    close_hour: int = 18  # 18:00 (last end)
    min_notice_minutes: int = 60
    slot_step_minutes: int = 15

class BookingSettingsInput(BaseModel):
    open_days: Optional[List[int]] = None
    open_hour: Optional[int] = None
    close_hour: Optional[int] = None
    min_notice_minutes: Optional[int] = None
    slot_step_minutes: Optional[int] = None

class Booking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    service_id: str
    service_name: str
    service_duration: int
    service_price: int
    date: str  # YYYY-MM-DD
    time: str  # HH:MM (24h, service start)
    name: str
    phone: str
    address: str
    neighborhood: str
    note: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accepted_policies: bool
    status: str = "pending_confirmation"
    created_at: str = Field(default_factory=now_iso)

class BookingInput(BaseModel):
    service_id: str
    date: str
    time: str
    name: str
    phone: str
    address: str
    neighborhood: str
    note: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accepted_policies: bool

class ContentBlock(BaseModel):
    section_key: str
    eyebrow: str = ""
    title: str = ""
    content: str = ""
    cta_label: str = ""
    cta_url: str = ""

class SiteSettings(BaseModel):
    business_name: str = "Miguel Suárez"
    full_name: str = "Miguel Ángel Suárez"
    descriptor: str = "Barbero profesional a domicilio"
    slogan: str = "Precisión y estilo, donde tú estés."
    phone: str = "+52 871 463 3372"
    whatsapp: str = "528714633372"
    email: str = "Suarezmaiky25@gmail.com"
    city: str = "Torreón, Coahuila"
    instagram: str = ""
    facebook: str = ""
    booking_url: str = ""  # future Cal.com URL
    hero_image_url: str = ""
    about_image_url: str = ""

class SiteSettingsInput(BaseModel):
    business_name: Optional[str] = None
    full_name: Optional[str] = None
    descriptor: Optional[str] = None
    slogan: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    instagram: Optional[str] = None
    facebook: Optional[str] = None
    booking_url: Optional[str] = None
    hero_image_url: Optional[str] = None
    about_image_url: Optional[str] = None

class LoginInput(BaseModel):
    email: EmailStr
    password: str

# ---------- Seed ----------

DEFAULT_SERVICES = [
    {"name": "Corte de cabello", "slug": "corte", "short_description": "Corte personalizado a tijera, máquina o técnica combinada.", "full_description": "Corte personalizado realizado a tijera, máquina o técnica combinada, de acuerdo con el estilo, cabello y resultado deseado.", "price": 400, "duration_minutes": 40, "display_order": 1},
    {"name": "Barba", "slug": "barba", "short_description": "Perfilado, definición y arreglo de barba.", "full_description": "Perfilado, definición y arreglo de barba con atención a las proporciones del rostro y al estilo del cliente.", "price": 280, "duration_minutes": 30, "display_order": 2},
    {"name": "Corte y barba", "slug": "corte-barba", "short_description": "Servicio integral de corte y arreglo de barba.", "full_description": "Servicio integral de corte y arreglo de barba para lograr una imagen equilibrada y coherente.", "price": 550, "duration_minutes": 70, "display_order": 3},
    {"name": "Corte, barba y limpieza facial", "slug": "corte-barba-facial", "short_description": "Experiencia completa: corte, barba y cuidado facial.", "full_description": "Experiencia completa que combina corte, arreglo de barba y cuidado básico de la piel facial.", "price": 600, "duration_minutes": 90, "display_order": 4},
    {"name": "Corte de niño", "slug": "corte-nino", "short_description": "Corte infantil a domicilio con atención paciente.", "full_description": "Corte infantil a domicilio con atención paciente, profesional y adaptada al niño.", "price": 300, "duration_minutes": 40, "display_order": 5},
]

DEFAULT_ZONES = [
    {"neighborhood": "Viñedos", "featured": True, "display_order": 1},
    {"neighborhood": "Senderos", "featured": True, "display_order": 2},
    {"neighborhood": "Las Villas", "featured": True, "display_order": 3},
    {"neighborhood": "San Isidro", "featured": True, "display_order": 4},
]

DEFAULT_FAQS = [
    {"question": "¿Trabaja cortes completamente a tijera?", "answer": "Miguel cuenta con experiencia en cortes a tijera y puede recomendar la técnica adecuada según el estilo, tipo de cabello y resultado deseado.", "display_order": 1},
    {"question": "¿Cuál es el costo del servicio?", "answer": "Los precios se muestran públicamente en la sección de servicios. Puede aplicar un recargo de traslado dependiendo de la colonia o ubicación.", "display_order": 2},
    {"question": "¿Realiza desvanecidos desde cero?", "answer": "Información pendiente de confirmación por Miguel.", "pending_confirmation": True, "display_order": 3},
    {"question": "¿La barba se trabaja con navaja?", "answer": "Información pendiente de confirmación por Miguel.", "pending_confirmation": True, "display_order": 4},
    {"question": "¿El servicio es únicamente a domicilio?", "answer": "Sí. Miguel se desplaza hasta la residencia, hotel, oficina o ubicación acordada dentro de Torreón.", "display_order": 5},
    {"question": "¿Puedo reservar para el mismo día?", "answer": "Sí, siempre que exista disponibilidad y se respete el aviso mínimo configurado (60 minutos).", "display_order": 6},
    {"question": "¿Cómo se realiza el pago?", "answer": "Al terminar el servicio, mediante efectivo o transferencia.", "display_order": 7},
    {"question": "¿Puedo reservar entre semana?", "answer": "Sí. Los horarios entre semana se solicitan directamente por WhatsApp y están sujetos a confirmación.", "display_order": 8},
    {"question": "¿Se atienden bodas o grupos?", "answer": "Sí. Los servicios para varias personas se cotizan de forma personalizada.", "display_order": 9},
    {"question": "¿Puede aplicar un recargo por traslado?", "answer": "Sí. Dependiendo de la colonia o ubicación, Miguel puede confirmar un recargo antes de la cita.", "display_order": 10},
]

DEFAULT_POLICIES = [
    "La reserva corresponde a una ubicación específica dentro de Torreón.",
    "Miguel podrá confirmar la dirección, acceso, estacionamiento y posible recargo antes de desplazarse.",
    "El cliente debe informar cualquier cambio de dirección o servicio antes de la cita.",
    "Los retrasos pueden reducir el tiempo disponible o requerir una reprogramación para no afectar la siguiente cita.",
    "Después de tres cancelaciones consecutivas o retrasos relevantes, Miguel podrá advertir al cliente.",
    "Después de la advertencia, Miguel podrá rechazar o bloquear manualmente nuevas solicitudes.",
    "El pago se realiza al concluir el servicio.",
    "Los métodos aceptados son efectivo y transferencia.",
    "El resultado puede variar según el tipo, estado y longitud del cabello o la barba.",
    "Una fotografía de referencia no garantiza una réplica exacta.",
    "La reserva puede requerir una confirmación adicional de la ubicación y el traslado.",
]

async def seed():
    if await db.services.count_documents({}) == 0:
        for s in DEFAULT_SERVICES:
            svc = Service(**s)
            await db.services.insert_one(svc.model_dump())
    if await db.zones.count_documents({}) == 0:
        for z in DEFAULT_ZONES:
            zn = Zone(**z)
            await db.zones.insert_one(zn.model_dump())
    if await db.faqs.count_documents({}) == 0:
        for f in DEFAULT_FAQS:
            fq = Faq(**f)
            await db.faqs.insert_one(fq.model_dump())
    if await db.policies.count_documents({}) == 0:
        for i, p in enumerate(DEFAULT_POLICIES):
            await db.policies.insert_one({"id": str(uuid.uuid4()), "content": p, "display_order": i + 1, "active": True})
    if not await db.site_settings.find_one({}):
        await db.site_settings.insert_one(SiteSettings().model_dump())
    if not await db.booking_settings.find_one({}):
        await db.booking_settings.insert_one(BookingSettings().model_dump())
    if not await db.admin_users.find_one({"email": ADMIN_EMAIL}):
        await db.admin_users.insert_one({
            "email": ADMIN_EMAIL,
            "password_hash": pwd_context.hash(ADMIN_INITIAL_PASSWORD),
            "created_at": now_iso(),
        })

@app.on_event("startup")
async def on_startup():
    await seed()
    # Try to warm up storage key (non-fatal)
    if EMERGENT_LLM_KEY:
        try:
            await run_in_threadpool(_init_storage_sync)
        except Exception as e:
            logging.warning(f"Storage init warmup failed (will retry on first upload): {e}")

# ---------- Public endpoints ----------

@api.get("/")
async def root():
    return {"ok": True, "name": "Miguel Suárez API"}

@api.get("/site-settings")
async def get_site_settings():
    s = await db.site_settings.find_one({}, {"_id": 0})
    return s or SiteSettings().model_dump()

@api.get("/services")
async def list_services(all: bool = False):
    q = {} if all else {"active": True}
    items = await db.services.find(q, {"_id": 0}).sort("display_order", 1).to_list(500)
    return items

@api.get("/zones")
async def list_zones(all: bool = False):
    q = {} if all else {"active": True}
    items = await db.zones.find(q, {"_id": 0}).sort("display_order", 1).to_list(500)
    return items

@api.get("/faqs")
async def list_faqs(all: bool = False):
    q = {} if all else {"active": True}
    items = await db.faqs.find(q, {"_id": 0}).sort("display_order", 1).to_list(500)
    return items

@api.get("/testimonials")
async def list_testimonials(all: bool = False):
    q = {} if all else {"active": True, "permission_confirmed": True}
    items = await db.testimonials.find(q, {"_id": 0}).sort("display_order", 1).to_list(500)
    return items

@api.get("/policies")
async def list_policies():
    items = await db.policies.find({"active": True}, {"_id": 0}).sort("display_order", 1).to_list(500)
    return items

@api.get("/booking-settings")
async def get_booking_settings():
    s = await db.booking_settings.find_one({}, {"_id": 0})
    return s or BookingSettings().model_dump()

@api.get("/available-slots")
async def available_slots(service_id: str, date_str: str):
    """Return available slot start times (HH:MM) for a given service on a given date (YYYY-MM-DD)."""
    service = await db.services.find_one({"id": service_id, "active": True}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    settings = await db.booking_settings.find_one({}, {"_id": 0}) or BookingSettings().model_dump()
    try:
        target = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Fecha inválida")
    # JS weekday: Sun=0..Sat=6
    py_wd = target.weekday()  # Mon=0..Sun=6
    js_wd = (py_wd + 1) % 7  # Sun=0
    if js_wd not in settings["open_days"]:
        return {"date": date_str, "slots": [], "reason": "closed"}
    now = datetime.now(timezone.utc) - timedelta(hours=6)  # UTC-6 (Torreón, CST)
    min_start_dt = now + timedelta(minutes=settings["min_notice_minutes"])
    duration = service["duration_minutes"]
    buffer_m = service.get("buffer_minutes", 20)
    step = settings["slot_step_minutes"]
    open_h = settings["open_hour"]
    close_h = settings["close_hour"]  # last END hour
    # existing bookings for that date
    existing = await db.bookings.find({"date": date_str, "status": {"$ne": "cancelled"}}, {"_id": 0}).to_list(500)
    busy_ranges = []
    for b in existing:
        b_svc = await db.services.find_one({"id": b["service_id"]}, {"_id": 0})
        b_dur = b_svc["duration_minutes"] if b_svc else b.get("service_duration", 30)
        b_buf = b_svc.get("buffer_minutes", 20) if b_svc else 20
        h, m = map(int, b["time"].split(":"))
        start = datetime.combine(target, time(h, m))
        end = start + timedelta(minutes=b_dur + b_buf)
        busy_ranges.append((start, end))
    slots: List[str] = []
    cur = datetime.combine(target, time(open_h, 0))
    last_start_limit = datetime.combine(target, time(close_h, 0)) - timedelta(minutes=duration)
    while cur <= last_start_limit:
        cand_start = cur
        cand_end = cur + timedelta(minutes=duration + buffer_m)
        # Only allow if candidate start is after min_start_dt
        if cand_start >= min_start_dt.replace(tzinfo=None):
            conflict = False
            for (bs, be) in busy_ranges:
                if not (cand_end <= bs or cand_start >= be):
                    conflict = True
                    break
            if not conflict:
                slots.append(cand_start.strftime("%H:%M"))
        cur = cur + timedelta(minutes=step)
    return {"date": date_str, "slots": slots}

@api.post("/bookings")
async def create_booking(payload: BookingInput):
    if not payload.accepted_policies:
        raise HTTPException(status_code=400, detail="Debes aceptar las políticas y el aviso de privacidad")
    service = await db.services.find_one({"id": payload.service_id, "active": True}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    settings = await db.booking_settings.find_one({}, {"_id": 0}) or BookingSettings().model_dump()
    try:
        target = datetime.strptime(payload.date, "%Y-%m-%d").date()
        h, m = map(int, payload.time.split(":"))
        start = datetime.combine(target, time(h, m))
    except Exception:
        raise HTTPException(status_code=400, detail="Fecha u hora inválida")
    js_wd = (target.weekday() + 1) % 7
    if js_wd not in settings["open_days"]:
        raise HTTPException(status_code=400, detail="Ese día no está habilitado para reservas")
    end = start + timedelta(minutes=service["duration_minutes"])
    if end.hour > settings["close_hour"] or (end.hour == settings["close_hour"] and end.minute > 0):
        raise HTTPException(status_code=400, detail="El servicio no puede terminar después del horario de cierre")
    now_local = datetime.now(timezone.utc) - timedelta(hours=6)
    if start < (now_local.replace(tzinfo=None) + timedelta(minutes=settings["min_notice_minutes"])):
        raise HTTPException(status_code=400, detail="No hay suficiente anticipación para esa hora")
    # Conflict check
    existing = await db.bookings.find({"date": payload.date, "status": {"$ne": "cancelled"}}, {"_id": 0}).to_list(500)
    cand_end = start + timedelta(minutes=service["duration_minutes"] + service.get("buffer_minutes", 20))
    for b in existing:
        bh, bm = map(int, b["time"].split(":"))
        bs = datetime.combine(target, time(bh, bm))
        b_svc = await db.services.find_one({"id": b["service_id"]}, {"_id": 0})
        b_dur = b_svc["duration_minutes"] if b_svc else b.get("service_duration", 30)
        b_buf = b_svc.get("buffer_minutes", 20) if b_svc else 20
        be = bs + timedelta(minutes=b_dur + b_buf)
        if not (cand_end <= bs or start >= be):
            raise HTTPException(status_code=409, detail="Ese horario ya no está disponible")
    booking = Booking(
        service_id=service["id"],
        service_name=service["name"],
        service_duration=service["duration_minutes"],
        service_price=service["price"],
        date=payload.date,
        time=payload.time,
        name=payload.name.strip(),
        phone=payload.phone.strip(),
        address=payload.address.strip(),
        neighborhood=payload.neighborhood.strip(),
        note=payload.note.strip(),
        latitude=payload.latitude,
        longitude=payload.longitude,
        accepted_policies=True,
    )
    await db.bookings.insert_one(booking.model_dump())
    return {
        "ok": True,
        "booking": booking.model_dump(),
        "message": "Tu horario ha sido registrado. Miguel podrá contactarte por WhatsApp para confirmar la ubicación, acceso y cualquier recargo de traslado aplicable.",
    }

# ---------- Admin auth ----------

@api.post("/admin/login")
async def admin_login(payload: LoginInput):
    user = await db.admin_users.find_one({"email": payload.email}, {"_id": 0})
    if not user or not pwd_context.verify(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    token = make_token(user["email"])
    return {"token": token, "email": user["email"]}

@api.get("/admin/me")
async def admin_me(email: str = Depends(require_admin)):
    return {"email": email}

# ---------- Admin resources ----------

def _slugify(s: str) -> str:
    return "".join(c.lower() if c.isalnum() else "-" for c in s).strip("-")

@api.post("/admin/services")
async def create_service(payload: ServiceInput, email: str = Depends(require_admin)):
    data = payload.model_dump()
    data["slug"] = payload.slug or _slugify(payload.name)
    svc = Service(**data)
    await db.services.insert_one(svc.model_dump())
    await db.admin_audit.insert_one({"id": str(uuid.uuid4()), "user_email": email, "action": "create", "entity_type": "service", "entity_id": svc.id, "summary": svc.name, "created_at": now_iso()})
    return svc.model_dump()

@api.put("/admin/services/{sid}")
async def update_service(sid: str, payload: ServiceInput, email: str = Depends(require_admin)):
    upd = payload.model_dump()
    if not upd.get("slug"):
        upd["slug"] = _slugify(payload.name)
    r = await db.services.update_one({"id": sid}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    await db.admin_audit.insert_one({"id": str(uuid.uuid4()), "user_email": email, "action": "update", "entity_type": "service", "entity_id": sid, "summary": payload.name, "created_at": now_iso()})
    return {"ok": True}

@api.delete("/admin/services/{sid}")
async def delete_service(sid: str, email: str = Depends(require_admin)):
    r = await db.services.delete_one({"id": sid})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    await db.admin_audit.insert_one({"id": str(uuid.uuid4()), "user_email": email, "action": "delete", "entity_type": "service", "entity_id": sid, "summary": "", "created_at": now_iso()})
    return {"ok": True}

@api.post("/admin/zones")
async def create_zone(payload: ZoneInput, email: str = Depends(require_admin)):
    zn = Zone(**payload.model_dump())
    await db.zones.insert_one(zn.model_dump())
    return zn.model_dump()

@api.put("/admin/zones/{zid}")
async def update_zone(zid: str, payload: ZoneInput, email: str = Depends(require_admin)):
    r = await db.zones.update_one({"id": zid}, {"$set": payload.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Zona no encontrada")
    return {"ok": True}

@api.delete("/admin/zones/{zid}")
async def delete_zone(zid: str, email: str = Depends(require_admin)):
    await db.zones.delete_one({"id": zid})
    return {"ok": True}

@api.post("/admin/faqs")
async def create_faq(payload: FaqInput, email: str = Depends(require_admin)):
    fq = Faq(**payload.model_dump())
    await db.faqs.insert_one(fq.model_dump())
    return fq.model_dump()

@api.put("/admin/faqs/{fid}")
async def update_faq(fid: str, payload: FaqInput, email: str = Depends(require_admin)):
    r = await db.faqs.update_one({"id": fid}, {"$set": payload.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
    return {"ok": True}

@api.delete("/admin/faqs/{fid}")
async def delete_faq(fid: str, email: str = Depends(require_admin)):
    await db.faqs.delete_one({"id": fid})
    return {"ok": True}

@api.post("/admin/testimonials")
async def create_testimonial(payload: TestimonialInput, email: str = Depends(require_admin)):
    t = Testimonial(**payload.model_dump())
    await db.testimonials.insert_one(t.model_dump())
    return t.model_dump()

@api.put("/admin/testimonials/{tid}")
async def update_testimonial(tid: str, payload: TestimonialInput, email: str = Depends(require_admin)):
    r = await db.testimonials.update_one({"id": tid}, {"$set": payload.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reseña no encontrada")
    return {"ok": True}

@api.delete("/admin/testimonials/{tid}")
async def delete_testimonial(tid: str, email: str = Depends(require_admin)):
    await db.testimonials.delete_one({"id": tid})
    return {"ok": True}

@api.get("/admin/testimonials")
async def admin_list_testimonials(email: str = Depends(require_admin)):
    return await db.testimonials.find({}, {"_id": 0}).sort("display_order", 1).to_list(500)

@api.get("/admin/bookings")
async def admin_list_bookings(email: str = Depends(require_admin)):
    items = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api.put("/admin/site-settings")
async def update_site_settings(payload: SiteSettingsInput, email: str = Depends(require_admin)):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if upd:
        current = await db.site_settings.find_one({})
        if current:
            await db.site_settings.update_one({}, {"$set": upd})
        else:
            merged = SiteSettings().model_dump()
            merged.update(upd)
            await db.site_settings.insert_one(merged)
    s = await db.site_settings.find_one({}, {"_id": 0})
    return s

@api.put("/admin/booking-settings")
async def update_booking_settings(payload: BookingSettingsInput, email: str = Depends(require_admin)):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if upd:
        current = await db.booking_settings.find_one({})
        if current:
            await db.booking_settings.update_one({}, {"$set": upd})
        else:
            merged = BookingSettings().model_dump()
            merged.update(upd)
            await db.booking_settings.insert_one(merged)
    s = await db.booking_settings.find_one({}, {"_id": 0})
    return s

# ---------- Change password ----------

class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str

@api.post("/admin/change-password")
async def change_password(payload: ChangePasswordInput, email: str = Depends(require_admin)):
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="La nueva contraseña debe tener al menos 8 caracteres")
    user = await db.admin_users.find_one({"email": email}, {"_id": 0})
    if not user or not pwd_context.verify(payload.current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Contraseña actual incorrecta")
    new_hash = pwd_context.hash(payload.new_password)
    await db.admin_users.update_one({"email": email}, {"$set": {"password_hash": new_hash, "password_updated_at": now_iso()}})
    await db.admin_audit.insert_one({"id": str(uuid.uuid4()), "user_email": email, "action": "change_password", "entity_type": "admin_user", "entity_id": email, "summary": "", "created_at": now_iso()})
    return {"ok": True}

# ---------- Object storage ----------

_storage_key: Optional[str] = None

def _init_storage_sync() -> str:
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="Storage not configured")
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Storage init failed: {resp.status_code}")
    _storage_key = resp.json()["storage_key"]
    return _storage_key

def _put_object_sync(path: str, data: bytes, content_type: str, retry: bool = True) -> dict:
    global _storage_key
    key = _init_storage_sync()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code == 503 and retry:
        _storage_key = None
        return _put_object_sync(path, data, content_type, retry=False)
    if resp.status_code == 402:
        raise HTTPException(status_code=402, detail="Sin créditos para subir archivos")
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Storage put failed: {resp.status_code}")
    return resp.json()

def _get_object_sync(path: str) -> tuple[bytes, str]:
    key = _init_storage_sync()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    if resp.status_code >= 400:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

@api.post("/admin/upload")
async def upload_media(
    file: UploadFile = File(...),
    category: str = "gallery",
    email: str = Depends(require_admin),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes")
    contents = await file.read()
    if len(contents) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Imagen demasiado grande (máx 8 MB)")
    ext = (file.filename or "img").split(".")[-1].lower() if "." in (file.filename or "") else "jpg"
    if ext not in ("jpg", "jpeg", "png", "webp", "heic"):
        ext = "jpg"
    file_uuid = str(uuid.uuid4())
    path = f"{APP_NAME}/uploads/admin/{file_uuid}.{ext}"
    await run_in_threadpool(_put_object_sync, path, contents, file.content_type)
    media_id = str(uuid.uuid4())
    doc = {
        "id": media_id,
        "storage_path": path,
        "file_url": f"/api/files/{path}",
        "content_type": file.content_type,
        "size": len(contents),
        "category": category,
        "alt_text": "",
        "active": True,
        "display_order": 0,
        "created_at": now_iso(),
        "uploaded_by": email,
    }
    await db.media.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc

@api.get("/files/{path:path}")
async def get_file(path: str):
    content, ct = await run_in_threadpool(_get_object_sync, path)
    return Response(content=content, media_type=ct, headers={"Cache-Control": "public, max-age=31536000"})

@api.get("/media")
async def list_media(category: Optional[str] = None):
    q: Dict[str, Any] = {"active": True}
    if category:
        q["category"] = category
    items = await db.media.find(q, {"_id": 0}).sort([("display_order", 1), ("created_at", -1)]).to_list(500)
    return items

@api.get("/admin/media")
async def admin_list_media(email: str = Depends(require_admin)):
    items = await db.media.find({}, {"_id": 0}).sort([("display_order", 1), ("created_at", -1)]).to_list(500)
    return items

class MediaUpdateInput(BaseModel):
    alt_text: Optional[str] = None
    category: Optional[str] = None
    active: Optional[bool] = None
    display_order: Optional[int] = None

@api.put("/admin/media/{mid}")
async def update_media(mid: str, payload: MediaUpdateInput, email: str = Depends(require_admin)):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not upd:
        return {"ok": True}
    r = await db.media.update_one({"id": mid}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Media no encontrada")
    return {"ok": True}

@api.delete("/admin/media/{mid}")
async def delete_media(mid: str, email: str = Depends(require_admin)):
    # Soft-delete: mark inactive (storage API has no delete)
    r = await db.media.update_one({"id": mid}, {"$set": {"active": False}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Media no encontrada")
    return {"ok": True}

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
