# Auditoría Técnica — Sistema de Remisería (Fullstack)
> Documento unificado generado a partir de análisis de código real de `remiseria-backend` y `remiseria-frontend`.
> **Última revisión:** parche de seguridad + correcciones de contrato FE↔BE + hardening para producción aplicados.
> Todo lo marcado como *no confirmado* no pudo verificarse directamente en el código fuente.

---

## 1. Resumen Ejecutivo

Sistema fullstack de remisería con:

- **Backend:** Fastify + Prisma + PostgreSQL (TypeScript)
- **Frontend:** React 19 + Vite (JavaScript/JSX)

Dominios implementados en runtime: autenticación (JWT + refresh), gestión de usuarios, choferes, pedidos, tarifas, tracking en tiempo real y métricas.

La capa backend está organizada por módulos (`auth`, `users`, `drivers`, `orders`, `fares`) con patrón `routes → controller → service → repository`.

Hay Socket.IO para eventos operativos (`nuevo_pedido`, `pedido:actualizado`, `viaje:*`, `driver:location`) con rooms por rol/viaje. Métricas disponibles en `/metrics`.

Se aplicaron tres iteraciones sucesivas de mejora: corrección de bugs críticos, parche de seguridad (ownership, exposición de datos), y hardening de producción (rate limiting configurable, helmet, sanitización, logging estructurado, health checks). El sistema está en condiciones de ser desplegado.

---

## 2. Stack y Herramientas

### Backend (`remiseria-backend`)

| Categoría | Tecnología |
|---|---|
| Lenguaje | TypeScript |
| Framework HTTP | Fastify + `@fastify/cors`, `@fastify/jwt`, `@fastify/rate-limit`, `@fastify/helmet` ✅ |
| DB / ORM | Prisma + PostgreSQL |
| Validación | Zod (schemas por módulo + sanitización custom) |
| Auth | JWT access + refresh token rotativo hasheado en DB |
| Realtime | Socket.IO server |
| Logging | Pino con opciones estructuradas (`lib/logger-config.ts`) |
| Métricas | In-memory + serialización Prometheus (`lib/metrics.ts`) |
| Jobs | Intervals Node.js (`lib/jobs.ts`) |
| Build/dev | `ts-node-dev` (dev), `tsc` + `node dist/server.js` (prod) |
| Testing | Sin suite propia |

### Frontend (`remiseria-frontend`)

| Categoría | Tecnología |
|---|---|
| Lenguaje | JavaScript / JSX |
| Framework UI | React 19 + React Router |
| Bundler | Vite + `@vitejs/plugin-react-swc` |
| HTTP client | Axios con interceptor de refresh |
| Realtime | `socket.io-client` + `SocketContext` |
| UI libs | React Bootstrap, FontAwesome, react-icons, lucide-react |
| Mapas | Leaflet + Leaflet Routing Machine |
| Lint | ESLint (`eslint.config.js`) |
| Testing | Sin suite propia confirmada |

### Infra / Tooling

- Sin docker-compose para observabilidad en el proyecto
- Sin `docker-compose.yml` de app principal en raíz
- Variables de entorno documentadas y ampliadas en `.env.example` de cada proyecto

---

## 3. Entrypoints y Flujo de Arranque

### Backend

```
src/server.ts
  └─ lib/env.ts           ← carga y valida .env (fail-fast); expone RATE_LIMIT_*, METRICS_TOKEN, TRUST_PROXY
  └─ buildApp() [app.ts]
       ├─ trustProxy (según TRUST_PROXY / NODE_ENV)
       ├─ genReqId + x-request-id (hasta 128 chars)
       ├─ bodyLimit: 1 MB
       ├─ middlewares: helmet, CORS, rate-limit global, JWT
       ├─ logger estructurado (disableRequestLogging; un evento http.request por respuesta)
       ├─ error handler global
       ├─ rutas: /health, /health/live, /health/ready, /metrics (guard), /admin/metrics (guard)
       └─ módulos: auth, users, orders, drivers, fares
  └─ new Server(socket.io) → setupSockets(io)
  └─ app.listen(PORT)
  └─ startJobs(app.log)
```

### Frontend

```
main.jsx → App.jsx
  ├─ bootstrapAuth() al montar (useEffect)
  ├─ Router
  │   └─ SocketProvider
  │       └─ ToastProvider
  │           └─ Routes (públicas + ProtectedRoute por rol)
  └─ ProtectedRoute: await bootstrapAuth() → valida token en memoria + expiración + rol
```

---

## 4. Arquitectura General

### Backend

```
server.ts / app.ts
├─ lib/
│   ├─ env.ts (RATE_LIMIT_*, METRICS_TOKEN, TRUST_PROXY, LOG_LEVEL)
│   ├─ sanitize.ts (sanitizePlainText, sanitizeMultiline)
│   ├─ logger-config.ts (buildFastifyLoggerOptions, redacción auth/cookie)
│   ├─ health.ts (prisma.$queryRaw + socketIO check)
│   ├─ prisma.ts, errors.ts, metrics.ts, socket.ts, jobs.ts, container.ts
├─ shared/auth.ts          ← authenticate + authorize (transversal)
└─ módulos/
    ├─ auth    (login / refresh / logout — teléfono/password saneados)
    ├─ users   (CRUD admin — proyección sin passwordHash; nombres saneados)
    ├─ drivers (perfil, ubicación, estado, historial — strings de vehículo saneados)
    ├─ orders  (ciclo completo + DTO unificado toOrderApiDto; filtro ownership DRIVER)
    └─ fares   (tarifa activa, cálculo estimado, admin — números .finite())
```

