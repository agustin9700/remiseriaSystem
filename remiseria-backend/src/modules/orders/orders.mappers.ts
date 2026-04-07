import { OrderWithDriver } from "./orders.repository";

export function toOrderDto(order: OrderWithDriver) {
  return {
    id: order.id,
    codigo: order.codigo,
    estado: order.estado,
    choferId: order.chofer?.id ?? null,
    cliente: {
      nombre: order.nombreCliente,
      telefono: order.telefonoCliente,
    },
    viaje: {
      origen: order.origenTexto,
      origenLat: order.origenLat,
      origenLng: order.origenLng,
      destino: order.destinoTexto,
      destinoLat: order.destinoLat,
      destinoLng: order.destinoLng,
      observaciones: order.observaciones,
      montoFinal: order.montoFinal,
      metodoPago: order.metodoPago,
    },
    estados: {
      motivoCancelacion: order.motivoCancelacion,
      motivoRechazo: order.motivoRechazo,
    },
    timestamps: {
      asignadoAt: order.asignadoAt,
      aceptadoAt: order.aceptadoAt,
      enCaminoAt: order.enCaminoAt,
      iniciadoAt: order.iniciadoAt,
      completadoAt: order.completadoAt,
      canceladoAt: order.canceladoAt,
    },
    chofer: order.chofer
      ? {
          id: order.chofer.id,
          userId: order.chofer.user?.id ?? null,
          nombre: order.chofer.user?.nombre,
          apellido: order.chofer.user?.apellido,
          telefono: order.chofer.user?.telefono,
          estado: order.chofer.estado,
          vehiculoMarca: order.chofer.vehiculoMarca,
          vehiculoModelo: order.chofer.vehiculoModelo,
          vehiculoColor: order.chofer.vehiculoColor,
          patente: order.chofer.patente,
          licenciaNumero: order.chofer.licenciaNumero,
          latitud: order.chofer.latitud,
          longitud: order.chofer.longitud,
        }
      : null,
  };
}

export function toOrderDetailDto(order: OrderWithDriver) {
  return {
    id: order.id,
    codigo: order.codigo,
    estado: order.estado,
    choferId: order.chofer?.id ?? null,
    cliente: {
      nombre: order.nombreCliente,
      telefono: order.telefonoCliente,
    },
    viaje: {
      origen: order.origenTexto,
      origenLat: order.origenLat,
      origenLng: order.origenLng,
      destino: order.destinoTexto,
      destinoLat: order.destinoLat,
      destinoLng: order.destinoLng,
      observaciones: order.observaciones,
    },
    chofer: order.chofer
      ? {
          id: order.chofer.id,
          userId: order.chofer.user?.id ?? null,
          nombre: order.chofer.user?.nombre,
          apellido: order.chofer.user?.apellido,
          telefono: order.chofer.user?.telefono,
          estado: order.chofer.estado,
          licenciaNumero: order.chofer.licenciaNumero,
          latitud: order.chofer.latitud,
          longitud: order.chofer.longitud,
          vehiculo: {
            marca: order.chofer.vehiculoMarca,
            modelo: order.chofer.vehiculoModelo,
            color: order.chofer.vehiculoColor,
            patente: order.chofer.patente,
          },
        }
      : null,
    montos: {
      estimado: order.montoEstimado,
      final: order.montoFinal,
      metodoPago: order.metodoPago,
    },
    estados: {
      motivoRechazo: order.motivoRechazo,
      motivoCancelacion: order.motivoCancelacion,
    },
    timestamps: {
      createdAt: order.createdAt,
      asignadoAt: order.asignadoAt,
      aceptadoAt: order.aceptadoAt,
      enCaminoAt: order.enCaminoAt,
      iniciadoAt: order.iniciadoAt,
      completadoAt: order.completadoAt,
      canceladoAt: order.canceladoAt,
    },
  };
}
