import { useEffect, useRef, useCallback } from 'react';
import { useSocket } from './useSocket';

const POLLING_INTERVAL_MS = 6000;
const REHYDRATE_INTERVAL_MS = 30000;

/**
 * Maneja toda la lógica de tiempo real (socket) y fallback de polling
 * para la página de pedidos. Cuando el socket está activo, escucha
 * eventos y actualiza el estado. Cuando no, hace polling cada 6s.
 *
 * @param {object} params
 * @param {function} params.setPedidos  - setter del estado de pedidos
 * @param {function} params.fetchPedidos - función que trae pedidos del server
 * @param {function} params.setUbicacionChoferLive - setter para la ubicación live del chofer
 */
export function usePedidosSocket({ setPedidos, fetchPedidos, setUbicacionChoferLive }) {
  const { isConnected, subscribe } = useSocket();
  const previousDataRef = useRef(null);
  const rehydrateTimeoutRef = useRef(null);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const removerPedidoDeTodasLasListas = useCallback((prev, pedidoId) => ({
    ...prev,
    pendientes: prev.pendientes.filter((p) => p.id !== pedidoId),
    asignados:  prev.asignados.filter((p)  => p.id !== pedidoId),
    en_curso:   prev.en_curso.filter((p)   => p.id !== pedidoId),
    finalizados: prev.finalizados.filter((p) => p.id !== pedidoId),
    cancelados: prev.cancelados.filter((p)  => p.id !== pedidoId),
  }), []);

  const computeHash = useCallback((data) => {
    const all = [
      ...data.pendientes,
      ...data.asignados,
      ...data.en_curso,
      ...data.finalizados,
      ...data.cancelados,
    ];
    return all
      .map((p) => `${p.id}:${p.estado}:${p.timestamps?.updatedAt ?? p.updatedAt ?? ''}`)
      .join('|');
  }, []);

  const notificarNuevoPedido = useCallback((pedido) => {
    // Sonido
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // AudioContext no disponible en todos los contextos
    }

    // Notificación del sistema
    if (Notification?.permission === 'granted') {
      new Notification('🚖 Nuevo pedido recibido', {
        body: `${pedido.cliente?.nombre ?? pedido.nombreCliente ?? ''} — ${pedido.viaje?.origen ?? pedido.origenTexto ?? ''}`,
        icon: '/vite.svg',
      });
    }
  }, []);

  const scheduleRehydrate = useCallback(() => {
    if (rehydrateTimeoutRef.current) {
      clearTimeout(rehydrateTimeoutRef.current);
    }

    rehydrateTimeoutRef.current = setTimeout(async () => {
      try {
        const data = await fetchPedidos(true);
        if (data) {
          previousDataRef.current = data;
          setPedidos(data);
        }
      } catch (err) {
        console.error('Error rehidratando panel desde API:', err);
      }
    }, 300);
  }, [fetchPedidos, setPedidos]);

  // ── Polling (fallback cuando no hay socket) ──────────────────────────────────

  useEffect(() => {
    if (isConnected) return;

    const fetchConComparacion = async () => {
      try {
        const data = await fetchPedidos(true);
        if (!data) return;
        const newHash  = computeHash(data);
        const prevHash = previousDataRef.current ? computeHash(previousDataRef.current) : null;

        if (newHash !== prevHash) {
          previousDataRef.current = data;
          setPedidos(data);
        }
      } catch (err) {
        console.error('Error polling pedidos:', err);
      }
    };

    const interval = setInterval(fetchConComparacion, POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isConnected, fetchPedidos, setPedidos, computeHash]);

  // ── Listeners de socket ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!isConnected) return;

    const handleNuevoPedido = (nuevoPedido) => {
      setPedidos((prev) => {
        const yaExiste = [
          ...prev.pendientes, ...prev.asignados, ...prev.en_curso,
          ...prev.finalizados, ...prev.cancelados,
        ].some((p) => p.id === nuevoPedido.id);

        if (yaExiste) return prev;

        notificarNuevoPedido(nuevoPedido);

        return { ...prev, pendientes: [nuevoPedido, ...prev.pendientes] };
      });
      scheduleRehydrate();
    };

    const handlePedidoActualizado = (pedidoActualizado) => {
      setPedidos((prev) => {
        const limpio = removerPedidoDeTodasLasListas(prev, pedidoActualizado.id);

        switch (pedidoActualizado.estado) {
          case 'PENDIENTE':
            return { ...limpio, pendientes: [pedidoActualizado, ...limpio.pendientes] };
          case 'ASIGNADO':
            return { ...limpio, asignados: [pedidoActualizado, ...limpio.asignados] };
          case 'ACEPTADO':
          case 'EN_CAMINO':
          case 'EN_VIAJE':
            return { ...limpio, en_curso: [pedidoActualizado, ...limpio.en_curso] };
          case 'COMPLETADO':
            return { ...limpio, finalizados: [pedidoActualizado, ...limpio.finalizados] };
          case 'CANCELADO':
          case 'RECHAZADO':
            return { ...limpio, cancelados: [pedidoActualizado, ...limpio.cancelados] };
          default:
            return limpio;
        }
      });
      scheduleRehydrate();
    };

    const handleDriverLocation = (rawData) => {
      const data = {
        ...rawData,
        driverId: rawData?.driverId ?? rawData?.choferId ?? null,
      };
      if (!data.driverId) return;

      setPedidos((prev) => {
        const actualizarUbicacion = (lista) =>
          lista.map((p) =>
            p.chofer?.id === data.driverId
              ? { ...p, chofer: { ...p.chofer, latitud: data.lat, longitud: data.lng } }
              : p
          );

        return {
          ...prev,
          pendientes: actualizarUbicacion(prev.pendientes),
          asignados:  actualizarUbicacion(prev.asignados),
          en_curso:   actualizarUbicacion(prev.en_curso),
        };
      });

      setUbicacionChoferLive({ lat: data.lat, lng: data.lng, choferId: data.driverId });
    };

    const unsubscribeNuevoPedido = subscribe('nuevo_pedido', handleNuevoPedido);
    const unsubscribePedidoActualizado = subscribe('pedido:actualizado', handlePedidoActualizado);
    const unsubscribeDriverLocation = subscribe('driver:location', handleDriverLocation);
    return () => {
      unsubscribeNuevoPedido();
      unsubscribePedidoActualizado();
      unsubscribeDriverLocation();
      if (rehydrateTimeoutRef.current) {
        clearTimeout(rehydrateTimeoutRef.current);
      }
    };
  }, [isConnected, subscribe, setPedidos, setUbicacionChoferLive, removerPedidoDeTodasLasListas, notificarNuevoPedido, scheduleRehydrate]);

  // Aun con socket conectado, rehidratar periódicamente desde API para evitar drift
  // por eventos perdidos durante reconexiones o caídas de red.
  useEffect(() => {
    const tick = async () => {
      try {
        const data = await fetchPedidos(true);
        if (data) {
          previousDataRef.current = data;
          setPedidos(data);
        }
      } catch (err) {
        console.error('Error en rehidratación periódica:', err);
      }
    };

    tick();
    const interval = setInterval(tick, REHYDRATE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [fetchPedidos, setPedidos]);

  // Rehidratar inmediato al reconectar para evitar drift por eventos perdidos
  // durante desconexiones.
  useEffect(() => {
    if (!isConnected) return;
    scheduleRehydrate();
  }, [isConnected, scheduleRehydrate]);

  // Si el navegador vuelve a tener conectividad (p.ej. Playwright setOffline(false)),
  // rehidratamos para garantizar consistencia de panel.
  useEffect(() => {
    const onOnline = () => scheduleRehydrate();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [scheduleRehydrate]);

  return { isConnected };
}
