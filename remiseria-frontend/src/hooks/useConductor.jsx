import { useState, useCallback } from 'react';
import axiosInstance from './api/axiosInstance';


const normalizeListResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.trips)) return payload.trips;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

export const useConductor = () => {
  const [driverProfile, setDriverProfile] = useState(null);
  const [viajeActivo, setViajeActivo] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [miEstado, setMiEstado] = useState('OFFLINE');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carga inicial: busca el perfil del chofer y el viaje activo
  const init = useCallback(async (userId) => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Buscar perfil propio del chofer
      const { data: driver } = await axiosInstance.get('/drivers/me');

      if (!driver) {
        setError('No se encontró perfil de chofer para este usuario.');
        return;
      }

      setDriverProfile(driver);
      setMiEstado(driver.estado); // 'DISPONIBLE' | 'OCUPADO' | 'OFFLINE'

      // 2. Buscar si hay un pedido activo asignado a este chofer
      // FIX: usar /orders/active-trips en lugar de GET /orders (que trae todos)
      const { data: activeTripsResponse } = await axiosInstance.get('/orders/active-trips');
      const ESTADOS_ACTIVOS = ['ASIGNADO', 'ACEPTADO', 'EN_CAMINO', 'EN_VIAJE'];
      const activeTrips = normalizeListResponse(activeTripsResponse);

      const pedidoActivo = activeTrips.find(
        o => o.chofer?.id === driver.id && ESTADOS_ACTIVOS.includes(o.estado)
      );

      if (pedidoActivo) {
        setViajeActivo({
          id: pedidoActivo.id,
          estado: pedidoActivo.estado,
          pedido: pedidoActivo,
        });
      }

    } catch (err) {
      setError(err.response?.data?.message || 'Error al inicializar dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Aceptar viaje asignado
  const aceptarViaje = useCallback(async (orderId) => {
    try {
      await axiosInstance.post(`/orders/${orderId}/accept`);
      setViajeActivo(prev => prev ? { ...prev, estado: 'ACEPTADO' } : null);
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'Error al aceptar viaje.');
      return false;
    }
  }, []);

  // Marcar "en camino" (chofer yendo a buscar al cliente)
  const enCamino = useCallback(async (orderId) => {
    try {
      await axiosInstance.post(`/orders/${orderId}/on-the-way`);
      setViajeActivo(prev => prev ? { ...prev, estado: 'EN_CAMINO' } : null);
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'Error al marcar en camino.');
      return false;
    }
  }, []);

  // Iniciar viaje (cliente ya subió)
  const iniciarViaje = useCallback(async (orderId) => {
    try {
      await axiosInstance.post(`/orders/${orderId}/start`);
      setViajeActivo(prev => prev ? { ...prev, estado: 'EN_VIAJE' } : null);
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'Error al iniciar viaje.');
      return false;
    }
  }, []);

  // Finalizar viaje
  const finalizarViaje = useCallback(async (orderId, { montoFinal, metodoPago }) => {
    try {
      await axiosInstance.post(`/orders/${orderId}/finish`, {
        montoFinal: Number(montoFinal),
        metodoPago, // 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA'
      });

      try {
        const { data: history } = await axiosInstance.get('/drivers/me/history?limit=10');
        setHistorial(normalizeListResponse(history));
      } catch {
        void 0;
      }

      setViajeActivo(null);
      setMiEstado('DISPONIBLE');
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'Error al finalizar viaje.');
      return false;
    }
  }, []);

  // Rechazar viaje (chofer)
  const rechazarViaje = useCallback(async (orderId, motivoRechazo) => {
    if (!driverProfile?.id) return false;
    try {
      await axiosInstance.post(`/orders/${orderId}/reject`, {
        driverId: driverProfile.id,
        motivoRechazo,
      });

      try {
        const { data: history } = await axiosInstance.get('/drivers/me/history?limit=10');
        setHistorial(normalizeListResponse(history));
      } catch {
        void 0;
      }

      setViajeActivo(null);
      setMiEstado('DISPONIBLE');
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'Error al rechazar viaje.');
      return false;
    }
  }, [driverProfile]);

  // Actualizar ubicación GPS vía REST
  const actualizarUbicacion = useCallback(async ({ lat, lng, speedKmh, heading }) => {
    try {
      await axiosInstance.patch('/drivers/me/location', { lat, lng, speedKmh, heading });
    } catch {
      // No bloquear el flujo por error de ubicación
    }
  }, []);

  // Limpiar error
  const clearError = useCallback(() => setError(null), []);

  return {
    // Estado
    driverProfile,
    driverId: driverProfile?.id ?? null,
    viajeActivo,
    miEstado,
    historial,
    loading,
    error,

    // Acciones
    init,
    aceptarViaje,
    enCamino,
    iniciarViaje,
    finalizarViaje,
    rechazarViaje,
    actualizarUbicacion,

    // Setters para que el dashboard pueda reaccionar a eventos de socket
    setViajeActivo,
    setMiEstado,
    setHistorial,
    clearError,
  };
};

export default useConductor;