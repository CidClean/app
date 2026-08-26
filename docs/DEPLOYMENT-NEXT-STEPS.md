# Siguiente secuencia de despliegue

1. MongoDB Atlas: crear clúster gratuito y usuario exclusivo.
2. Render: crear Web Service desde la rama de Fase 1.
3. Configurar secretos directamente en Render.
4. Verificar `/api/health`.
5. Ejecutar `pytest -q` contra la URL de Render.
6. Corregir cualquier fallo antes de usar datos reales.
7. Cloudflare Pages: desplegar el frontend y configurar la URL del backend.
8. Sustituir `CORS_ORIGINS` por el dominio exacto de Pages.
9. Ejecutar recorrido manual completo.
10. Fusionar el PR a `main` solamente después de aprobar todas las verificaciones.
