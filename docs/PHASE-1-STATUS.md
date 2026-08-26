# Fase 1 — Estado de implementación

## Completado en la rama

- Eliminación de archivos operativos y paquete privado de Emergent.
- Protección de archivos `.env` y secretos locales.
- Nuevo punto de entrada de producción: `backend/main.py`.
- CORS limitado a orígenes configurados.
- Sesiones administrativas con `jti`, expiración y revocación.
- Invalidación global de sesiones al cambiar la contraseña.
- Límite de intentos para login y creación de reservas.
- Normalización de teléfonos.
- Registro versionado del consentimiento de privacidad.
- Aviso de privacidad público en API y frontend.
- Índice multikey único para impedir reservas solapadas por minuto.
- Estados de reserva: pendiente, confirmada, completada, cancelada y no-show.
- Reglas de transición y reprogramación con detección de conflictos.
- Pantalla administrativa `/admin/reservas`.
- Carga de imágenes heredada deshabilitada para el lanzamiento gratuito.
- Nuevas pruebas de integración sin credenciales comprometidas.
- GitHub Action para compilar e importar la API de producción.

## Validado

- `backend/main.py` compiló sintácticamente en el entorno local de desarrollo.
- El diff parte del último commit de `main` y no tiene commits pendientes de esa rama.

## Pendiente antes de fusionar

1. Crear el clúster gratuito de MongoDB Atlas.
2. Configurar un servicio Render temporal apuntando a esta rama.
3. Ejecutar la suite de integración contra la API desplegada.
4. Revisar el resultado de GitHub Actions.
5. Corregir cualquier regresión detectada.
6. Crear el despliegue de Cloudflare Pages y definir `CORS_ORIGINS` final.
7. Fusionar únicamente después de una prueba manual completa del flujo público y administrativo.

## Comando de producción

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port $PORT
```

## Nota de seguridad

No se deben copiar contraseñas, cadenas de MongoDB ni secretos JWT a issues, commits, pull requests o mensajes. Todos los valores reales se configuran directamente como secretos de la plataforma.
