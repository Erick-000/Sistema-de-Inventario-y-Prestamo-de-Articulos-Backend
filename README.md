# Sistema de Inventario y Préstamo de Artículos (Backend)

Backend API (NestJS + MongoDB) para:

- Inventario
- Préstamos de artículos (flujo de solicitudes)
- Reserva de salones (con prevención de cruces, aprobación y cancelación)

## Tecnologías

- NestJS
- TypeScript
- MongoDB (Mongoose)

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

## Ejecutar en desarrollo

```bash
npm run start:dev
```

La API queda en:

- `http://localhost:3001/api`

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
