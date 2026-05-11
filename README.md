# Sistema de Inventario y Prestamo de Articulos (Backend)

<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" alt="NestJS" width="90" />
</p>

API REST (NestJS + MongoDB) para gestion de inventario, prestamos de articulos y reserva de salones. Desarrollado para la Fundacion Universitaria Claretiana (Uniclaretiana).

## Stack

- NestJS 11
- TypeScript
- MongoDB (Mongoose 8)
- JWT para autenticacion

## Requisitos

- Node.js 18+ (LTS)
- MongoDB (local o remoto)

## Instalacion

```bash
git clone https://github.com/Erick-000/Sistema-de-Inventario-y-Prestamo-de-Articulos-Backend.git
cd Sistema-de-Inventario-y-Prestamo-de-Articulos-Backend
npm install
```

## Variables de Entorno

Crear `.env`:

```bash
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/inventario
AUTH_SECRET=dev_secret_change_me
AUTH_TTL_MS=28800000
```

## Ejecucion

```bash
npm run start:dev   # desarrollo con hot reload
npm run build       # compilar
npm run start:prod  # produccion
npm run lint        # ESLint
npm run test        # pruebas unitarias
npm run test:e2e    # pruebas end-to-end
```

API disponible en `http://localhost:3001/api`.

## Arquitectura

El backend sigue una arquitectura modular NestJS con controllers, services y schemas Mongoose por dominio.

### Modulos

**Auth**
- Login con verificacion de password (scrypt).
- Generacion y validacion de tokens JWT.
- Roles: admin, docente (extensible).
- Guard de autenticacion (AuthGuard) y decorador de roles (Roles).

**Users**
- CRUD de usuarios con busqueda y filtros.
- Campos: nombre, tipo/numero de documento, correo, programa, rol, estado (bloqueado/activo).

**Articles / Article Categories**
- CRUD de articulos con serial unico, categoria, cantidades (total/disponible), estado.
- CRUD de categorias de articulos.
- Indices unicos para evitar duplicados de serial.

**Loans (Prestamos)**
- Flujo completo de prestamos con maquina de estados:
  SOLICITADO -> RESERVADO -> ACTIVO -> DEVUELTO
  SOLICITADO -> RECHAZADA
  Cualquier estado -> CANCELADO
- Validacion de disponibilidad al aprobar.
- Registro de fechas de devolucion y calculo de vencimientos.

**Notifications**
- Creacion y consulta de notificaciones.
- Asociadas a usuarios y tipos de evento.

**Rooms (Salones)**
- CRUD de salones: nombre, ubicacion, capacidad, descripcion, elementos/equipamiento, horario disponible, estado activo/inactivo.
- Solo admin puede crear/editar/desactivar.

**Room Reservations (Reservas de Salones)**
- Flujo: docente crea solicitud (PENDIENTE) -> admin aprueba (APROBADA) o rechaza (RECHAZADA).
- Docente puede cancelar sus propias reservas. Admin puede cancelar cualquier reserva.
- Prevencion de cruces en dos capas:
  1. Validacion de solapamiento contra reservas APROBADAS existentes al crear y al aprobar.
  2. Bloqueo de slots horarios (RoomReservationBlock) con indice unico compuesto (salon + fecha + minuto) para prevenir condiciones de carrera en concurrencia.

## Endpoints Principales

### Auth
| Metodo | Ruta | Rol |
| :--- | :--- | :--- |
| POST | /api/auth/login | Publico |
| GET | /api/auth/me | Autenticado |

### Articles
| Metodo | Ruta | Rol |
| :--- | :--- | :--- |
| GET | /api/articles | Autenticado |
| POST | /api/articles | Admin |
| PATCH | /api/articles/:id | Admin |

### Article Categories
| Metodo | Ruta | Rol |
| :--- | :--- | :--- |
| GET | /api/article-categories | Autenticado |
| POST | /api/article-categories | Admin |

