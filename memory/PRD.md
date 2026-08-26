# PRD — Miguel Suárez · Barbero a domicilio (App móvil Expo)

## Contexto
App móvil nativa (React Native + Expo + FastAPI + MongoDB) para **Miguel Ángel Suárez**, barbero profesional a domicilio en **Torreón, Coahuila**. Diseño editorial premium (Italiana serif + DM Sans), sin iconografía tradicional de barbería. La app funciona como sitio público + panel administrativo privado.

## Funcionalidades implementadas

### App pública
- **Inicio**: Hero editorial con foto atmosférica (reemplazable desde el panel), CTA a reservar + WhatsApp, storycard con monograma "M" sobre Miguel, proceso 5 pasos numerados, chips de zonas destacadas, tarjeta bronce para bodas/grupos, sección de reseñas con estado vacío, FAQ acordeón, footer oscuro.
- **Servicios**: Catálogo con 5 servicios y precios en MXN, botones Reservar/WhatsApp, aviso de recargo, listado completo de zonas, **galería con fotos reales cuando Miguel las suba** (placeholders elegantes mientras tanto).
- **Reservar**: Flujo en 3 pasos. En el paso 3, **mini-mapa integrado (LocationPicker)** para marcar la ubicación exacta:
  - iOS/Android: mapa nativo con react-native-maps + expo-location. El cliente toca el mapa para poner un pin, o pulsa "Usar mi ubicación" con permisos progresivos (respeta canAskAgain).
  - Web: iframe embebido con Google Maps + geolocation API del navegador.
  - El pin (lat/lng) se envía al backend y aparece en el mensaje de WhatsApp de confirmación como enlace clickeable a Google Maps.
- **Contacto**: WhatsApp verde, reservar, llamar, SMS, correo, Instagram/Facebook (placeholders), políticas, FAQ, panel admin.
- **Políticas / FAQ**: pantallas dedicadas con contenido editable.

### Panel administrativo (`/admin`)
Autenticación bcrypt + JWT (7 días). Tabs:
- **Inicio**: Lista de reservas recientes (incluye pin de ubicación si el cliente lo compartió).
- **Servicios / Zonas / Preguntas / Reseñas**: CRUD completo con activar/desactivar y ordenar.
- **Fotos** (NUEVO): Sube fotografías desde la galería o cámara del teléfono usando expo-image-picker. Categorías: Galería, Hero, Miguel. Cada foto puede marcarse como imagen principal del hero, retrato de Miguel, ocultarse o eliminarse. Almacenamiento en la nube via **Emergent Managed Object Storage** (imágenes ≤ 8 MB, JPG/PNG/WebP/HEIC).
- **Ajustes**: Días abiertos (multi-selección), hora de apertura/cierre, aviso mínimo, intervalo de slots. Datos del negocio (nombre, eslogan, teléfono, WhatsApp, email, redes, URL Cal.com).
- **Cuenta** (NUEVO): Cambiar la contraseña del admin sin tocar código. Requiere contraseña actual + confirmación de la nueva (mínimo 8 caracteres).

## Reglas de negocio
- Precios y duraciones exactos: Corte 400/40, Barba 280/30, Corte+Barba 550/70, Corte+Barba+Facial 600/90, Corte Niño 300/40 (MXN).
- Buffer operativo 20 min entre citas (no se cobra al cliente).
- Última hora de inicio calculada según duración del servicio y hora de cierre.
- Aviso mínimo 60 min por defecto (editable).
- Pago al finalizar (efectivo/transferencia). No hay pago en línea.
- No inventa reseñas, dirección física ni cargos.

## Credenciales admin
- Email: `Suarezmaiky25@gmail.com`
- Contraseña temporal: `Miguel2026!` (Miguel puede cambiarla desde el panel → tab **Cuenta**)
- Guardado en `/app/memory/test_credentials.md`

## Datos pendientes
- Enlace Cal.com (URL editable en admin → Ajustes)
- Perfiles reales de Instagram/Facebook
- Reseñas reales autorizadas
- Respuestas definitivas para "¿Realiza desvanecidos desde cero?" y "¿La barba se trabaja con navaja?" (marcadas como pendientes en la app)

## Stack técnico
- Frontend: Expo Router, React Native, expo-font (Italiana + DM Sans), expo-image, expo-linear-gradient, expo-image-picker, expo-location, react-native-maps (con fallback web via iframe), Feather icons, AsyncStorage.
- Backend: FastAPI, Motor (MongoDB async), Pydantic v2, PyJWT, passlib+bcrypt, Emergent Object Storage (integración managed via INTEGRATION_PROXY_URL + EMERGENT_LLM_KEY).
- Colecciones MongoDB: services, zones, faqs, testimonials, policies, bookings, site_settings, booking_settings, admin_users, admin_audit, media.

## Endpoints nuevos
- `POST /api/admin/change-password` — cambia contraseña con verificación.
- `POST /api/admin/upload?category=…` — sube imagen multipart al Object Storage.
- `GET /api/files/{path}` — descarga bytes de la imagen para renderizar.
- `GET /api/media?category=…` — lista pública de fotos activas.
- `GET/PUT/DELETE /api/admin/media[/{id}]` — administración de fotos.

## Testing
- **Backend**: 31/31 tests pasando (booking rules, admin auth, media upload lifecycle, change-password, site-settings, booking lat/lng).
- **Frontend**: verificado manualmente en preview web — home renderiza, admin dashboard con las nuevas tabs Cuenta y Fotos, flujo de reserva con LocationPicker renderiza correctamente en web.
