interface MetricsState {
  pedidos: {
    creados: number;
    asignados: number;
    aceptados: number;
    rechazados: number;
    completados: number;
    cancelados: number;
  };
  acciones: {
    asignacionesIdempotentes: number;
    rechazosIdempotentes: number;
    aceptacionesIdempotentes: number;
    cancelacionesIdempotentes: number;
    finishIdempotentes: number;
  };
  conflictos: {
    dobleAsignacion: number;
    aceptacionTardia: number;
    cancelVsAceptacion: number;
    otros: number;
  };
  duracion: {
    asignacion: number[];
    aceptacion: number[];
    rechazo: number[];
    viaje: number[];
  };
  timestamps: {
    ultimoPedidoCreado: string | null;
    ultimoPedidoAsignado: string | null;
    ultimoPedidoAceptado: string | null;
    ultimoPedidoCompletado: string | null;
  };
}

const metrics: MetricsState = {
  pedidos: {
    creados: 0,
    asignados: 0,
    aceptados: 0,
    rechazados: 0,
    completados: 0,
    cancelados: 0,
  },
  acciones: {
    asignacionesIdempotentes: 0,
    rechazosIdempotentes: 0,
    aceptacionesIdempotentes: 0,
    cancelacionesIdempotentes: 0,
    finishIdempotentes: 0,
  },
  conflictos: {
    dobleAsignacion: 0,
    aceptacionTardia: 0,
    cancelVsAceptacion: 0,
    otros: 0,
  },
  duracion: {
    asignacion: [],
    aceptacion: [],
    rechazo: [],
    viaje: [],
  },
  timestamps: {
    ultimoPedidoCreado: null,
    ultimoPedidoAsignado: null,
    ultimoPedidoAceptado: null,
    ultimoPedidoCompletado: null,
  },
};

function incrementPedidoCreado(): void {
  metrics.pedidos.creados++;
  metrics.timestamps.ultimoPedidoCreado = new Date().toISOString();
}

function incrementPedidoAsignado(): void {
  metrics.pedidos.asignados++;
  metrics.timestamps.ultimoPedidoAsignado = new Date().toISOString();
}

function incrementPedidoAceptado(): void {
  metrics.pedidos.aceptados++;
  metrics.timestamps.ultimoPedidoAceptado = new Date().toISOString();
}

function incrementPedidoRechazado(): void {
  metrics.pedidos.rechazados++;
}

function incrementPedidoCompletado(): void {
  metrics.pedidos.completados++;
  metrics.timestamps.ultimoPedidoCompletado = new Date().toISOString();
}

function incrementPedidoCancelado(): void {
  metrics.pedidos.cancelados++;
}

function incrementAccionIdempotente(tipo: string): void {
  if (tipo === "asignacion") metrics.acciones.asignacionesIdempotentes++;
  if (tipo === "rechazo") metrics.acciones.rechazosIdempotentes++;
  if (tipo === "aceptacion") metrics.acciones.aceptacionesIdempotentes++;
  if (tipo === "cancelacion") metrics.acciones.cancelacionesIdempotentes++;
  if (tipo === "finish") metrics.acciones.finishIdempotentes++;
}

function incrementConflicto(tipo: string): void {
  if (tipo === "dobleAsignacion") metrics.conflictos.dobleAsignacion++;
  if (tipo === "aceptacionTardia") metrics.conflictos.aceptacionTardia++;
  if (tipo === "cancelVsAceptacion") metrics.conflictos.cancelVsAceptacion++;
  if (tipo === "otro") metrics.conflictos.otros++;
}

function recordDuracion(tipo: string, durationMs: number): void {
  if (tipo === "asignacion") metrics.duracion.asignacion.push(durationMs);
  if (tipo === "aceptacion") metrics.duracion.aceptacion.push(durationMs);
  if (tipo === "rechazo") metrics.duracion.rechazo.push(durationMs);
  if (tipo === "viaje") metrics.duracion.viaje.push(durationMs);
  
  if (metrics.duracion.asignacion.length > 1000) metrics.duracion.asignacion.shift();
  if (metrics.duracion.aceptacion.length > 1000) metrics.duracion.aceptacion.shift();
  if (metrics.duracion.rechazo.length > 1000) metrics.duracion.rechazo.shift();
  if (metrics.duracion.viaje.length > 1000) metrics.duracion.viaje.shift();
}

function calculatePercentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.floor(sorted.length * (p / 100));
  return sorted[index] || 0;
}