### Frontend

```
main.jsx → App.jsx
├─ context/SocketContext.jsx
├─ utils/ (tokenStorage.js, auth.js)
├─ hooks/api/axiosInstance.js
├─ hooks/ (usePedidos, usePedidosSocket, useConductor, useChoferes, useUser)
├─ pages/ (PrincipalPage, PedidosPage, ChoferesPage, conductorDashboard, ViajeForm, ViajeTracking, ...)
└─ components/ (cards, modals, mapas Leaflet, UI kit)
    └─ PerfilChofer.jsx → migrado a /drivers/me (solo DRIVER)
```

---

## 5. Estructura de Carpetas

| Directorio | Criticidad | Runtime | Riesgo de modificar |
|---|---|---|---|
| `remiseria-backend/src` | 🔴 | Sí | Alto |
| `remiseria-backend/prisma` | 🔴 | Sí | Muy alto |
| `remiseria-frontend/src` | 🔴 | Sí | Alto |
| `eslint.config.js`, `vite.config.js` | 🟡 | Build/dev | Medio |
| `dist/` (ambos) | 🟢 | Artefacto | Bajo |
| `node_modules/` (ambos) | 🟢 | Sí, no editable | Alto si se toca |

---

## 6. Archivos Analizados

### Backend

#### `src/server.ts` — Entrypoint 🔴
- **Responsabilidad:** arranque HTTP + Socket.IO + jobs
- **Dependencias críticas:** `app.ts`, `lib/env.ts`, `lib/jobs.ts`, `sockets/index.ts`
- **Side effects:** abre puerto, inicia intervals
- **Deuda pendiente:** sin shutdown graceful (SIGTERM/SIGINT, cierre de Prisma)

#### `src/app.ts` — Bootstrap/App 🔴
- **Responsabilidad:** construir Fastify, middlewares, error handler, rutas
- **Exporta:** `buildApp`
- **✅ Corregido (parche 1):** `/metrics` y `/admin/metrics` protegidos con guard `metricsAccess`
- **✅ Hardening:** `trustProxy` según `TRUST_PROXY`/`NODE_ENV`; `genReqId`; `bodyLimit` 1 MB; `@fastify/helmet` (CSP desactivada para API JSON; `crossOriginEmbedderPolicy: false`)
- **Deuda pendiente:** uso de `require()` mezclado con ESM en un punto

#### `src/lib/env.ts` — Config 🔴
- **Responsabilidad:** carga `.env` + validación mínima (fail-fast)
- **Exporta:** `env`
- **✅ Actualizado:** `METRICS_TOKEN` (opcional), `NODE_ENV`, `LOG_LEVEL`, `TRUST_PROXY`
- **✅ Hardening:** `RATE_LIMIT_GLOBAL_MAX` (def. 400/min), `RATE_LIMIT_AUTH_MAX` (25), `RATE_LIMIT_PUBLIC_ORDER_MAX` (8), `RATE_LIMIT_TRACK_MAX` (24), `RATE_LIMIT_API_MAX` (180)
- **Deuda pendiente:** parser CORS sin validación de URL; sin schema robusto (zod/envsafe)

#### `src/lib/sanitize.ts` — Sanitización ✅ nuevo 🟡
- **Responsabilidad:** `sanitizePlainText` y `sanitizeMultiline` — elimina caracteres de control, aplica límites de longitud
- **Usado por:** schemas de orders, users, drivers, fares y `auth.controller.ts`

#### `src/lib/logger-config.ts` — Logger config ✅ nuevo 🟡
- **Responsabilidad:** `buildFastifyLoggerOptions()` — nivel según `LOG_LEVEL`; redacción de `authorization`, `cookie`, `set-cookie` en logs; `disableRequestLogging: true` con evento único `http.request` por respuesta
- **Formato evento:** `{ event, reqId, method, url, statusCode, responseTimeMs }`

#### `src/lib/health.ts` — Health checks ✅ nuevo 🟡
- **Responsabilidad:** readiness check — `prisma.$queryRaw(SELECT 1)` + `getIOOrNull()` inicializado; devuelve 503 si alguno falla
- **Expone:** conteo de `socketConnections`

#### `src/lib/prisma.ts` — DB Client 🔴
- **Deuda:** sin cierre explícito al shutdown, sin query instrumentation

#### `src/lib/errors.ts` — Errores de dominio 🟡
- **Deuda:** `handleError` colapsa errores desconocidos a 500 sin contexto

#### `src/lib/socket.ts` — Socket Registry 🔴
- **Bug potencial:** `getIO()` lanza si se invoca antes de init

#### `src/sockets/index.ts` — Socket Gateway 🔴
- **Deuda:** sin rate/event abuse por socket; sin log estructurado al conectar

#### `src/lib/jobs.ts` — Background Jobs 🟡
- **Bug potencial:** intervals no coordinados en deploy multi-instancia

#### `src/lib/metrics.ts` — Observabilidad 🟡
- **Deuda:** métricas in-memory se pierden en restart; no usa `prom-client` estándar

