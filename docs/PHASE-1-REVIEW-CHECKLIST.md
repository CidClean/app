# Checklist de revisión — Fase 1

## Backend

- [ ] `GET /api/health` responde con conexión a MongoDB.
- [ ] El login devuelve un token con expiración.
- [ ] Logout invalida el token actual.
- [ ] Cinco intentos fallidos activan temporalmente el límite.
- [ ] Cambiar contraseña revoca todas las sesiones activas.
- [ ] Las rutas administrativas sin token devuelven 401.
- [ ] `CORS_ORIGINS` no contiene `*` en producción.

## Reservas

- [ ] El cliente debe aceptar políticas y privacidad.
- [ ] Una reserva nueva queda en `pending_confirmation`.
- [ ] Dos solicitudes simultáneas no pueden ocupar minutos solapados.
- [ ] Cancelar libera el horario.
- [ ] Confirmar permite posteriormente completar, cancelar o marcar no-show.
- [ ] Una transición inválida devuelve 409.
- [ ] Reprogramar valida horario, anticipación y conflictos.

## Frontend

- [ ] El aviso de privacidad se carga en Políticas y privacidad.
- [ ] El login abre `/admin/reservas`.
- [ ] Confirmar, cancelar, completar y no-show actualizan la lista.
- [ ] Reprogramar muestra errores legibles.
- [ ] El logout elimina el token local.
- [ ] El token usa SecureStore en móvil y sessionStorage en web.

## Datos y seguridad

- [ ] No existen archivos `.env` versionados.
- [ ] No existen contraseñas reales en el diff.
- [ ] MongoDB usa un usuario exclusivo para esta aplicación.
- [ ] El clúster no permite acceso global permanente después de configurar Render.
- [ ] `JWT_SECRET` tiene al menos 32 caracteres aleatorios.
- [ ] La contraseña inicial tiene al menos 12 caracteres y se cambia después del primer acceso.

## Lanzamiento gratuito

- [ ] Render inicia con `uvicorn main:app --host 0.0.0.0 --port $PORT`.
- [ ] Cloudflare Pages utiliza la URL de Render en `EXPO_PUBLIC_BACKEND_URL`.
- [ ] Las imágenes del lanzamiento viven en los assets del frontend.
- [ ] La pestaña de carga de fotos no se considera disponible en esta versión.