function getMetrics() {
  return {
    pedidos: {
      creados: metrics.pedidos.creados,
      asignados: metrics.pedidos.asignados,
      aceptados: metrics.pedidos.aceptados,
      rechazados: metrics.pedidos.rechazados,
      completados: metrics.pedidos.completados,
      cancelados: metrics.pedidos.cancelados,
    },
    accionesIdempotentes: {
      asignaciones: metrics.acciones.asignacionesIdempotentes,
      rechazos: metrics.acciones.rechazosIdempotentes,
      aceptaciones: metrics.acciones.aceptacionesIdempotentes,
      cancelaciones: metrics.acciones.cancelacionesIdempotentes,
      finishes: metrics.acciones.finishIdempotentes,
    },
    conflictos: {
      dobleAsignacion: metrics.conflictos.dobleAsignacion,
      aceptacionTardia: metrics.conflictos.aceptacionTardia,
      cancelVsAceptacion: metrics.conflictos.cancelVsAceptacion,
      otros: metrics.conflictos.otros,
    },
    duracion: {
      asignacion: {
        p50: calculatePercentile(metrics.duracion.asignacion, 50),
        p95: calculatePercentile(metrics.duracion.asignacion, 95),
        p99: calculatePercentile(metrics.duracion.asignacion, 99),
        avg: metrics.duracion.asignacion.length > 0 
          ? metrics.duracion.asignacion.reduce((a, b) => a + b, 0) / metrics.duracion.asignacion.length 
          : 0,
      },
      aceptacion: {
        p50: calculatePercentile(metrics.duracion.aceptacion, 50),
        p95: calculatePercentile(metrics.duracion.aceptacion, 95),
        p99: calculatePercentile(metrics.duracion.aceptacion, 99),
        avg: metrics.duracion.aceptacion.length > 0 
          ? metrics.duracion.aceptacion.reduce((a, b) => a + b, 0) / metrics.duracion.aceptacion.length 
          : 0,
      },
      rechazo: {
        p50: calculatePercentile(metrics.duracion.rechazo, 50),
        p95: calculatePercentile(metrics.duracion.rechazo, 95),
        p99: calculatePercentile(metrics.duracion.rechazo, 99),
        avg: metrics.duracion.rechazo.length > 0 
          ? metrics.duracion.rechazo.reduce((a, b) => a + b, 0) / metrics.duracion.rechazo.length 
          : 0,
      },
    },
    timestamps: {
      ultimoPedidoCreado: metrics.timestamps.ultimoPedidoCreado,
      ultimoPedidoAsignado: metrics.timestamps.ultimoPedidoAsignado,
      ultimoPedidoAceptado: metrics.timestamps.ultimoPedidoAceptado,
      ultimoPedidoCompletado: metrics.timestamps.ultimoPedidoCompletado,
    },
  };
}