#### `src/lib/container.ts` — DI Manual 🟡
- **Deuda:** `AuthService` accede directamente a Prisma sin repo dedicado

#### `src/shared/auth.ts` — Middleware Auth 🔴
- **Responsabilidad:** `authenticate` + `authorize` por rol

#### `src/modules/users/users.repository.ts` — Repository 🔴
- **✅ Corregido:** `list()` y `create()` usan `userPublicSelect` fijo — sin `passwordHash`
- `findByPhone` / `findByEmail` siguen devolviendo usuario completo (necesario para login)

#### `src/modules/users/users.schemas.ts` — Schemas 🟡
- **✅ Hardening:** nombres y teléfono saneados con `sanitize`; `email` con `preprocess` para `""` → `undefined`

#### `src/modules/orders/orders.mappers.ts` — Mappers ✅ nuevo 🔴
- **Responsabilidad:** DTO unificado `toOrderApiDto` con estructura canónica
- **Estructura:** `cliente`, `viaje`, `montos` (`estimado`, `final`, `metodoPago`), `chofer` con `vehiculo` anidado, `estados`, `timestamps` (incluye `createdAt`)
- `toOrderDto` y `toOrderDetailDto` son alias de `toOrderApiDto` para compatibilidad hacia atrás
- Eliminados duplicados anteriores (`montoFinal` / `metodoPago` en `viaje`)

#### `src/modules/orders/orders.schemas.ts` — Schemas 🔴
- **✅ Hardening:** textos con límites de longitud; coords con `.finite()` y rangos lat/lng válidos; montos acotados

#### `src/modules/orders/orders.routes.ts` — Routes 🔴
- **✅ Corregido:** `GET /orders` con `authorize(["ADMIN","OPERATOR","DRIVER"])` explícito
- **✅ Hardening:** `POST /orders`, `GET /orders`, `GET /orders/:id` con `RATE_LIMIT_API_MAX`; rutas públicas con límites de env

#### `src/modules/orders/orders.repository.ts` — Repository 🔴
- **✅ Corregido:** `list()` acepta `driverUserId` opcional; filtra por `chofer.userId`
- **✅ Actualizado:** usa `toOrderApiDto` en listados

#### `src/modules/orders/orders.service.ts` — Service 🔴
- **✅ Corregido:** `listOrders` aplica filtro ownership solo si rol es `DRIVER`
- **✅ Actualizado:** usa solo `toOrderApiDto` / `toOrderDto` para consistencia

#### `src/modules/orders/orders.controller.ts` — Controller 🔴
- **✅ Actualizado:** pasa `authUser` del JWT a `listOrders`

#### `src/modules/drivers/drivers.routes.ts` — Routes 🔴
- **✅ Corregido:** `GET /drivers` requiere ADMIN u OPERATOR

#### `src/modules/drivers/drivers.schemas.ts` — Schemas 🟡
- **✅ Hardening:** strings de vehículo opcionales saneados; ubicación con `.finite()`

#### `src/modules/fares/fares.schemas.ts` — Schemas 🟡
- **✅ Hardening:** nombre saneado; números con `.finite()`

#### `src/modules/auth/auth.controller.ts` — Controller 🔴
- **✅ Hardening:** teléfono con trim + eliminación de caracteres de control; contraseña máx. 128 chars
- `auth.routes.ts` usa `RATE_LIMIT_AUTH_MAX` para login

---

### Frontend

#### `src/main.jsx` — Entrypoint 🔴
- Monta React en `#root` con StrictMode. Estándar Vite/React.

#### `src/App.jsx` — Router + Providers 🔴
- **✅ Actualizado:** `/perfilChofer` con `allowedRoles={['DRIVER']}`
- **Deuda pendiente:** rutas duplicadas conceptualmente (`/chofer` vs `/conductorDashboard`)

#### `src/components/ProtectedRoute.jsx` — Guard 🔴
- **✅ Corregido:** siempre `await bootstrapAuth()` antes de decidir; `ready` inicia en `false`

#### `src/components/AppShell.jsx` — Layout Shell 🟡
- **✅ Actualizado:** "Mi perfil" → `/perfilChofer` solo para DRIVER
- **Deuda pendiente:** `window.location.href` fuerza recarga completa en logout

#### `src/hooks/api/axiosInstance.js` — Cliente HTTP 🔴
- Interceptor de refresh en 401
- Maneja `SESSION_INVALIDATED` por HTTP (preparatorio; backend actual solo lo emite por socket)

#### `src/utils/tokenStorage.js` — Estado de sesión 🔴
- **✅ Corregido:** `bootstrapAuth` no devuelve token vencido; `bootstrapPromise` evita race conditions

#### `src/utils/auth.js` — Util JWT cliente 🟡
- Decodifica JWT sin verificar firma (diseño explícito; verificación real es servidor)
- **Bug potencial:** si `exp` falta, `isTokenExpired` cierra sesión

#### `src/context/SocketContext.jsx` — Provider Socket.IO 🔴
- **Bug potencial conocido:** `socketRef.current` en value puede quedar stale

#### `src/hooks/usePedidos.jsx` — Hook dominio pedidos 🔴
- **Nota:** el frontend ya tenía fallbacks (`montos`, `viaje.montoFinal`); ahora alineado con `toOrderApiDto`
- **Deuda:** `mapMetodoPago` mezcla lowercase UI con enums backend

