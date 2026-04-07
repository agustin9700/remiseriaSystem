# Sistema de Observabilidad - Remisería

Este documento describe cómo configurar y usar el sistema de monitoreo para el backend de remisería.

## Arquitectura

```
┌─────────────────┐     ┌─────────────┐     ┌────────────┐
│  Backend        │────▶│  Prometheus │────▶│  Grafana   │
│  /metrics       │     │  :9090      │     │  :3001     │
└─────────────────┘     └─────────────┘     └────────────┘
                               │
                               ▼
                        ┌─────────────┐
                        │ Alertmanager│
                        │  :9093      │
                        └─────────────┘
```

## Requisitos Previos

1. Backend corriendo en `http://localhost:3000`
2. Docker y Docker Compose instalados

---

## FASE 1: Levantar Observabilidad

### Iniciar servicios

```bash
cd remiseria-backend/observability
docker-compose up -d
```

Esto levanta:
- **Prometheus** - http://localhost:9090
- **Grafana** - http://localhost:3001 (admin/admin123)
- **Alertmanager** - http://localhost:9093

### Verificar que Prometheus scrapea métricas

1. Ir a http://localhost:9090/targets
2. Confirmar que `remiseria-backend` está en estado "UP"
3. Ir a http://localhost:9090/graph y ejecutar consulta:
   ```
   remiseria_pedidos_creados_total
   ```

---

## FASE 2: Dashboards de Grafana

### Acceso

1. Abrir http://localhost:3001
2. Login: `admin` / `admin123`
3. Los dashboards ya están configurados automáticamente via provisioning

### Dashboard 1: Sistema General
- **Ubicación**: Home > Remisería - Sistema General
- **Métricas mostradas**:
  - Pedidos por estado (creados, asignados, completados, cancelados)
  - Conflictos (doble asignación, aceptación tardía, etc.)
  - Tasa de pedidos por minuto
  - Latencia promedio

### Dashboard 2: Performance
- **Ubicación**: Home > Remisería - Performance
- **Métricas mostradas**:
  - Latencia p50/p95/p99 de asignación
  - Latencia p50/p95/p99 de aceptación
  - Latencia p50/p95/p99 de rechazo

### Dashboard 3: Operaciones
- **Ubicación**: Home > Remisería - Operaciones
- **Métricas mostradas**:
  - Contadores de pedidos (creados, asignados, completados, cancelados)
  - Acciones idempotentes por tipo
  - Conflictos por tipo

---

## FASE 3: Alertas

### Alertas configuradas en Prometheus

| Alerta | Condición | Severidad | Descripción |
|--------|-----------|-----------|-------------|
| HighLatency | p95 > 1000ms por 2min | warning | Alta latencia en asignación |
| CriticalLatency | p99 > 2000ms por 1min | critical | Latencia crítica |
| HighConflicts | conflictos > 10 por 2min | warning | Alta tasa de conflictos |
| HighIdempotencyRate | idempotentes > 50 por 5min | info | Muchas repeticiones |

### Ver alertas activas

Ir a http://localhost:9090/alerts

### Configuración de Alertmanager

El alertmanager está configurado para enviar webhooks a `http://localhost:3000/webhook`. Para producción, configurar un receiver real (Slack, PagerDuty, email, etc.) en `observability/alertmanager/alertmanager.yml`.

---

## FASE 4: Load Testing + Observabilidad

### Flujo de prueba

1. **Levantar observabilidad** (si no está corriendo):
   ```bash
   cd observability && docker-compose up -d
   ```

2. **Iniciar backend**:
   ```bash
   cd remiseria-backend && npm run dev
   ```

3. **Ejecutar tests de carga**:
   ```bash
   cd remiseria-backend/load-tests
   
   # Test básico - 10 usuarios
   k6 run basic.js
   
   # Test de stress - 50 usuarios
   k6 run -vu 50 full-flow.js
   
   # Test de conflictos - asignaciones concurrentes
   k6 run assign-race.js
   ```

4. **Observar resultados en Grafana**:
   - Abrir dashboard de Performance
   - Observar latencias p95/p99 durante el test
   - Revisar dashboard de Operaciones para ver conflicts e idempotentes

### Métricas esperada bajo carga

| Métrica | Umbral aceptable | Umbral crítico |
|---------|------------------|-----------------|
| p95 latencia | < 500ms | > 1000ms |
| p99 latencia | < 1000ms | > 2000ms |
| tasa de error | < 5% | > 10% |
| conflictos | < 10% de requests | > 20% |

---

## FASE 5: Métricas del Sistema

### Endpoints disponibles

| Endpoint | Formato | Descripción |
|----------|---------|-------------|
| `GET /metrics` | Prometheus | Métricas para scraping |
| `GET /admin/metrics` | JSON | Métricas legibles para humanos |

### Métricas disponibles

#### Contadores (type: counter)
- `remiseria_pedidos_creados_total`
- `remiseria_pedidos_asignados_total`
- `remiseria_pedidos_aceptados_total`
- `remiseria_pedidos_rechazados_total`
- `remiseria_pedidos_completados_total`
- `remiseria_pedidos_cancelados_total`
- `remiseria_acciones_idempotentes_total{tipo}`
- `remiseria_conflictos_total{tipo}`

#### Gauges (type: gauge)
- `remiseria_duracion_asignacion_p50`
- `remiseria_duracion_asignacion_p95`
- `remiseria_duracion_asignacion_p99`
- `remiseria_duracion_asignacion_avg`
- `remiseria_duracion_aceptacion_p50`
- `remiseria_duracion_aceptacion_p95`
- `remiseria_duracion_aceptacion_p99`
- `remiseria_duracion_aceptacion_avg`

---

## Solución de Problemas

### Prometheus no scrapea métricas

1. Verificar que el backend esté corriendo:
   ```bash
   curl http://localhost:3000/metrics
   ```

2. Ver targets en http://localhost:9090/targets

3. Ver logs del contenedor:
   ```bash
   docker logs remiseria-prometheus
   ```

### Grafana no tiene datasource

1. Ir a Configuration > Data Sources
2. Agregar Prometheus con URL: `http://prometheus:9090`

### Dashboard vacío

1. Verificar que Prometheus esté scrapeando (Phase 1)
2. Hacer requests al backend para generar métricas
3. Esperar ~15 segundos para que se reflejen

---

## Producción

### Recomendaciones

1. **Persistencia**: Los dashboards están configurados con volúmenes para persistir datos
2. **Alarmas**: Configurar receiver real en alertmanager para notificaciones
3. **Retención**: Ajustar `--storage.tsdb.retention.time` en docker-compose (default: 15d)
4. **Alta disponibilidad**: En producción, correr múltiples réplicas de Prometheus

### Recursos sugeridos

- Prometheus: 2CPU, 4GB RAM
- Grafana: 1CPU, 1GB RAM
- Alertmanager: 0.5CPU, 512MB RAM