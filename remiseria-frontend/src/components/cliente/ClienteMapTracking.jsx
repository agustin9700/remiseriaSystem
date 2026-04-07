import { useEffect, useMemo, useState, useCallback } from 'react';
import { Alert, Card, Spinner } from 'react-bootstrap';
import { FaCar, FaMapMarkerAlt } from 'react-icons/fa';
import axiosInstance from '../../hooks/api/axiosInstance';
import { useClienteSocket } from '../../hooks/useSocket';

const POLLING_MS = 5000;

const normalizeViaje = (data) => data || null;

const ClienteMapTracking = ({ codigo, viaje: viajeProp, onViajeUpdate }) => {
  const [viaje, setViaje] = useState(normalizeViaje(viajeProp));
  const [loading, setLoading] = useState(!viajeProp && !!codigo);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const { isConnected, subscribe, joinTrip, leaveTrip } = useClienteSocket();

  const codigoViaje = useMemo(() => codigo || viajeProp?.codigo || viaje?.codigo || null, [codigo, viajeProp, viaje]);
  const viajeId = viajeProp?.id || viaje?.id || null;
  const conductorPosition = useMemo(() => {
    const lat = viaje?.chofer?.latitud;
    const lng = viaje?.chofer?.longitud;
    if (lat == null || lng == null) return null;
    return { lat, lng };
  }, [viaje]);

  const applyViajeUpdate = useCallback((nextViaje, timestamp) => {
    const normalized = normalizeViaje(nextViaje);
    setViaje(normalized);
    onViajeUpdate?.(normalized);
    if (normalized?.chofer?.latitud != null && normalized?.chofer?.longitud != null) {
      setLastUpdate(new Date(timestamp || Date.now()));
    }
  }, [onViajeUpdate]);

  useEffect(() => {
    if (viajeProp) {
      applyViajeUpdate(viajeProp);
      setLoading(false);
    }
  }, [viajeProp, applyViajeUpdate]);

  const fetchTracking = useCallback(async () => {
    if (!codigoViaje) return;
    const { data } = await axiosInstance.get(`/orders/track/${codigoViaje}`);
    applyViajeUpdate(data || null);
    setError('');
  }, [codigoViaje, applyViajeUpdate]);

  useEffect(() => {
    if (!codigoViaje || viajeProp) return undefined;

    let cancelled = false;

    const run = async () => {
      try {
        await fetchTracking();
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.message || 'No se pudo obtener el tracking del viaje.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    const interval = setInterval(run, POLLING_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [codigoViaje, viajeProp, fetchTracking]);

  useEffect(() => {
    if (!isConnected || !viajeId) return undefined;

    joinTrip(viajeId);
    fetchTracking().catch(() => {});

    const unsubscribe = subscribe('viaje:positionUpdated', (payload) => {
      if (String(payload?.viajeId) !== String(viajeId)) return;
      setViaje((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          chofer: {
            ...(prev.chofer || {}),
            latitud: payload.lat,
            longitud: payload.lng,
          },
        };
        onViajeUpdate?.(next);
        return next;
      });
      setLastUpdate(new Date(payload.timestamp || Date.now()));
    });

    return () => {
      unsubscribe?.();
      leaveTrip?.(viajeId);
    };
  }, [isConnected, viajeId, joinTrip, leaveTrip, subscribe, fetchTracking, onViajeUpdate]);

  if (loading) {
    return <div className="p-3"><Spinner animation="border" size="sm" className="me-2" />Cargando tracking...</div>;
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  if (!viaje) {
    return <Alert variant="warning">No hay información de viaje disponible.</Alert>;
  }

  return (
    <div className="cliente-map-tracking">
      <Card>
        <Card.Body>
          <h5 className="mb-3">Seguimiento del viaje {viaje.codigo ? `#${viaje.codigo}` : ''}</h5>
          <div className="mb-2"><FaMapMarkerAlt className="text-success me-2" /><strong>Origen:</strong> {viaje.viaje?.origen || viaje.origenTexto || 'No disponible'}</div>
          <div className="mb-2"><FaMapMarkerAlt className="text-danger me-2" /><strong>Destino:</strong> {viaje.viaje?.destino || viaje.destinoTexto || 'No disponible'}</div>
          <div className="mb-2"><FaCar className="me-2" /><strong>Estado:</strong> {viaje.estado}</div>
          {viaje.chofer && (
            <div className="mb-2">
              <strong>Chofer:</strong> {viaje.chofer.nombre} {viaje.chofer.apellido || ''}
            </div>
          )}
          {conductorPosition ? (
            <Alert variant="info" className="mt-3 mb-0">
              <div><strong>Última ubicación recibida</strong></div>
              <div>Lat: {Number(conductorPosition.lat).toFixed(6)}</div>
              <div>Lng: {Number(conductorPosition.lng).toFixed(6)}</div>
              {lastUpdate && <small className="text-muted">Actualizado: {lastUpdate.toLocaleTimeString()}</small>}
            </Alert>
          ) : (
            <Alert variant="secondary" className="mt-3 mb-0">Todavía no hay ubicación del conductor disponible.</Alert>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default ClienteMapTracking;