#### `src/hooks/usePedidosSocket.js` — Realtime + fallback polling 🔴
- Escucha `nuevo_pedido`, `pedido:actualizado`, `driver:location`; polling 6s; rehidratación 30s

#### `src/hooks/useConductor.jsx` — Hook conductor 🔴
- **Deuda pendiente:** coexiste con `conductorDashboard.jsx`; posible divergencia

#### `src/components/choferes/PerfilChofer.jsx` — Perfil conductor 🟡
- **✅ Corregido:** migrado a `GET /drivers/me` + `PATCH /drivers/me/status`
- `PATCH /drivers/me/status` rechaza si estado es `OCUPADO` (regla backend existente)

#### `src/components/choferes/RegistroChofer.jsx` — Alta chofer 🟡
- **✅ Actualizado:** mensaje con `id` de usuario si falla `POST /drivers`
- **Deuda:** sin rollback en BD (no existe `DELETE /users`)

#### `src/pages/ViajeForm.jsx` — Formulario público 🔴
- **✅ Corregido:** llama `POST /fares/calcular` con distancia/duración/nocturno tras `routesfound`
- Fallback a fórmula local con texto "Estimación local…" si la API falla o no hay tarifa activa

---

## 7. Endpoints Documentados

### Auth (`/auth`)

| Método | Ruta | Auth | Rate limit | Notas |
|---|---|---|---|---|
| POST | `/auth/login` | Público | `RATE_LIMIT_AUTH_MAX` (25/min) ✅ | Body saneado (trim, control chars, pass máx. 128) |
| POST | `/auth/refresh` | Cookie | — | Rota token |
| POST | `/auth/logout` | Autenticado | — | Revoca refresh |

### Users (`/users`)

| Método | Ruta | Auth | Notas |
|---|---|---|---|
| POST | `/users` | ADMIN | Crea usuario — respuesta sin `passwordHash` ✅; campos saneados |
| GET | `/users` | ADMIN | Lista usuarios — respuesta sin `passwordHash` ✅ |

### Drivers (`/drivers`)

| Método | Ruta | Auth | Notas |
|---|---|---|---|
| GET | `/drivers` | ADMIN / OPERATOR ✅ | Lista choferes (DRIVER: 403) |
| GET | `/drivers/me` | DRIVER | Perfil propio |
| PATCH | `/drivers/me/status` | DRIVER | Cambia `EstadoChofer` (no aplica si OCUPADO) |
| PATCH | `/drivers/me/location` | DRIVER | Ubicación con `.finite()` y rangos validados |
| GET | `/drivers/me/history` | DRIVER | Historial de viajes |

### Fares (`/fares`)

| Método | Ruta | Auth | Notas |
|---|---|---|---|
| GET | `/fares/active` | Público | Tarifa activa |
| POST | `/fares/calcular` | Público (30/min) | Usado por `ViajeForm` ✅; fallback local si falla |
| POST | `/fares` | ADMIN | Crea tarifa — nombre saneado, números `.finite()` |
| PATCH | `/fares/:id/activate` | ADMIN | Activa tarifa (desactiva anteriores) |

### Orders (`/orders`)

| Método | Ruta | Auth | Rate limit | Notas |
|---|---|---|---|---|
| POST | `/orders/public` | Público | `RATE_LIMIT_PUBLIC_ORDER_MAX` (8/min) ✅ | Pedido pasajero → `nuevo_pedido`; coords validadas |
| GET | `/orders/track/:codigo` | Público | `RATE_LIMIT_TRACK_MAX` (24/min) ✅ | Tracking por código |
| POST | `/orders` | ADMIN/OPERATOR | `RATE_LIMIT_API_MAX` (180/min) ✅ | Crea pedido interno |
| GET | `/orders` | ADMIN/OPERATOR/DRIVER ✅ | `RATE_LIMIT_API_MAX` ✅ | DRIVER ve solo sus pedidos |
| GET | `/orders/stats/top-drivers` | ADMIN/OPERATOR | — | Ranking choferes |
| GET | `/orders/stats/dashboard` | ADMIN/OPERATOR | — | Agregados |
| GET | `/orders/stats/active-trips` | ADMIN/OPERATOR/DRIVER | — | Duplicado intencional; payload resumido (no `toOrderApiDto`) |
| GET | `/orders/active-trips` | ADMIN/OPERATOR/DRIVER | — | Mismo handler |
| GET | `/orders/:id` | Autenticado | `RATE_LIMIT_API_MAX` ✅ | DRIVER solo si es su viaje; responde con `toOrderApiDto` |
| POST | `/orders/:id/assign-driver` | ADMIN/OPERATOR | — | `viaje:assigned` |
| POST | `/orders/:id/accept` | DRIVER | — | `viaje:accepted` |
| POST | `/orders/:id/reject` | DRIVER | — | `{ motivoRechazo }` → PENDIENTE + libera chofer |
| POST | `/orders/:id/on-the-way` | DRIVER | — | `viaje:on-the-way` |
| POST | `/orders/:id/start` | DRIVER | — | `viaje:started` |
| POST | `/orders/:id/finish` | DRIVER | — | `{ montoFinal, metodoPago }` → `viaje:completed` |
| POST | `/orders/:id/cancel` | ADMIN/OPERATOR | — | `viaje:cancelled` |
| POST | `/orders/:id/reject-by-operator` | ADMIN/OPERATOR | — | PENDIENTE→RECHAZADO |
| POST | `/orders/:id/unassign` | ADMIN/OPERATOR | — | `viaje:unassigned` |
| POST | `/orders/:id/finish-by-operator` | ADMIN/OPERATOR | — | Cierra desde ACEPTADO/EN_CAMINO/EN_VIAJE |
| GET | `/orders/:id/logs` | Autenticado | — | `OrderStatusLog` |
| GET | `/orders/:id/timeline` | Autenticado | — | Timeline enriquecido |

