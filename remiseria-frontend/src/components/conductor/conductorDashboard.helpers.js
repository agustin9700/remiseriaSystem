/** Constantes y helpers puros del panel del conductor (sin efectos). */

export const POSITION_SEND_INTERVAL_MS = 10000;
export const POLLING_INTERVAL_MS = 8000;

export const ESTADOS_ACTIVOS = ['ASIGNADO', 'ACEPTADO', 'EN_CAMINO', 'EN_VIAJE'];

export const estadoColor = {
  ASIGNADO: 'warning',
  ACEPTADO: 'info',
  EN_CAMINO: 'primary',
  EN_VIAJE: 'success',
};

export const normalizeCollection = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.trips)) return payload.trips;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

export const devWarn = (...args) => {
  if (import.meta.env.DEV) {
    console.warn(...args);
  }
};

/**
 * Primer pedido activo asignado al chofer actual (misma lógica que antes en el dashboard).
 */
export const findActiveTripForDriver = (pedidos, currentDriverId) =>
  pedidos.find(
    (p) =>
      ESTADOS_ACTIVOS.includes(p.estado) &&
      (String(p.chofer?.id) === String(currentDriverId) ||
        String(p.choferId) === String(currentDriverId))
  ) || null;

export const getNombreCliente = (p) => p?.cliente?.nombre || p?.nombreCliente || 'N/A';
export const getTelefonoCliente = (p) => p?.cliente?.telefono || p?.telefonoCliente || '';
export const getOrigen = (p) => p?.viaje?.origen || p?.origenTexto || 'No especificado';
export const getDestino = (p) => p?.viaje?.destino || p?.destinoTexto || 'No especificado';
export const getObservaciones = (p) => p?.viaje?.observaciones || p?.observaciones || null;

export const formatearFechaHistorial = (item) => {
  const fecha = item?.fecha || item?.completadoAt || item?.canceladoAt || null;
  const fechaTexto = fecha ? new Date(fecha).toLocaleString() : 'Sin fecha';

  if (item?.eventoHistorial === 'RECHAZADO_POR_CHOFER') {
    return `Rechazado por vos · ${fechaTexto}`;
  }

  if (item?.estadoActual === 'COMPLETADO') {
    return `Completado · ${fechaTexto}`;
  }

  if (item?.estadoActual === 'CANCELADO') {
    return `Cancelado · ${fechaTexto}`;
  }

  if (item?.estadoActual === 'RECHAZADO') {
    return `Rechazado por operador · ${fechaTexto}`;
  }

  return fechaTexto;
};
