# PRD — Miguel Suárez · Barbero a domicilio (App móvil Expo)

## Contexto
App móvil nativa (React Native + Expo + FastAPI + MongoDB) para **Miguel Ángel Suárez**, barbero profesional a domicilio en **Torreón, Coahuila**. Diseño editorial premium (Italiana serif + DM Sans), sin iconografía tradicional de barbería. La app funciona como sitio público + panel administrativo privado.

## Público objetivo
Caballeros, familias, hoteles, oficinas y grupos en Torreón que priorizan comodidad y calidad sobre precio bajo.

## Funcionalidades implementadas (MVP)

### App pública
- **Inicio**: Hero editorial con foto atmosférica, eslogan "Precisión y estilo, donde tú estés.", CTA a reservar + WhatsApp, tarjeta "storycard" con monograma M sobre Miguel, proceso de 5 pasos numerados, chips de zonas destacadas, tarjeta bronce para bodas/grupos, sección de reseñas con estado vacío, FAQ acordeón, footer oscuro con contacto y políticas.
- **Servicios**: Catálogo con 5 servicios (nombre, precio en MXN, duración, botones Reservar/WhatsApp), aviso de recargo de traslado, listado completo de zonas, galería con placeholders "Fotografía pendiente".
- **Reservar**: Flujo en 3 pasos (elige servicio → fecha/hora → datos + políticas). Solo muestra días habilitados (por defecto domingo, editable por admin). Slots dinámicos calculados en backend respetando duración + buffer 20 min + hora de cierre + aviso mínimo 60 min. Bloqueo por conflictos con reservas existentes. Confirmación con resumen y botón para confirmar por WhatsApp. Botón alterno para solicitar entre semana por WhatsApp.
- **Contacto**: WhatsApp (verde), Reservar, Llamar, SMS, Correo, Instagram/Facebook (placeholder), enlaces a Políticas, FAQ y Panel Admin.
- **Políticas**: Lista numerada editorial con contenido real de las reglas de reserva.
- **FAQ**: Acordeón con 10 preguntas iniciales; las respuestas marcadas como "pendiente de confirmación" muestran un badge bronce.

### Panel administrativo (`/admin/login` → `/admin/dashboard`)
Autenticación por email/contraseña con bcrypt + JWT (7 días). El usuario se siembra automáticamente al arrancar el backend.
- **Inicio**: Lista de reservas recibidas.
- **Servicios**: CRUD completo (nombre, precio, duración, buffer, orden, activo).
- **Zonas**: CRUD, destacar/ocultar, recargo opcional (o "confirmar por WhatsApp").
- **Preguntas**: CRUD, marcar como pendiente de confirmación.
- **Reseñas**: CRUD, permiso confirmado + visibilidad separados. No se muestran públicamente hasta tener permiso.
- **Ajustes**: Días abiertos (multi-selección), hora de apertura/cierre, aviso mínimo, intervalo de slots. Datos del negocio (nombre, eslogan, teléfono, WhatsApp, email, redes, URL Cal.com opcional).

## Enlaces de WhatsApp (con mensajes prellenados)
- Consulta general, entre semana, zona, grupo/boda, servicio específico, confirmación tras reservar.

## Reglas de negocio
- Precios y duraciones exactos según el prompt del usuario (400/280/550/600/300 MXN).
- Buffer operativo 20 min entre citas, no se muestra al cliente.
- Última hora de inicio calculada según duración del servicio y hora de cierre.
- No permite reservas que terminen después de la hora de cierre.
- Aviso mínimo 60 min por defecto (editable).
- Pago al finalizar (efectivo/transferencia). No hay pago en línea.
- No inventa reseñas, dirección física, ni cargos.

## Credenciales admin
- Email: `Suarezmaiky25@gmail.com`
- Contraseña temporal: `Miguel2026!` (Miguel puede cambiarla vía backend/env después)
- Guardado en `/app/memory/test_credentials.md`

## Datos pendientes (marcados en la app o el prompt)
- Enlace Cal.com (URL editable en admin → Ajustes)
- Perfiles reales de Instagram/Facebook
- Fotografías reales para hero, sobre Miguel, y galería
- Reseñas reales autorizadas
- Respuestas definitivas para "¿Realiza desvanecidos desde cero?" y "¿La barba se trabaja con navaja?"

## Stack técnico
- Frontend: Expo Router (file-based routing), React Native, expo-font (Italiana + DM Sans via Google Fonts URLs), expo-image, expo-linear-gradient, Feather icons, AsyncStorage.
- Backend: FastAPI, Motor (MongoDB async), Pydantic v2, PyJWT, passlib+bcrypt.
- Base de datos: MongoDB (colecciones: services, zones, faqs, testimonials, policies, bookings, site_settings, booking_settings, admin_users, admin_audit).

## Cómo probar
1. Abrir la app → tab "Reservar" → elegir "Corte de cabello" → seleccionar próximo domingo → elegir horario → completar datos → aceptar políticas → Confirmar.
2. Pulsar el ícono de usuario (esquina superior derecha en Inicio) o Contacto → "Panel administrativo" → iniciar sesión con credenciales de arriba.
3. En Ajustes, activar más días para permitir reservas entre lunes-sábado también.