### Métricas / Health

| Método | Ruta | Auth | Notas |
|---|---|---|---|
| GET | `/health` | Público | `{ status, service, env }` — liveness |
| GET | `/health/live` | Público | Proceso vivo |
| GET | `/health/ready` | Público | DB + Socket.IO listos; 503 si no ✅ |
| GET | `/metrics` | `METRICS_TOKEN` o JWT ADMIN ✅ | Prometheus text format |
| GET | `/admin/metrics` | `METRICS_TOKEN` o JWT ADMIN ✅ | JSON agregado |

---

## 8. Base de Datos y Prisma

### Modelos

| Modelo | Propósito | Estado |
|---|---|---|
| `User` | Identidad y rol | `passwordHash` ✅ no expuesto en API; campos saneados en entrada |
| `Driver` | Extensión operativa de User DRIVER | Strings de vehículo saneados; coords validadas |
| `Order` | Entidad principal de viaje | DTO unificado `toOrderApiDto` ✅; coords y montos con `.finite()` |
| `OrderStatusLog` | Bitácora de transiciones | Calidad de nota depende del caller |
| `FareSetting` | Configuración tarifaria | Sin tarifa activa → fallback en `ViajeForm` ✅ |
| `DriverLocation` | Histórico GPS | Alto volumen escritura; retención depende de jobs |
| `RefreshToken` | Sesiones persistidas | Crece si job falla |

### Enums

| Enum | Valores |
|---|---|
| `RolUsuario` | ADMIN, OPERATOR, DRIVER |
| `EstadoChofer` | DISPONIBLE, OCUPADO, OFFLINE |
| `EstadoPedido` | PENDIENTE, ASIGNADO, ACEPTADO, RECHAZADO, EN_CAMINO, EN_VIAJE, COMPLETADO, CANCELADO |
| `MetodoPago` | EFECTIVO, TRANSFERENCIA, TARJETA |

### Relaciones Críticas

```
User (DRIVER) ──1:1──► Driver
Order ──────────────► Driver (asignación / estado OCUPADO)
Order ──────────────► OrderStatusLog (auditoría completa)
User ────────────────► RefreshToken (sesión segura rotativa)
Driver ──────────────► DriverLocation (histórico GPS)
```

### DTO unificado `toOrderApiDto`

```typescript
{
  id, codigo, estado,
  cliente:  { nombre, telefono, notas },
  viaje:    { origenDireccion, destinoDireccion, origenLat, origenLng, destinoLat, destinoLng },
  montos:   { estimado, final, metodoPago },
  chofer:   { id, nombre, telefono, vehiculo: { marca, modelo, patente, color } } | null,
  estados:  { ... },
  timestamps: { createdAt, ... }
}
```

> **Nota:** `toOrderDto` y `toOrderDetailDto` son aliases de `toOrderApiDto` por compatibilidad hacia atrás. `getActiveTrips` devuelve un payload resumido distinto (por diseño de rendimiento, no es un bug).

---

## 9. Auth y Seguridad

| Prioridad | Hallazgo | Estado |
|---|---|---|
| ~~🔴 Alta~~ | ~~`GET /users` expone `passwordHash`~~ | ✅ `userPublicSelect` |
| ~~🔴 Alta~~ | ~~`/metrics` sin auth~~ | ✅ Fix aplicado — guard `metricsAccess` implementado |
| ~~🔴 Alta~~ | ~~DRIVER ve pedidos ajenos~~ | ✅ filtro ownership |
| ~~🔴 Alta~~ | ~~DRIVER lista todos los choferes~~ | ✅ `authorize(["ADMIN","OPERATOR"])` |
| ~~🔴 Alta~~ | ~~Rate limit fijo hardcodeado~~ | ✅ Fix aplicado — usa `RATE_LIMIT_AUTH_MAX` de env |
| ~~🔴 Alta~~ | ~~Sin cabeceras de seguridad HTTP~~ | ✅ `@fastify/helmet` |
| ~~🔴 Alta~~ | ~~Inputs sin sanitizar (control chars, longitudes)~~ | ✅ `lib/sanitize.ts` + schemas Zod |
| ~~🔴 Alta~~ | ~~Headers auth/cookie en logs~~ | ✅ redactados en `logger-config.ts` |
| ~~🔴 Crítico~~ | ~~Cookie SameSite/Secure dinámica rompe sesión en HTTP~~ | ✅ Fix aplicado — `NODE_ENV` controla Secure/SameSite |
| 🟡 Media | CORS `credentials: true` — depende de `CORS_ORIGINS` en deploy | Abierto |
| 🟡 Media | Helmet: revisar si clientes usan iframes o scripts inusuales (CSP desactivada) | Abierto |
| 🟢 Baja | Jobs limpian tokens expirados/revocados | OK |

