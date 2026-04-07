import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Container, Row, Col, Card, Button, Badge,
  Alert, Form, Modal, ListGroup,
} from 'react-bootstrap';
import {
  FaMapMarkedAlt, FaCar, FaStop, FaCheck,
  FaTimes, FaHistory, FaClock, FaSatelliteDish, FaRoad
} from 'react-icons/fa';
import { useConductorSocket } from '../hooks/useSocket';
import { useLeafletMap } from '../hooks/useLeafletMap';
import axiosInstance from '../hooks/api/axiosInstance';
import { getUserFromToken } from '../utils/auth';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Badge as UiBadge, PageHeader, Skeleton } from '../components/ui';

// Fix de iconos por defecto de Leaflet con bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const POSITION_SEND_INTERVAL_MS = 10000;
const POLLING_INTERVAL_MS       = 8000;
const ESTADOS_ACTIVOS           = ['ASIGNADO', 'ACEPTADO', 'EN_CAMINO', 'EN_VIAJE'];


const normalizeCollection = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.trips)) return payload.trips;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const devWarn = (...args) => {
  if (import.meta.env.DEV) {
    console.warn(...args);
  }
};

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

  // Refs para acceso en callbacks sin re-render
  const mapRef           = useRef(null);
  const watchIdRef       = useRef(null);
  const viajeActivoRef   = useRef(viajeActivo);
  const driverIdRef      = useRef(driverId);
  const lastPosSentRef   = useRef(0);

  useEffect(() => { viajeActivoRef.current = viajeActivo; }, [viajeActivo]);
  useEffect(() => { driverIdRef.current   = driverId;   }, [driverId]);

  // ── Mapa — toda la lógica de Leaflet en el hook ──────────────────────────────
  const { mapInstanceRef } = useLeafletMap({
    mapRef,
    ready: !loading,
    currentPosition,
    viajeActivo,
  });

  // ── Historial ────────────────────────────────────────────────────────────────
  const fetchHistorial = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/drivers/me/history');
      setHistorial(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      devWarn('Error cargando historial:', err.message);
    }
  }, []);

  // ── Carga inicial ────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const encontrarPedidoActivo = (pedidos, currentDriverId) =>
      pedidos.find(
        (p) =>
          ESTADOS_ACTIVOS.includes(p.estado) &&
          (String(p.chofer?.id) === String(currentDriverId) ||
            String(p.choferId)  === String(currentDriverId))
      ) || null;

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
          const pedidoActivo = encontrarPedidoActivo(pedidos, driver.id);
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

    // Polling fallback (sin socket)
    const pollingInterval = setInterval(async () => {
      if (viajeActivoRef.current || isConnected) return;
      const currentDriverId = driverIdRef.current;
      if (!currentDriverId) return;

      try {
        const res    = await axiosInstance.get('/orders/active-trips');
        if (!mounted) return;
        const pedidos = normalizeCollection(res.data);
        const activo  = pedidos.find(
          (p) =>
            ESTADOS_ACTIVOS.includes(p.estado) &&
            (String(p.chofer?.id) === String(currentDriverId) ||
              String(p.choferId)  === String(currentDriverId))
        );
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

  // ── Listeners de socket ──────────────────────────────────────────────────────
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
    // FIX: viaje:rejected es cuando el propio chofer rechazó (el backend emite este evento separado)
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

  // ── GPS ──────────────────────────────────────────────────────────────────────
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

  // ── Acciones del conductor ───────────────────────────────────────────────────
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

  // ── Helpers de acceso a campos del pedido ────────────────────────────────────
  const getNombreCliente  = (p) => p?.cliente?.nombre      || p?.nombreCliente     || 'N/A';
  const getTelefonoCliente = (p) => p?.cliente?.telefono   || p?.telefonoCliente   || '';
  const getOrigen         = (p) => p?.viaje?.origen        || p?.origenTexto       || 'No especificado';
  const getDestino        = (p) => p?.viaje?.destino       || p?.destinoTexto      || 'No especificado';
  const getObservaciones  = (p) => p?.viaje?.observaciones || p?.observaciones     || null;

  const formatearFechaHistorial = (item) => {
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

  const estadoColor = { ASIGNADO: 'warning', ACEPTADO: 'info', EN_CAMINO: 'primary', EN_VIAJE: 'success' };

  // ── Render ───────────────────────────────────────────────────────────────────
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

      {/* ── Header ── */}
      <Row className="mb-3">
        <Col>
          <Card className="shadow-sm border-0">
            <Card.Body className="d-flex flex-wrap justify-content-between align-items-center">
              <div>
                <PageHeader title="Panel del conductor" subtitle={nombreConductor} />
                <small className="text-muted">
                  {userRole && <UiBadge tone="info">{userRole}</UiBadge>}
                </small>
              </div>
              <div className="d-flex gap-2 mt-2 mt-md-0">
                <Badge bg={isConnected ? 'success' : 'secondary'} className="px-3 py-2 rounded-pill">
                  {isConnected ? '🟢 Tiempo real' : '⚫ Modo REST'}
                </Badge>
                <Badge bg={miEstado === 'DISPONIBLE' ? 'success' : miEstado === 'OCUPADO' ? 'warning' : 'secondary'} className="px-3 py-2 rounded-pill">
                  {miEstado === 'DISPONIBLE' ? '🟢 Disponible' : miEstado === 'OCUPADO' ? '🟡 Ocupado' : '⚫ Offline'}
                </Badge>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        {/* ── Mapa ── */}
        <Col lg={8} className="mb-3">
          <Card className="shadow-sm h-100" style={{ minHeight: '400px' }}>
            <Card.Header className="d-flex flex-wrap justify-content-between align-items-center bg-primary text-white gap-2">
              <span><FaMapMarkedAlt className="me-2" />Mapa</span>
              <div className="d-flex gap-2">
                <Button size="sm" variant="light" onClick={() => {
                  const map = mapInstanceRef.current;
                  if (!map) return;
                  if (currentPosition) map.setView([currentPosition.lat, currentPosition.lng], 15);
                }}>
                  📍 Centrar
                </Button>
                <Button size="sm" variant={miEstado === 'DISPONIBLE' ? 'warning' : 'success'} onClick={toggleEstado} disabled={!!viajeActivo}>
                  {miEstado === 'DISPONIBLE' ? 'Ponerse Offline' : 'Ponerse Disponible'}
                </Button>
              </div>
            </Card.Header>
            <Card.Body className="p-0" style={{ position: 'relative' }}>
              <div ref={mapRef} style={{ height: '380px', width: '100%' }} />
              {currentPosition && (
                <div className="conductor-map-coords-badge">
                  📍 {currentPosition.lat.toFixed(5)}, {currentPosition.lng.toFixed(5)}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* ── Panel de viaje ── */}
        <Col lg={4}>
          <Card className="shadow-sm mb-3">
            <Card.Header className={viajeActivo ? `bg-${estadoColor[viajeActivo.estado] || 'primary'} text-white` : 'bg-secondary text-white'}>
              <FaClock className="me-2" />
              {viajeActivo ? 'Viaje en Progreso' : 'Sin Viaje'}
            </Card.Header>
            <Card.Body>
              {viajeActivo ? (
                <>
                  <Alert variant={estadoColor[viajeActivo.estado] || 'info'} className="mb-3">
                    <strong>Código: {viajeActivo.pedido?.codigo || viajeActivo.id}</strong><br />
                    <small>Estado: <strong>{viajeActivo.estado}</strong></small>
                  </Alert>

                  <div className="mb-2 p-2 bg-light rounded">
                    <h6 className="mb-1">👤 Cliente</h6>
                    <p className="mb-0"><strong>{getNombreCliente(viajeActivo.pedido)}</strong></p>
                    <p className="mb-0 text-muted">{getTelefonoCliente(viajeActivo.pedido)}</p>
                  </div>

                  <div className="mb-2"><strong>📍 Origen:</strong><br /><small>{getOrigen(viajeActivo.pedido)}</small></div>
                  <div className="mb-2"><strong>🏁 Destino:</strong><br /><small>{getDestino(viajeActivo.pedido)}</small></div>

                  {getObservaciones(viajeActivo.pedido) && (
                    <div className="mb-2 p-2 bg-warning bg-opacity-10 rounded">
                      <strong>📝 Notas:</strong><br /><small>{getObservaciones(viajeActivo.pedido)}</small>
                    </div>
                  )}

                  <div className="d-grid gap-2 mt-3">
                    {viajeActivo.estado === 'ASIGNADO' && (
                      <>
                        <Button variant="primary" onClick={handleAceptar}><FaCheck className="me-2" />Aceptar viaje</Button>
                        <Button variant="danger"  onClick={handleRechazar}><FaTimes className="me-2" />Rechazar</Button>
                      </>
                    )}
                    {viajeActivo.estado === 'ACEPTADO'   && <Button variant="warning" onClick={handleEnCamino}><FaRoad className="me-2" />En Camino</Button>}
                    {viajeActivo.estado === 'EN_CAMINO'  && <Button variant="success" onClick={handleStartTrip}><FaCar className="me-2" />Iniciar Viaje</Button>}
                    {viajeActivo.estado === 'EN_VIAJE'   && <Button variant="primary" onClick={() => setShowFinalizar(true)}><FaStop className="me-2" />Finalizar</Button>}
                  </div>
                </>
              ) : (
                <Alert variant="secondary" className="text-center">
                  <FaSatelliteDish className="d-block mx-auto mb-2" size={24} />
                  Esperando viaje...
                </Alert>
              )}
            </Card.Body>
          </Card>

          <Card className="shadow-sm">
            <Card.Header className="bg-dark text-white"><FaHistory className="me-2" />Historial</Card.Header>
            <Card.Body>
              {historial.length > 0 ? (
                <ListGroup variant="flush">
                  {historial.map((item) => (
                    <ListGroup.Item key={item.id}>
                      <strong>{item.codigo}</strong> — {formatearFechaHistorial(item)}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : (
                <p className="text-muted text-center">Sin viajes recientes</p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* ── Modal finalizar ── */}
      <Modal show={showFinalizar} onHide={() => setShowFinalizar(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Finalizar viaje {viajeActivo?.pedido?.codigo || ''}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Monto final ($)</Form.Label>
              <Form.Control
                type="number" placeholder="0.00"
                value={datosFinalizar.precio}
                onChange={(e) => setDatosFinalizar((p) => ({ ...p, precio: e.target.value }))}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Método de pago</Form.Label>
              <Form.Select value={datosFinalizar.metodo_pago} onChange={(e) => setDatosFinalizar((p) => ({ ...p, metodo_pago: e.target.value }))}>
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="TARJETA">Tarjeta</option>
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowFinalizar(false)}>Cancelar</Button>
          <Button variant="primary"   onClick={confirmFinalizar}><FaCheck className="me-2" />Confirmar</Button>
        </Modal.Footer>
      </Modal>

    </Container>
  );
};

export default ConductorDashboard;
