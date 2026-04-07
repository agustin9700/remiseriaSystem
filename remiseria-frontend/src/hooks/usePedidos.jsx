import { useState, useEffect, useCallback } from 'react';
import axiosInstance from './api/axiosInstance';

const normalizeOrdersPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.trips)) return payload.trips;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

export const usePedidos = () => {
  const [pedidos, setPedidos] = useState({
    pendientes: [],
    asignados: [],
    en_curso: [],
    finalizados: [],
    cancelados: [],
    choferesLibres: [],
    choferesOcupados: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const mapMetodoPago = (metodo) => {
    const metodoPagoMap = {
      efectivo: 'EFECTIVO',
      transferencia: 'TRANSFERENCIA',
      tarjeta: 'TARJETA'
    };

    return metodoPagoMap[metodo?.toLowerCase()] || metodo;
  };

  const procesarPedidos = useCallback((ordersData = [], driversData = []) => {
    const todos = Array.isArray(ordersData) ? ordersData : [];
    const choferes = Array.isArray(driversData) ? driversData : [];

    const filtrarPorEstado = (data, estado) => data.filter((p) => p.estado === estado);

    return {
      pendientes: filtrarPorEstado(todos, 'PENDIENTE'),
      asignados: filtrarPorEstado(todos, 'ASIGNADO'),
      en_curso: [
        ...filtrarPorEstado(todos, 'ACEPTADO'),
        ...filtrarPorEstado(todos, 'EN_CAMINO'),
        ...filtrarPorEstado(todos, 'EN_VIAJE')
      ],
      finalizados: filtrarPorEstado(todos, 'COMPLETADO'),
      cancelados: [
        ...filtrarPorEstado(todos, 'CANCELADO'),
        ...filtrarPorEstado(todos, 'RECHAZADO')
      ],
      choferesLibres: choferes.filter((c) => c.estado === 'DISPONIBLE'),
      choferesOcupados: choferes.filter((c) => c.estado === 'OCUPADO')
    };
  }, []);

  const fetchAllOrders = useCallback(async () => {
    const limit = 200;
    let page = 1;
    let allOrders = [];
    let expectedTotal = null;

    while (true) {
      const response = await axiosInstance.get('/orders', { params: { page, limit } });
      const payloadOrders = normalizeOrdersPayload(response.data);
      allOrders = allOrders.concat(payloadOrders);

      const totalFromApi = Number(response.data?.total);
      if (Number.isFinite(totalFromApi)) {
        expectedTotal = totalFromApi;
      }

      if (payloadOrders.length < limit) break;
      if (expectedTotal !== null && allOrders.length >= expectedTotal) break;

      page += 1;
      if (page > 50) break;
    }

    return allOrders;
  }, []);

  const fetchPedidos = useCallback(
    async (returnData = false) => {
      if (!returnData) {
        setLoading(true);
        setError(null);
      }

      try {
        const [orders, resChoferes] = await Promise.all([
          fetchAllOrders(),
          axiosInstance.get('/drivers')
        ]);

        const dataProcesada = procesarPedidos(orders, resChoferes.data);

        if (returnData) {
          return dataProcesada;
        }

        setPedidos(dataProcesada);
        return dataProcesada;
      } catch (err) {
        console.error('Error en fetchPedidos:', err);

        if (!returnData) {
          setError(err.response?.data?.message || 'Error al cargar los pedidos');
        }

        throw err;
      } finally {
        if (!returnData) {
          setLoading(false);
        }
      }
    },
    [fetchAllOrders, procesarPedidos]
  );

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  const crearPedido = async (pedidoData) => {
    try {
      setLoading(true);
      setError(null);

      const res = await axiosInstance.post('/orders', pedidoData);

      // No tocar setPedidos acá.
      // El alta entra por socket: "nuevo_pedido"
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear el pedido');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const asignarPedido = async (id, driverId) => {
    try {
      setLoading(true);
      setError(null);

      const res = await axiosInstance.post(`/orders/${id}/assign-driver`, { driverId });

      // No tocar setPedidos acá.
      // La actualización entra por socket: "pedido:actualizado"
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Error al asignar el pedido');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const iniciarPedido = async (id) => {
    try {
      setLoading(true);
      setError(null);

      const res = await axiosInstance.post(`/orders/${id}/start`);

      // No fetchPedidos, lo actualiza socket
      return res.data;
    } catch (error) {
      setError(error.response?.data?.message || 'Error al iniciar el pedido');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const finalizarPedido = async (id, { precio, metodo_pago }) => {
    try {
      if (!id) throw new Error('ID de pedido inválido');
      if (!precio || isNaN(precio)) throw new Error('Precio inválido');
      if (!metodo_pago) throw new Error('Método de pago requerido');

      const response = await axiosInstance.post(`/orders/${id}/finish`, {
        montoFinal: Number(precio),
        metodoPago: mapMetodoPago(metodo_pago)
      });

      // No tocar setPedidos acá.
      // Lo actualiza socket
      return response.data;
    } catch (error) {
      console.error('Error al finalizar pedido:', error);
      throw error;
    }
  };

  const finalizarPedidoPorOperador = async (id, { precio, metodo_pago, nota }) => {
    try {
      if (!id) throw new Error('ID de pedido inválido');
      if (!precio || isNaN(precio)) throw new Error('Precio inválido');
      if (!metodo_pago) throw new Error('Método de pago requerido');

      const response = await axiosInstance.post(`/orders/${id}/finish-by-operator`, {
        montoFinal: Number(precio),
        metodoPago: mapMetodoPago(metodo_pago),
        ...(nota ? { nota } : {})
      });

      // No tocar setPedidos acá.
      // Lo actualiza socket
      return response.data;
    } catch (error) {
      console.error('Error operador finalizando:', error);
      throw error;
    }
  };

  const cancelarPedido = async (id, motivoCancelacion = 'Cancelado por operador') => {
    try {
      setLoading(true);
      setError(null);
  
      const res = await axiosInstance.post(`/orders/${id}/cancel`, {
        motivoCancelacion
      });
  
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cancelar el pedido');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const reasignarPedido = async (id) => {
    try {
      setLoading(true);
      setError(null);

      const res = await axiosInstance.post(`/orders/${id}/unassign`);

      // No fetchPedidos, lo actualiza socket
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Error al reasignar el pedido');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getPedidoById = async (id) => {
    try {
      setLoading(true);
      setError(null);

      const res = await axiosInstance.get(`/orders/${id}`);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Error al obtener el pedido');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    pedidos,
    setPedidos,
    loading,
    error,
    fetchPedidos,
    crearPedido,
    asignarPedido,
    iniciarPedido,
    finalizarPedido,
    finalizarPedidoPorOperador,
    cancelarPedido,
    getPedidoById,
    reasignarPedido
  };
};