> **Prometheus:** si el scrape corría sin auth, configurar `METRICS_TOKEN` en `.env` y en el job de Prometheus, o usar JWT de admin.
> **Rate limits y proxy:** si hay muchos operadores detrás de una misma IP, subir `RATE_LIMIT_*` o configurar `TRUST_PROXY=1` para que Fastify use la IP real.

---

## 10. Sockets, Jobs y Métricas

### Eventos Socket.IO

| Evento | Emisor | Sala / Destino |
|---|---|---|
| `nuevo_pedido` | `orders.service` | `operators` |
| `pedido:actualizado` | `orders.service` | `operators` |
| `viaje:assigned` | `orders.service` | `driver:{userId}` |
| `viaje:accepted` / `rejected` | `orders.service` | `operators` + `driver:{userId}` |
| `viaje:on-the-way` / `started` / `completed` / `cancelled` / `unassigned` | `orders.service` | sala correspondiente |
| `driver:location` | `drivers.service` | `operators` |
| `viaje:positionUpdated` | `drivers.service` | `trip:{orderId}` |

### Consumo Frontend

| Suscriptor | Eventos escuchados |
|---|---|
| `usePedidosSocket.js` | `nuevo_pedido`, `pedido:actualizado`, `driver:location` |
| `conductorDashboard.jsx` | familia `viaje:*`, `pedido:actualizado` |
| `ClienteMapTracking.jsx` | `viaje:positionUpdated` |

### Jobs (`lib/jobs.ts`)

- **Cada hora:** limpieza de `DriverLocation` antiguas
- **Cada 15 min:** recorte de ubicaciones por ventana por driver
- **Cada hora:** limpieza de `RefreshToken` expirados/revocados

### Métricas

- `/metrics` → texto plano Prometheus — **protegido** ✅
- `/admin/metrics` → JSON agregado — **protegido** ✅
- Auth: `Authorization: Bearer <METRICS_TOKEN>` o JWT con rol `ADMIN`

---

## 11. Contrato Frontend ↔ Backend

### Alineaciones confirmadas

| Área | Estado |
|---|---|
| Claims JWT (`userId`, `rol`) | ✅ Alineado |
| Enums `EstadoPedido`, `MetodoPago`, `RolUsuario` | ✅ Alineado (mayúsculas en API) |
| Rutas pedidos (crear, asignar, transiciones) | ✅ Alineado |
| `MetodoPago` lowercase en UI → `mapMetodoPago` convierte | ✅ Conversión explícita |
| `/orders/active-trips` duplicado | ✅ Intencional por compatibilidad |
| `PerfilChofer.jsx` → `/drivers/me` | ✅ Migrado |
| `ViajeForm.jsx` → `POST /fares/calcular` | ✅ Con fallback local |
| Listado pedidos (`usePedidos`) → `toOrderApiDto` | ✅ Alineado; fallbacks FE preservados |

### Desalineaciones menores pendientes

| Componente | Problema | Estado |
|---|---|---|
| `axiosInstance.js` | Maneja `SESSION_INVALIDATED` HTTP; backend solo lo emite por socket | 🟡 Preparatorio; no rompe |
| `useConductor` | Envía `driverId` extra en reject; Zod hace strip | 🟡 Menor |
| `CrearUsuario.jsx` | Sin mensaje si falla `POST /drivers` en segundo paso | 🟡 Gap de UX |
| `getActiveTrips` | Devuelve payload resumido, no `toOrderApiDto` | 🟡 Diseño intencional (rendimiento) |

---

## 12. Flujos de Negocio

### Login y sesión
```
PrincipalPage → POST /auth/login  (RATE_LIMIT_AUTH_MAX = 25/min)
  └─ teléfono/pass saneados → bcrypt validate → JWT access + refresh cookie HttpOnly
  └─ FE guarda accessToken en memoria
  └─ axiosInstance adjunta Bearer; 401 → POST /auth/refresh
  └─ SocketProvider conecta con auth: { token }
  └─ bootstrapAuth (app load / ProtectedRoute) → refresh si no hay token válido
```

### Ciclo completo de pedido
```
[Operador] NuevoPedidoModal → POST /orders → nuevo_pedido (socket operators)
[Operador] ModalAsignarChofer → POST /orders/:id/assign-driver
  └─ tx atómica: PENDIENTE→ASIGNADO + chofer DISPONIBLE→OCUPADO
  └─ viaje:assigned → driver:{userId}
[Chofer] POST /accept → /on-the-way → /start → /finish (montoFinal, metodoPago)
  └─ COMPLETADO + chofer DISPONIBLE
[Operador override] POST /finish-by-operator (desde ACEPTADO/EN_CAMINO/EN_VIAJE)
```

### Estimación de precio (pasajero)
```
ViajeForm → routesfound (Leaflet Routing Machine)
  └─ POST /fares/calcular { distanciaKm, duracionMin, esNocturno }
       ├─ OK → precio desde FareSetting activo en DB
       └─ Error / sin tarifa activa → fórmula local + "Estimación local…"
```

### Tracking pasajero
```
ViajeTracking → poll GET /orders/track/:codigo  (RATE_LIMIT_TRACK_MAX = 24/min)
ClienteMapTracking → joinTrip + escucha viaje:positionUpdated
Chofer → PATCH /drivers/me/location → emite driver:location + viaje:positionUpdated
```