### Loans
| Metodo | Ruta | Rol |
| :--- | :--- | :--- |
| GET | /api/loans | Autenticado |
| POST | /api/loans | Docente |
| PATCH | /api/loans/:id/approve | Admin |
| PATCH | /api/loans/:id/reject | Admin |
| PATCH | /api/loans/:id/return | Admin |

### Rooms
| Metodo | Ruta | Rol |
| :--- | :--- | :--- |
| GET | /api/rooms | Autenticado |
| POST | /api/rooms | Admin |
| PATCH | /api/rooms/:id | Admin |
| DELETE | /api/rooms/:id | Admin |

### Room Reservations
| Metodo | Ruta | Rol |
| :--- | :--- | :--- |
| GET | /api/room-reservations | Admin |
| GET | /api/room-reservations/mine | Docente |
| GET | /api/room-reservations/week | Autenticado |
| POST | /api/room-reservations | Docente |
| PATCH | /api/room-reservations/:id/approve | Admin |
| PATCH | /api/room-reservations/:id/reject | Admin |
| PATCH | /api/room-reservations/:id/cancel | Admin |
| PATCH | /api/room-reservations/:id/cancel-mine | Docente |

### Notifications
| Metodo | Ruta | Rol |
| :--- | :--- | :--- |
| GET | /api/notifications | Autenticado |

### Users
| Metodo | Ruta | Rol |
| :--- | :--- | :--- |
| GET | /api/users | Admin |
| PATCH | /api/users/:id | Admin |

## Estructura del Proyecto

```
backend/
├── src/
│   ├── schemas/                      # Modelos Mongoose
│   │   ├── user.schema.ts
│   │   ├── article.schema.ts
│   │   ├── article-category.schema.ts
│   │   ├── loan.schema.ts
│   │   ├── notification.schema.ts
│   │   ├── room.schema.ts
│   │   ├── room-reservation.schema.ts
│   │   └── room-reservation-block.schema.ts
│   ├── *.controller.ts               # Controladores HTTP
│   ├── *.service.ts                  # Logica de negocio
│   ├── auth.guard.ts                 # Guard de autenticacion JWT
│   ├── roles.guard.ts                # Guard de autorizacion por rol
│   ├── roles.decorator.ts            # Decorador @Roles()
│   ├── public.decorator.ts           # Decorador @Public()
│   ├── app.module.ts                 # Modulo raiz
│   └── main.ts                       # Bootstrap
├── test/
│   ├── app.e2e-spec.ts
│   └── jest-e2e.json
├── .gitignore
├── .prettierrc
├── eslint.config.mjs
├── nest-cli.json
├── package.json
├── tsconfig.json
└── tsconfig.build.json
```

## Seed (Usuarios Demo)

Ejecutar `seed_mongo_normalizado.js` (en la raiz del monorepo) para crear usuarios iniciales en MongoDB.

| Rol | Correo | Contrasena |
| :--- | :--- | :--- |
| Admin | admin@miuniclaretiana.edu.co | DEMO_HASH |
| Docente | docente@miuniclaretiana.edu.co | DEMO_HASH |

## Prevencion de Cruces en Reservas

El sistema utiliza dos mecanismos complementarios:

1. **Validacion a nivel de aplicacion:** Antes de crear o aprobar una reserva, se consulta si existe otra reserva APROBADA para el mismo salon, misma fecha, con solapamiento de minutos (startMin < endMin AND endMin > startMin).

2. **Bloqueo a nivel de base de datos:** Al aprobar, se insertan documentos `RoomReservationBlock` (uno por cada minuto del rango) con un indice unico compuesto `{ salonId, fecha, minuto }`. Si dos procesos intentan aprobar reservas solapadas simultaneamente, MongoDB rechaza la segunda insercion por violacion de indice unico (E11000), protegiendo contra condiciones de carrera.

## Convenciones

- Conventional Commits
- NestJS best practices: controllers delgados, logica en services
- Schemas Mongoose con indices donde corresponde
- Validacion de ObjectId en todos los endpoints que reciben IDs
- Manejo de errores con excepciones HTTP de NestJS (BadRequestException, NotFoundException, etc.)

---

Desarrollado para la Fundacion Universitaria Claretiana - 2026
