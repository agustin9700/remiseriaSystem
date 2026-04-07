import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Container, Row, Col, Card, Alert,
} from 'react-bootstrap';
import { useConductorSocket } from '../hooks/useSocket';
import { useLeafletMap } from '../hooks/useLeafletMap';
import axiosInstance from '../hooks/api/axiosInstance';
import { getUserFromToken } from '../utils/auth';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PageHeader, Skeleton } from '../components/ui';
import ConductorDashboardHeader from '../components/conductor/ConductorDashboardHeader';
import ConductorMapCard from '../components/conductor/ConductorMapCard';
import ConductorTripPanel from '../components/conductor/ConductorTripPanel';
import ConductorHistoryCard from '../components/conductor/ConductorHistoryCard';
import ConductorFinishModal from '../components/conductor/ConductorFinishModal';
import {
  POSITION_SEND_INTERVAL_MS,
  POLLING_INTERVAL_MS,
  normalizeCollection,
  findActiveTripForDriver,
  devWarn,
} from '../components/conductor/conductorDashboard.helpers';

// Fix de iconos por defecto de Leaflet con bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const ConductorDashboard = () => {
  const userData       = getUserFromToken();
  const userId         = userData?.userId;
  const nombreConductor = userData
    ? `${userData.nombre} ${userData.apellido}`.trim() || 'Conductor'
    : 'Conductor';
  const userRole = userData?.rol || '';

  const [driverId,       setDriverId]      = useState(null);
  const [viajeActivo,    setViajeActivo]   = useState(null);
  const [showFinalizar,  setShowFinalizar] = useState(false);
  const [datosFinalizar, setDatosFinalizar] = useState({ precio: '', metodo_pago: 'EFECTIVO' });
  const [historial,      setHistorial]     = useState([]);
  const [loading,        setLoading]       = useState(true);
  const [miEstado,       setMiEstado]      = useState('OFFLINE');
  const [currentPosition, setCurrentPosition] = useState(null);

  const { isConnected, subscribe } = useConductorSocket();

  const mapRef           = useRef(null);
  const watchIdRef       = useRef(null);
  const viajeActivoRef   = useRef(viajeActivo);
  const driverIdRef      = useRef(driverId);
  const lastPosSentRef   = useRef(0);

  useEffect(() => { viajeActivoRef.current = viajeActivo; }, [viajeActivo]);
  useEffect(() => { driverIdRef.current   = driverId;   }, [driverId]);

  const { mapInstanceRef } = useLeafletMap({
    mapRef,
    ready: !loading,
    currentPosition,
    viajeActivo,
  });

  const fetchHistorial = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/drivers/me/history');
      setHistorial(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      devWarn('Error cargando historial:', err.message);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchInicial = async () => {
      try {
        const [resDriver, resHistorial] = await Promise.all([
          axiosInstance.get('/drivers/me'),
          axiosInstance.get('/drivers/me/history'),
        ]);

        if (!mounted) return;

        setHistorial(Array.isArray(resHistorial.data) ? resHistorial.data : []);

        const driver = resDriver.data ?? null;

        if (!driver) {
          devWarn('No se encontró perfil de chofer para este usuario');
          setLoading(false);
          return;
        }

        setDriverId(driver.id);
        setMiEstado(driver.estado);

        if (driver.estado === 'OCUPADO') {
          const resPedidos = await axiosInstance.get('/orders/active-trips');
          if (!mounted) return;
          const pedidos      = normalizeCollection(resPedidos.data);
          const pedidoActivo = findActiveTripForDriver(pedidos, driver.id);
          if (pedidoActivo) {
            setViajeActivo({ id: pedidoActivo.id, estado: pedidoActivo.estado, pedido: pedidoActivo });
          }
        }
      } catch (err) {
        devWarn('Error en carga inicial:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchInicial();

    const pollingInterval = setInterval(async () => {
      if (viajeActivoRef.current || isConnected) return;
      const currentDriverId = driverIdRef.current;
      if (!currentDriverId) return;

      try {
        const res    = await axiosInstance.get('/orders/active-trips');
        if (!mounted) return;
        const pedidos = normalizeCollection(res.data);
        const activo  = findActiveTripForDriver(pedidos, currentDriverId);
        if (activo) {
          setViajeActivo({ id: activo.id, estado: activo.estado, pedido: activo });
          setMiEstado('OCUPADO');
        }
      } catch (err) {
        devWarn('Error en polling:', err.message);
      }
    }, POLLING_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(pollingInterval);
    };
  }, [userId, isConnected]);

  useEffect(() => {
    if (!isConnected) return;

    const onAsignado = (data) => {
      setViajeActivo({ id: data.viajeId, estado: 'ASIGNADO', pedido: data.pedido });
      setMiEstado('OCUPADO');
    };
    const onAccepted    = (data) => setViajeActivo((p) => p ? { ...p, estado: 'ACEPTADO',  pedido: data?.pedido || p.pedido } : null);
    const onEnCamino    = (data) => setViajeActivo((p) => p ? { ...p, estado: 'EN_CAMINO', pedido: data?.pedido || p.pedido } : null);
    const onStarted     = (data) => setViajeActivo((p) => p ? { ...p, estado: 'EN_VIAJE',  pedido: data?.pedido || p.pedido } : null);
    const onCompleted   = async () => { setViajeActivo(null); setMiEstado('DISPONIBLE'); setShowFinalizar(false); setDatosFinalizar({ precio: '', metodo_pago: 'EFECTIVO' }); await fetchHistorial(); };
    const onCancelled   = async () => { setViajeActivo(null); setMiEstado('DISPONIBLE'); await fetchHistorial(); };
    const onUnassigned  = async () => { setViajeActivo(null); setMiEstado('DISPONIBLE'); setShowFinalizar(false); await fetchHistorial(); };
    // viaje:rejected — rechazo por el propio chofer (evento separado del backend)
    const onRejected    = async () => { setViajeActivo(null); setMiEstado('DISPONIBLE'); await fetchHistorial(); };
    const onActualizado = (data) => {
      const pedido  = data?.pedido || data;
      const current = viajeActivoRef.current;
      if (current && pedido?.id === current.id) {
        setViajeActivo((p) => p ? { ...p, estado: pedido.estado, pedido } : null);
      }
    };

    const unsubAssigned = subscribe('viaje:assigned', onAsignado);
    const unsubAccepted = subscribe('viaje:accepted', onAccepted);
    const unsubOnTheWay = subscribe('viaje:on-the-way', onEnCamino);
    const unsubStarted = subscribe('viaje:started', onStarted);
    const unsubCompleted = subscribe('viaje:completed', onCompleted);
    const unsubCancelled = subscribe('viaje:cancelled', onCancelled);
    const unsubUnassigned = subscribe('viaje:unassigned', onUnassigned);
    const unsubRejected = subscribe('viaje:rejected', onRejected);
    const unsubActualizado = subscribe('pedido:actualizado', onActualizado);

    return () => {
      unsubAssigned();
      unsubAccepted();
      unsubOnTheWay();
      unsubStarted();
      unsubCompleted();
      unsubCancelled();
      unsubUnassigned();
      unsubRejected();
      unsubActualizado();
    };
  }, [isConnected, subscribe, fetchHistorial]);

  useEffect(() => {
    if (!navigator.geolocation || !driverId) return;

    const sendPosition = async (lat, lng) => {
      const now = Date.now();
      if (now - lastPosSentRef.current < POSITION_SEND_INTERVAL_MS) return;
      lastPosSentRef.current = now;
      try {
        await axiosInstance.patch('/drivers/me/location', { lat, lng });
      } catch (err) {
        devWarn('Error enviando ubicación:', err.message);
      }
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const pos = { lat: coords.latitude, lng: coords.longitude };
        setCurrentPosition(pos);
        sendPosition(pos.lat, pos.lng);
      },
      (err) => console.warn('GPS:', err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [driverId]);

  const toggleEstado = async () => {
    if (viajeActivo) return;
    const nuevo = miEstado === 'DISPONIBLE' ? 'OFFLINE' : 'DISPONIBLE';
    const prev  = miEstado;
    setMiEstado(nuevo);
    try {
      const res = await axiosInstance.patch('/drivers/me/status', { estado: nuevo });
      setMiEstado(res.data.estado);
    } catch (err) {
      setMiEstado(prev);
      alert('Error cambiando estado: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleAceptar   = async () => { if (!viajeActivo) return; try { await axiosInstance.post(`/orders/${viajeActivo.id}/accept`);      } catch (err) { alert('Error al aceptar: '     + (err.response?.data?.message || err.message)); } };
  const handleEnCamino  = async () => { if (!viajeActivo) return; try { await axiosInstance.post(`/orders/${viajeActivo.id}/on-the-way`); } catch (err) { alert('Error en camino: '      + (err.response?.data?.message || err.message)); } };
  const handleStartTrip = async () => { if (!viajeActivo) return; try { await axiosInstance.post(`/orders/${viajeActivo.id}/start`);       } catch (err) { alert('Error al iniciar: '     + (err.response?.data?.message || err.message)); } };

  const confirmFinalizar = async () => {
    if (!viajeActivo || !datosFinalizar.precio) return;
    try {
      await axiosInstance.post(`/orders/${viajeActivo.id}/finish`, {
        montoFinal: Number(datosFinalizar.precio),
        metodoPago: datosFinalizar.metodo_pago,
      });
      setShowFinalizar(false);
      setDatosFinalizar({ precio: '', metodo_pago: 'EFECTIVO' });
    } catch (err) {
      alert('Error al finalizar: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleRechazar = async () => {
    if (!viajeActivo) return;
    const motivoRechazo = prompt('Motivo para rechazar el viaje:');
    if (!motivoRechazo) return;
    try {
      await axiosInstance.post(`/orders/${viajeActivo.id}/reject`, { motivoRechazo });
    } catch (err) {
      alert('Error al rechazar: ' + (err.response?.data?.message || err.message));
    }
  };

  if (loading) {
    return (
      <div className="ui-page">
        <PageHeader title="Panel del conductor" subtitle="Inicializando datos en tiempo real..." />
        <div className="row g-3">
          <div className="col-lg-8">
            <Skeleton height={280} />
          </div>
          <div className="col-lg-4">
            <Card className="mb-3">
              <Card.Body>
                <Skeleton height={18} />
                <div className="mt-2"><Skeleton height={14} /></div>
                <div className="mt-2"><Skeleton height={14} /></div>
              </Card.Body>
            </Card>
            <Card>
              <Card.Body>
                <Skeleton height={18} />
                <div className="mt-2"><Skeleton height={12} /></div>
                <div className="mt-2"><Skeleton height={12} /></div>
              </Card.Body>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!driverId) {
    return (
      <Container fluid className="py-5 text-center">
        <Alert variant="danger">No se encontró perfil de chofer para este usuario. Contactá al administrador.</Alert>
      </Container>
    );
  }

  return (
    <Container fluid className="py-3" style={{ backgroundColor: '#F7F8FA', minHeight: '100vh' }}>

      <ConductorDashboardHeader
        nombreConductor={nombreConductor}
        userRole={userRole}
        isConnected={isConnected}
        miEstado={miEstado}
      />

      <Row>
        <ConductorMapCard
          mapRef={mapRef}
          mapInstanceRef={mapInstanceRef}
          currentPosition={currentPosition}
          miEstado={miEstado}
          viajeActivo={viajeActivo}
          toggleEstado={toggleEstado}
        />

        <Col lg={4}>
          <ConductorTripPanel
            viajeActivo={viajeActivo}
            onAceptar={handleAceptar}
            onRechazar={handleRechazar}
            onEnCamino={handleEnCamino}
            onStartTrip={handleStartTrip}
            onOpenFinalizar={() => setShowFinalizar(true)}
          />
          <ConductorHistoryCard historial={historial} />
        </Col>
      </Row>

      <ConductorFinishModal
        show={showFinalizar}
        onHide={() => setShowFinalizar(false)}
        codigoViaje={viajeActivo?.pedido?.codigo || ''}
        datosFinalizar={datosFinalizar}
        setDatosFinalizar={setDatosFinalizar}
        onConfirm={confirmFinalizar}
      />

    </Container>
  );
};

export default ConductorDashboard;