### Health / readiness
```
GET /health/ready
  └─ prisma.$queryRaw(SELECT 1) → OK / 503
  └─ getIOOrNull() !== null    → OK / 503
  └─ socketConnections (informativo)
```

---

## 13. Bugs, Deuda y Riesgos

### Corregidos

| # | Descripción |
|---|---|
| ~~1~~ | ~~`PerfilChofer.jsx` — rutas `/choferes/*` inexistentes~~ ✅ |
| ~~2~~ | ~~`GET /users` exponía `passwordHash`~~ ✅ |
| ~~3~~ | ~~`/metrics` sin autenticación~~ ✅ |
| ~~4~~ | ~~`ViajeForm` precio hardcodeado vs `/fares/calcular`~~ ✅ |
| ~~5~~ | ~~`GET /orders` DRIVER veía pedidos ajenos~~ ✅ |
| ~~6~~ | ~~Rate limits fijos; sin configuración por entorno~~ ✅ |
| ~~7~~ | ~~Sin cabeceras de seguridad HTTP~~ ✅ |
| ~~8~~ | ~~Inputs sin sanitizar~~ ✅ |
| ~~9~~ | ~~Headers sensibles en logs~~ ✅ |
| ~~10~~ | ~~Cookie SameSite/Secure dinámica — sesión expira en HTTP~~ ✅ |
| ~~11~~ | ~~`/metrics` sin guard de autenticación~~ ✅ |
| ~~12~~ | ~~Rate limit de login hardcodeado, ignoraba `RATE_LIMIT_AUTH_MAX`~~ ✅ |

### Deuda y riesgos pendientes

| # | Tipo | Descripción | Impacto |
|---|---|---|---|
| 1 | 🟡 Deuda | `useConductor` y `conductorDashboard` implementan flujo chofer en paralelo | Divergencia de UX y lógica |
| 2 | 🟡 Deuda | Llamadas duplicadas a `/orders/active-trips` en `conductorDashboard` | Requests innecesarias |
| 3 | 🟡 Deuda | Jobs con `setInterval` sin leader election | Doble ejecución en multi-instancia |
| 4 | 🟡 Deuda | Métricas in-memory se pierden en restart; sin `prom-client` | Dashboards incompletos post-restart |
| 5 | 🟡 Deuda | `CrearUsuario.jsx` sin feedback si falla `POST /drivers` | Gap de UX |
| 6 | 🟡 Riesgo | `PATCH /drivers/me/status` rechaza si OCUPADO sin mensaje claro en UI | UX confusa para conductor |
| 7 | 🟡 Riesgo | Prometheus: scrape requiere `METRICS_TOKEN` o JWT admin post-deploy | Scrape roto si no se actualiza |
| 8 | 🟡 Riesgo | Rate limits por IP: operadores tras NAT pueden ser bloqueados sin `TRUST_PROXY=1` | Falsos positivos |
| 9 | 🟡 Riesgo | Helmet CSP desactivada: revisar si algún cliente necesita iframe/script inusual | Superficie XSS si hay SSR futuro |
| 10 | 🟢 Menor | `SocketContext` expone `socketRef.current` → puede quedar stale | Re-renders inconsistentes |
| 11 | 🟢 Menor | `getActiveTrips` devuelve payload resumido, no `toOrderApiDto` | Inconsistencia de forma (intencional) |
| 12 | 🟢 Menor | `sockets/index.ts` sin log estructurado al conectar | Dificultad de debug de conexiones WS |

---

## 14. Mejoras Sugeridas (Roadmap)

| # | Mejora | Estado |
|---|---|---|
| 1 | Migrar `PerfilChofer.jsx` a `/drivers/me` | ✅ Hecho |
| 2 | `userPublicSelect` sin `passwordHash` | ✅ Hecho |
| 3 | Proteger métricas con `metricsAccess` | ✅ Hecho |
| 4 | `ViajeForm` llama `POST /fares/calcular` | ✅ Hecho |
| 5 | Filtro ownership en `GET /orders` para DRIVER | ✅ Hecho |
| 6 | Rate limits configurables por env | ✅ Hecho |
| 7 | `@fastify/helmet` + CSP desactivada para API | ✅ Hecho |
| 8 | Sanitización de inputs (`lib/sanitize.ts`) | ✅ Hecho |
| 9 | Logging estructurado + redacción de headers sensibles | ✅ Hecho |
| 10 | DTO unificado `toOrderApiDto` | ✅ Hecho |
| 11 | Health checks `/health/ready` con DB + socket | ✅ Hecho |
| 12 | Consolidar flujo conductor (`useConductor` + `conductorDashboard`) | 🔲 Pendiente |
| 13 | Log estructurado en `setupSockets` al conectar | 🔲 Pendiente (sugerido como siguiente paso) |
| 14 | Alinear `getActiveTrips` con `toOrderApiDto` | 🔲 Pendiente (mayor costo en queries) |
| 15 | Shutdown graceful (SIGTERM/SIGINT + cierre Prisma) | 🔲 Pendiente |
| 16 | Migrar métricas a `prom-client` | 🔲 Pendiente |
| 17 | Validación de env con Zod/envsafe | 🔲 Pendiente |
| 18 | Tests de integración (auth, ciclo pedido, tarifas) | 🔲 Pendiente |