function getPrometheusMetrics(): string {
  const lines: string[] = [];
  const now = Math.floor(Date.now() / 1000);

  lines.push(`# HELP remiseria_pedidos_creados_total Total de pedidos creados`);
  lines.push(`# TYPE remiseria_pedidos_creados_total counter`);
  lines.push(`remiseria_pedidos_creados_total ${metrics.pedidos.creados}`);

  lines.push(`# HELP remiseria_pedidos_asignados_total Total de pedidos asignados`);
  lines.push(`# TYPE remiseria_pedidos_asignados_total counter`);
  lines.push(`remiseria_pedidos_asignados_total ${metrics.pedidos.asignados}`);

  lines.push(`# HELP remiseria_pedidos_aceptados_total Total de pedidos aceptados`);
  lines.push(`# TYPE remiseria_pedidos_aceptados_total counter`);
  lines.push(`remiseria_pedidos_aceptados_total ${metrics.pedidos.aceptados}`);

  lines.push(`# HELP remiseria_pedidos_rechazados_total Total de pedidos rechazados`);
  lines.push(`# TYPE remiseria_pedidos_rechazados_total counter`);
  lines.push(`remiseria_pedidos_rechazados_total ${metrics.pedidos.rechazados}`);

  lines.push(`# HELP remiseria_pedidos_completados_total Total de pedidos completados`);
  lines.push(`# TYPE remiseria_pedidos_completados_total counter`);
  lines.push(`remiseria_pedidos_completados_total ${metrics.pedidos.completados}`);

  lines.push(`# HELP remiseria_pedidos_cancelados_total Total de pedidos cancelados`);
  lines.push(`# TYPE remiseria_pedidos_cancelados_total counter`);
  lines.push(`remiseria_pedidos_cancelados_total ${metrics.pedidos.cancelados}`);

  lines.push(`# HELP remiseria_acciones_idempotentes_total Total de acciones idempotentes`);
  lines.push(`# TYPE remiseria_acciones_idempotentes_total counter`);
  lines.push(`remiseria_acciones_idempotentes_total{tipo="asignacion"} ${metrics.acciones.asignacionesIdempotentes}`);
  lines.push(`remiseria_acciones_idempotentes_total{tipo="rechazo"} ${metrics.acciones.rechazosIdempotentes}`);
  lines.push(`remiseria_acciones_idempotentes_total{tipo="aceptacion"} ${metrics.acciones.aceptacionesIdempotentes}`);
  lines.push(`remiseria_acciones_idempotentes_total{tipo="cancelacion"} ${metrics.acciones.cancelacionesIdempotentes}`);
  lines.push(`remiseria_acciones_idempotentes_total{tipo="finish"} ${metrics.acciones.finishIdempotentes}`);

  lines.push(`# HELP remiseria_conflictos_total Total de conflictos`);
  lines.push(`# TYPE remiseria_conflictos_total counter`);
  lines.push(`remiseria_conflictos_total{tipo="dobleAsignacion"} ${metrics.conflictos.dobleAsignacion}`);
  lines.push(`remiseria_conflictos_total{tipo="aceptacionTardia"} ${metrics.conflictos.aceptacionTardia}`);
  lines.push(`remiseria_conflictos_total{tipo="cancelVsAceptacion"} ${metrics.conflictos.cancelVsAceptacion}`);
  lines.push(`remiseria_conflictos_total{tipo="otros"} ${metrics.conflictos.otros}`);

  const assignP50 = calculatePercentile(metrics.duracion.asignacion, 50);
  const assignP95 = calculatePercentile(metrics.duracion.asignacion, 95);
  const assignP99 = calculatePercentile(metrics.duracion.asignacion, 99);
  const assignAvg = metrics.duracion.asignacion.length > 0
    ? metrics.duracion.asignacion.reduce((a, b) => a + b, 0) / metrics.duracion.asignacion.length
    : 0;

  lines.push(`# HELP remiseria_duracion_asignacion_p50 Latencia p50 de asignación en milisegundos`);
  lines.push(`# TYPE remiseria_duracion_asignacion_p50 gauge`);
  lines.push(`remiseria_duracion_asignacion_p50 ${assignP50}`);

  lines.push(`# HELP remiseria_duracion_asignacion_p95 Latencia p95 de asignación en milisegundos`);
  lines.push(`# TYPE remiseria_duracion_asignacion_p95 gauge`);
  lines.push(`remiseria_duracion_asignacion_p95 ${assignP95}`);

  lines.push(`# HELP remiseria_duracion_asignacion_p99 Latencia p99 de asignación en milisegundos`);
  lines.push(`# TYPE remiseria_duracion_asignacion_p99 gauge`);
  lines.push(`remiseria_duracion_asignacion_p99 ${assignP99}`);

  lines.push(`# HELP remiseria_duracion_asignacion_avg Latencia promedio de asignación en milisegundos`);
  lines.push(`# TYPE remiseria_duracion_asignacion_avg gauge`);
  lines.push(`remiseria_duracion_asignacion_avg ${assignAvg}`);

  const acceptP50 = calculatePercentile(metrics.duracion.aceptacion, 50);
  const acceptP95 = calculatePercentile(metrics.duracion.aceptacion, 95);
  const acceptP99 = calculatePercentile(metrics.duracion.aceptacion, 99);
  const acceptAvg = metrics.duracion.aceptacion.length > 0
    ? metrics.duracion.aceptacion.reduce((a, b) => a + b, 0) / metrics.duracion.aceptacion.length
    : 0;

  lines.push(`# HELP remiseria_duracion_aceptacion_p50 Latencia p50 de aceptación en milisegundos`);
  lines.push(`# TYPE remiseria_duracion_aceptacion_p50 gauge`);
  lines.push(`remiseria_duracion_aceptacion_p50 ${acceptP50}`);

  lines.push(`# HELP remiseria_duracion_aceptacion_p95 Latencia p95 de aceptación en milisegundos`);
  lines.push(`# TYPE remiseria_duracion_aceptacion_p95 gauge`);
  lines.push(`remiseria_duracion_aceptacion_p95 ${acceptP95}`);

  lines.push(`# HELP remiseria_duracion_aceptacion_p99 Latencia p99 de aceptación en milisegundos`);
  lines.push(`# TYPE remiseria_duracion_aceptacion_p99 gauge`);
  lines.push(`remiseria_duracion_aceptacion_p99 ${acceptP99}`);

  lines.push(`# HELP remiseria_duracion_aceptacion_avg Latencia promedio de aceptación en milisegundos`);
  lines.push(`# TYPE remiseria_duracion_aceptacion_avg gauge`);
  lines.push(`remiseria_duracion_aceptacion_avg ${acceptAvg}`);

  return lines.join("\n");
}

export {
  metrics,
  incrementPedidoCreado,
  incrementPedidoAsignado,
  incrementPedidoAceptado,
  incrementPedidoRechazado,
  incrementPedidoCompletado,
  incrementPedidoCancelado,
  incrementAccionIdempotente,
  incrementConflicto,
  recordDuracion,
  getMetrics,
  getPrometheusMetrics,
};