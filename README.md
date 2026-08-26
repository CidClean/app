# Miguel Suárez — Barbería a domicilio

Aplicación web y móvil para presentar los servicios de Miguel Suárez y gestionar solicitudes de reserva en Torreón, Coahuila.

## Arquitectura de lanzamiento

- **Frontend web:** Expo Router exportado como sitio estático en Cloudflare Pages.
- **API:** FastAPI en Render Free.
- **Base de datos:** MongoDB Atlas Free.
- **Código:** GitHub.
- **Fotografías iniciales:** assets incluidos en el frontend.

El proyecto no requiere servicios, claves ni almacenamiento de Emergent para producción.

## Backend de producción

El punto de entrada de producción es:

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

`backend/server.py` se conserva temporalmente como capa de compatibilidad para los CRUD existentes. `backend/main.py` reemplaza las áreas críticas:

- sesiones administrativas revocables;
- limitación de intentos de login y reservas;
- CORS limitado a orígenes configurados;
- aviso y registro de consentimiento de privacidad;
- bloqueo atómico de minutos ocupados para evitar reservas simultáneas;
- estados de reserva y reglas de transición;
- reprogramación protegida contra conflictos;
- desactivación del almacenamiento heredado.

## Variables de entorno

Copia los ejemplos sin incluir valores reales en GitHub:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

En producción se requiere:

- `APP_ENV=production`
- `MONGO_URL`
- `DB_NAME`
- `JWT_SECRET` con al menos 32 caracteres aleatorios
- `ADMIN_EMAIL`
- `ADMIN_INITIAL_PASSWORD` con al menos 12 caracteres
- `CORS_ORIGINS` con el dominio exacto de Cloudflare Pages
- `APP_TIMEZONE=America/Monterrey`

## Desarrollo local

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
yarn install
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000 yarn web
```

## Pruebas

Las pruebas de `backend/tests/` son pruebas de integración. Necesitan:

- una API ejecutándose con `main:app`;
- una base MongoDB de pruebas;
- `EXPO_PUBLIC_BACKEND_URL` o `EXPO_BACKEND_URL`;
- `TEST_ADMIN_EMAIL` y `TEST_ADMIN_PASSWORD` como variables locales.

Ejecución:

```bash
cd backend
pytest -q
```

No deben usarse datos ni credenciales de producción para ejecutar la suite.

## Flujo de trabajo

- `main`: producción estable.
- ramas `codex/*`: implementación y revisión.
- cada cambio se valida mediante pull request antes de fusionarse.
- nunca se guardan archivos `.env`, contraseñas ni cadenas de conexión en el repositorio.