---

## 15. Archivos de Mayor Riesgo (Estado Actual)

| Ranking | Archivo | Motivo |
|---|---|---|
| 1 | `conductorDashboard.jsx` + `useConductor.jsx` | Duplicidad de flujo chofer sin consolidar |
| 2 | `app.ts` | Punto central de middlewares, guards y configuración de producción |
| 3 | `orders.service.ts` / `orders.repository.ts` | Ciclo de estados y transacciones atómicas |
| 4 | `SocketContext.jsx` | Stale ref + lógica de refresh paralela con `axiosInstance` |
| 5 | `lib/sanitize.ts` + schemas Zod | Superficie de sanitización — cambios aquí afectan toda la validación de entrada |

---

## 16. Onboarding (Dev)

```bash
# 1. Clonar y preparar dependencias
git clone <repo>
cd remiseria-backend && npm install
cd ../remiseria-frontend && npm install

# 2. Configurar .env del backend
cp .env.example .env
# Variables requeridas:
#   DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, PORT, CORS_ORIGINS
# Variables de producción recomendadas:
#   NODE_ENV=production
#   LOG_LEVEL=info
#   TRUST_PROXY=1           ← si hay nginx/load balancer delante
#   METRICS_TOKEN=<token>   ← para scrape Prometheus sin JWT admin
# Rate limits (ajustar según carga):
#   RATE_LIMIT_GLOBAL_MAX=400
#   RATE_LIMIT_AUTH_MAX=25
#   RATE_LIMIT_PUBLIC_ORDER_MAX=8
#   RATE_LIMIT_TRACK_MAX=24
#   RATE_LIMIT_API_MAX=180

# 3. Migrar base de datos
npx prisma migrate dev   # o: npx prisma db push

# 4. Arrancar
npm run dev   # en cada proyecto

# 5. Verificar salud
curl http://localhost:3000/health
curl http://localhost:3000/health/ready
```

### Checklist de verificación manual post-deploy

| Escenario | Verificar |
|---|---|
| Login admin/operator/driver | Funciona igual que antes |
| `GET /users` (admin) | Respuesta **sin** `passwordHash` |
| `GET /orders` con JWT DRIVER | Solo pedidos del conductor |
| `GET /drivers` con JWT DRIVER | **403** |
| `GET /metrics` sin auth | **401** |
| `GET /metrics` con `METRICS_TOKEN` | **200** |
| `GET /health/ready` con DB caída | **503** |
| `/perfilChofer` como DRIVER | Carga perfil; cambia DISPONIBLE/OFFLINE |
| `/perfilChofer` como ADMIN | Redirige |
| `ViajeForm` con tarifa activa | Precio desde API |
| `ViajeForm` sin tarifa activa | "Estimación local…" |
| Login con contraseña > 128 chars | Rechazado por validación |
| Token vencido + cookie refresh válida | `bootstrapAuth` renueva antes de renderizar |
| Prometheus scrape | Actualizar job con `METRICS_TOKEN` si antes corría sin auth |

**Verificar:** `CORS_ORIGINS` incluya el origen de Vite (`http://localhost:5173` en dev).

---

*Documento generado con base en análisis estático de código real. Refleja tres iteraciones de mejora: corrección de bugs funcionales, parche de seguridad y hardening para producción.*


## 17. Resumen de Hardening de Producción (Actualización)

### 1. Hardening de seguridad
- Rate limiting configurable por entorno (`env.ts`)
  - RATE_LIMIT_GLOBAL_MAX = 400/min
  - RATE_LIMIT_AUTH_MAX = 25
  - RATE_LIMIT_PUBLIC_ORDER_MAX = 8
  - RATE_LIMIT_TRACK_MAX = 24
  - RATE_LIMIT_API_MAX = 180
- Helmet configurado (CSP desactivada para API JSON)
- Sanitización centralizada (`sanitize.ts`)
- Validaciones con Zod (.finite(), límites, preprocess)
- Redacción de headers sensibles en logs

### 2. Contratos de pedidos unificados
- `toOrderApiDto` como única fuente de verdad
- Eliminación de duplicaciones en `viaje`
- Compatibilidad mantenida con aliases

### 3. Logging estructurado
- Evento único `http.request`
- Campos: reqId, method, url, statusCode, responseTimeMs

### 4. Deploy y health checks
- Variables de entorno ampliadas
- `/health`, `/health/live`, `/health/ready`
- Verificación DB + Socket.IO
- trustProxy configurable
- bodyLimit 1MB

### Riesgos actuales
- Métricas requieren autenticación
- Rate limit sensible a IP detrás de proxy
- `getActiveTrips` usa DTO reducido
- Helmet CSP desactivada (documentado)

### Próximos pasos sugeridos
- Unificar flujo de conductor
- Agregar métricas con prom-client
- Logs en conexión de sockets
- Tests de integración críticos

---

## 18. Historial de Fixes Post-Auditoría

| # | Fecha | Bug | Archivo | Estado |
|---|---|---|---|---|
| 1 | 2026-04-06 | Cookie SameSite/Secure dinámica | auth.controller.ts | ✅ |
| 2 | 2026-04-06 | /metrics sin autenticación | app.ts | ✅ |
| 3 | 2026-04-06 | Rate limit hardcodeado en login | auth.routes.ts | ✅ |
