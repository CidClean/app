# PRD — Miguel Suárez · Barbero a domicilio

## Contexto
Aplicación web responsive construida con Expo Router, React Native Web, FastAPI y MongoDB para **Miguel Ángel Suárez**, barbero profesional a domicilio en **Torreón, Coahuila**. El diseño es editorial y premium, sin iconografía tradicional de barbería. La aplicación funciona como sitio público y panel administrativo privado.

## Funcionalidades implementadas

### Sitio público
- **Inicio**: hero editorial, CTA de reserva y WhatsApp, presentación de Miguel, proceso del servicio, zonas destacadas, bodas/grupos, reseñas, preguntas frecuentes y footer.
- **Servicios**: catálogo con precios en MXN, botones de reserva/contacto, aviso de posibles recargos y zonas atendidas.
- **Reservar**: flujo de tres pasos con selección de servicio, fecha, hora, datos del cliente, dirección y ubicación opcional.
- **Contacto**: WhatsApp, llamada, SMS, correo, redes sociales, políticas y preguntas frecuentes.
- **Políticas / FAQ**: pantallas dedicadas.

### Panel administrativo
- **Inicio**: listado de reservas.
- **Servicios / Zonas / Preguntas / Reseñas**: administración del contenido.
- **Clientes**: registro automático por teléfono, historial y notas privadas.
- **Contenido**: edición del hero y la presentación de Miguel.
- **Ajustes**: días y horarios disponibles, aviso mínimo, intervalo entre horarios y datos del negocio.
- **Cuenta**: cambio de contraseña administrativa.

## Reglas de negocio
- Corte de cabello: $400 MXN / 40 min.
- Barba: $280 MXN / 30 min.
- Corte y barba: $550 MXN / 70 min.
- Corte, barba y limpieza facial: $600 MXN / 90 min.
- Corte de niño: $300 MXN / 40 min.
- Buffer operativo predeterminado de 20 minutos entre citas.
- Pago al finalizar mediante efectivo o transferencia.
- No se inventan reseñas, direcciones físicas ni cargos.
- Las reservas públicas se registran inicialmente como pendientes de confirmación.

## Seguridad y credenciales
- Las credenciales reales no deben escribirse en documentos, commits ni archivos versionados.
- El correo inicial, la contraseña inicial y el secreto JWT se configuran únicamente mediante variables de entorno.
- La contraseña inicial debe ser de un solo uso y cambiarse después del primer acceso.
- Toda credencial que haya aparecido previamente en el historial se considera comprometida y debe rotarse antes del lanzamiento.

## Arquitectura de lanzamiento inicial
- **Frontend web**: Cloudflare Pages Free.
- **Backend**: FastAPI en Render Free.
- **Base de datos**: MongoDB Atlas Free.
- **Fotografías iniciales**: archivos versionados dentro del frontend.
- **Código y despliegues**: GitHub como fuente de verdad.

## Stack técnico
- Frontend: Expo Router, React Native Web, expo-font, expo-image, expo-linear-gradient, expo-location, react-native-maps y AsyncStorage.
- Backend: FastAPI, Motor, PyMongo, Pydantic, PyJWT y passlib/bcrypt.
- Base de datos: MongoDB.
- Colecciones actuales: services, zones, faqs, testimonials, policies, bookings, site_settings, booking_settings, admin_users, admin_audit, media, clients y content_blocks.

## Dependencias retiradas
El proyecto no depende de Emergent para ejecución, almacenamiento, despliegue, autenticación ni mantenimiento. Cualquier archivo o integración específica de ese entorno debe eliminarse o sustituirse antes del lanzamiento.

## Trabajo pendiente de Fase 1
- Eliminar la integración de almacenamiento de Emergent.
- Configurar CORS por lista permitida.
- Fortalecer autenticación, expiración y revocación de sesiones.
- Añadir limitación de intentos para login y reservas.
- Evitar reservas dobles mediante una operación atómica o bloqueo de horario.
- Añadir estados y acciones administrativas de reservas.
- Publicar aviso de privacidad real y registrar consentimiento.
- Añadir índices MongoDB y pruebas automatizadas de seguridad y concurrencia.

## Datos comerciales pendientes
- Perfiles reales de Instagram y Facebook.
- Reseñas reales autorizadas.
- Respuestas definitivas para preguntas marcadas como pendientes.
- Dominio propio, cuando el negocio justifique el gasto.
