# Tests de backend (HTTP + Socket.IO)

Este repo tiene **dos suites de integración** que corren dentro de `vitest` y usan la misma base de datos de test:

## Suite HTTP / integración (Fastify + `app.inject()`)

Archivo principal: `test/integration/critical-flows.test.ts`

Cómo corre:

- Levanta la app con `Fastify` (`buildApp`) y usa `app.inject()` (sin levantar un puerto HTTP real).
- El helper `test/helpers/integration.ts` inicializa la app y registra un **stub mínimo de Socket.IO** con `setIO(...)` para que las capas de servicio que llaman a `getIO()` no fallen.
- Crea datos en BD (usuarios, drivers y pedidos) con prefijos controlados y hace `cleanupSeed(...)` al finalizar.

Qué cubre:

- Auth/seguridad base por endpoints HTTP.
- Flujo de pedidos (crear, assign/accept/on-the-way/start/finish, rechazos/cancelaciones).
- Endpoints de métricas con autorización.

## Suite Socket.IO real (servidor + cliente reales)

Archivo principal: `test/integration/socket-realtime.test.ts`

Cómo corre:

- Se levanta un **servidor Fastify + Socket.IO reales** de test con `test/helpers/socketTestServer.ts`.
- El helper `startSocketTestServer()`:
  - llama a `buildApp()`
  - hace `app.listen({ port: 0, host: "127.0.0.1" })` para obtener un puerto dinámico
  - crea `new Server(app.server, ...)` y ejecuta `setupSockets(io)` (mismos middleware JWT y salas/rooms que producción)
  - fija `setIO(io)` para que las emisiones reales funcionen
- El cliente usa `socket.io-client` real para conectarse con `auth: { token }` y hace asserts con `waitForEvent(...)`.
- Los eventos de Socket se disparan llamando endpoints HTTP (ej. `/orders/public`, `/orders/:id/assign-driver`, etc.).

Qué cubre (mínimo pero valioso):

- Conexión autenticada con JWT válido / inválido / vencido.
- Salas por rol (`operators` y `driver:<userId>`).
- Emisión y recepción de eventos clave:
  - `viaje:assigned`
  - `viaje:accepted`
  - `viaje:rejected`
  - `viaje:on-the-way`
  - `viaje:started`
  - `viaje:completed`
  - `pedido:actualizado`
- Ubicación:
  - `PATCH /drivers/me/location`
  - emisión `driver:location`
  - emisión `viaje:positionUpdated` cuando hay viaje activo (incluye `emit('join-trip', { viajeId })` desde el cliente antes del `PATCH`).

Limitaciones actuales:

- No busca cubrir exhaustivamente todos los eventos socket existentes; valida los críticos del flujo de viaje.
- La suite de Socket.IO hace asserts de forma intencionalmente liviana (por ejemplo, `toMatchObject`) para evitar fragilidad por cambios menores de payload.

## Requisitos previos

Los tests requieren PostgreSQL accesible (misma `DATABASE_URL` que usa la app) y que el esquema esté aplicado:

- `npx prisma migrate deploy`

Los tests requieren PostgreSQL y las variables de JWT usadas por `setupSockets`:

- `DATABASE_URL` (misma URL que usa producción, pero apuntando a DB de test).
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`

Además:

- `METRICS_TOKEN` es usado por `/metrics` y `/admin/metrics` (si no lo definís, los tests que lo esperan van a fallar).

`vitest` carga variables desde:

- `.env.test` si existe
- si no, desde `.env`

Ejemplo: `.env.test.example` (en la raíz de `remiseria-backend`).

## Comandos

```bash
cd remiseria-backend

npm run test          # ejecuta todas las suites (HTTP + Socket.IO real)
npm run test:watch    # watch
```

## Correr una sola suite (recomendado)

```bash
# Solo suite HTTP/integración
npx vitest run test/integration/critical-flows.test.ts

# Solo suite Socket.IO real
npx vitest run test/integration/socket-realtime.test.ts
```

## Nota sobre la base de datos

Los tests **modifican la base de datos** (usuarios, drivers y pedidos). Usá una base dedicada a test o un schema aislado.
