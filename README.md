# Sistema de Inventario y Préstamo de Artículos (Backend)

<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" alt="NestJS" width="90" />
</p>

Backend API (NestJS + MongoDB) para:

- Inventario
- Préstamos de artículos (flujo de solicitudes)
- Reserva de salones (con prevención de cruces, aprobación y cancelación)

## Tecnologías

- NestJS
- TypeScript
- MongoDB (Mongoose)

## Arquitectura / módulos

Este backend está organizado por módulos funcionales (controllers + services + schemas):

- **Auth**
  - Login y validación de sesión.
  - Roles: `admin`, `docente` (y otros roles del sistema).
- **Users**
  - Gestión y consulta de usuarios.
- **Articles / Categories**
  - Inventario de artículos y categorías.
- **Loans (Préstamos)**
  - Flujo de solicitudes y préstamos: solicitado, reservado, activo, devuelto, vencido, etc.
- **Notifications**
  - Notificaciones del sistema.
- **Salones / Reservas de salones**
  - CRUD de salones (admin).
  - Solicitudes de reserva (docente) + aprobación/rechazo (admin).
  - Prevención de cruces por horario (no se permite solapar reservas para el mismo salón).

## Requisitos

- Node.js (recomendado: LTS)
- MongoDB local o remoto

## Variables de entorno

Crea un archivo `.env` en `backend/` (ejemplo):

```bash
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/inventario
AUTH_SECRET=dev_secret_change_me
AUTH_TTL_MS=28800000
```

## Instalación

```bash
npm install
```

## Scripts

```bash
# desarrollo
npm run start:dev

# build
npm run build

# producción
npm run start:prod
```

## Ejecutar en desarrollo

```bash
npm run start:dev
```

La API queda en:

- `http://localhost:3001/api`

## Endpoints principales (referencia)

Los endpoints exactos pueden variar por versión, pero en general:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/articles`
- `GET /api/article-categories`
- `GET /api/loans`
- `GET /api/notifications`
- `GET /api/rooms`
- `GET /api/room-reservations`

## Seed (usuarios demo)

En la raíz del proyecto existe `seed_mongo_normalizado.js` que crea usuarios demo en MongoDB.

Credenciales:

- Admin
  - Correo: `admin@miuniclaretiana.edu.co`
  - Contraseña: `DEMO_HASH`
- Docente
  - Correo: `docente@miuniclaretiana.edu.co`
  - Contraseña: `DEMO_HASH`

## Notas

- No subas archivos `.env*` al repositorio.
- Si el puerto `3001` está ocupado, cambia `PORT`.

## Estructura de carpetas (simplificada)

```text
src/
  schemas/                 # esquemas Mongoose
  *.controller.ts          # controladores HTTP
  *.service.ts             # lógica de negocio
  app.module.ts            # registro de módulos/providers
  main.ts                  # bootstrap NestJS
```
