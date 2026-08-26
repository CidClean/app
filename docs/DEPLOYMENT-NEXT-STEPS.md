# Siguiente secuencia de despliegue

1. MongoDB Atlas: clúster gratuito y usuario exclusivo creados.
2. Render: Web Service desplegado desde la rama de Fase 1.
3. Secretos configurados directamente en Render.
4. API verificada en `https://barber-page-api.onrender.com`.
5. Cloudflare Worker con Static Assets configurado desde `frontend`.
6. Build command: `npm run build:web`.
7. Deploy command: `npx wrangler deploy`.
8. Variable de build: `EXPO_PUBLIC_BACKEND_URL=https://barber-page-api.onrender.com`.
9. Confirmar el primer despliegue exitoso y copiar el dominio `workers.dev`.
10. Sustituir `CORS_ORIGINS` en Render por el dominio exacto de Cloudflare, conservando los orígenes locales durante las pruebas.
11. Ejecutar `pytest -q` contra la URL de Render.
12. Ejecutar recorrido manual completo de reserva y administración.
13. Fusionar el PR a `main` solamente después de aprobar todas las verificaciones.
