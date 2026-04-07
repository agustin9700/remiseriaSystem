# Load Testing - Sistema de Remisería

## Requisitos

Instalar k6:
```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C748E8FAF20E4E2D1F3B2A2C9F2FD8B6C0
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6
```

## Scripts Disponibles

### 1. basic.js - Creación de pedidos
Simula creación de pedidos por múltiples operadores.

```bash
k6 run load-tests/basic.js
```

### 2. assign-race.js - Carreras de asignación
Simula múltiples solicitudes de asignación simultáneas.

```bash
k6 run load-tests/assign-race.js
```

### 3. full-flow.js - Flujo completo
SimulaOperators creando pedidos y asignando choferes.

```bash
k6 run load-tests/full-flow.js
```

## Métricas a Monitorear

### Tiempos de respuesta
- p(95) < 500ms para operações básicas
- p(95) < 1000ms para flujos completos

### Tasas de error
- errors < 5%
- conflicts < 10%

###throughput
- requests completadas por segundo
- tiempo promedio por request

## Entorno

Establecer variable de entorno para API:
```bash
export API_URL=http://localhost:3000
k6 run load-tests/basic.js
```

## Interpretación de Resultados

### Escenario Saludable
- Success rate > 95%
- p95 latency < 500ms
- No hay errores de base de datos

### Escenario con Problemas
- Alta tasa de conflictos (409)
- Latencia creciente
- Errores de timeout

## Recomendaciones

1. Comenzar con básico (10 usuarios)
2. Aumentar gradualmente (50 usuarios)
3. Escenario de estrés (100+ usuarios)
4. Monitorear métricas del sistema