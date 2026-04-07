import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Button, Badge } from 'react-bootstrap';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [-26.8083, -65.1950];

// Evita íconos rotos por defecto de Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const createChoferIcon = (nombre = 'Chofer') =>
  L.divIcon({
    className: 'chofer-marker',
    html: `
      <div style="
        position: relative;
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
        border: 3px solid #fff;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        display:flex;
        align-items:center;
        justify-content:center;
        font-size: 18px;
      ">
        🚗
      </div>
      <div style="
        position: absolute;
        left: 50%;
        bottom: -20px;
        transform: translateX(-50%);
        background: #fff;
        color: #111827;
        border-radius: 999px;
        padding: 2px 8px;
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
        box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      ">
        ${nombre}
      </div>
    `,
    iconSize: [42, 62],
    iconAnchor: [21, 31],
    popupAnchor: [0, -24]
  });

const createOrigenIcon = () =>
  L.divIcon({
    className: 'origen-marker',
    html: `
      <div style="
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        border: 3px solid #fff;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        display:flex;
        align-items:center;
        justify-content:center;
        font-size: 16px;
      ">
        📍
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });

const createDestinoIcon = () =>
  L.divIcon({
    className: 'destino-marker',
    html: `
      <div style="
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
        border: 3px solid #fff;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        display:flex;
        align-items:center;
        justify-content:center;
        font-size: 16px;
      ">
        🏁
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });

const parseCoord = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
};

const getEstadoBadge = (estado) => {
  const e = (estado || '').toUpperCase();

  const map = {
    PENDIENTE: { bg: 'secondary', text: 'Pendiente' },
    ASIGNADO: { bg: 'primary', text: 'Asignado' },
    ACEPTADO: { bg: 'info', text: 'Aceptado' },
    EN_CAMINO: { bg: 'info', text: 'En camino' },
    EN_VIAJE: { bg: 'success', text: 'En viaje' },
    COMPLETADO: { bg: 'dark', text: 'Finalizado' },
    CANCELADO: { bg: 'secondary', text: 'Cancelado' },
    RECHAZADO: { bg: 'danger', text: 'Rechazado por operador' }
  };

  return map[e] || { bg: 'secondary', text: estado || 'Sin estado' };
};

const calcularDistanciaYTiempo = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanciaKm = R * c;
  const distanciaM = distanciaKm * 1000;

  return {
    metros: distanciaM,
    texto: distanciaM >= 1000 ? `${distanciaKm.toFixed(1)} km` : `${Math.round(distanciaM)} m`,
    tiempo: distanciaKm < 0.2 ? '< 1 min' : `${Math.max(1, Math.round(distanciaKm * 2))} min`
  };
};

const MapaUbicacionPedidoModal = ({ show, onHide, pedido, ubicacionChoferLive }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const origenMarkerRef = useRef(null);
  const destinoMarkerRef = useRef(null);
  const choferMarkerRef = useRef(null);
  const routeLineRef = useRef(null);

  const [distancia, setDistancia] = useState(null);
  const [tiempoEstimado, setTiempoEstimado] = useState(null);

  const codigoPedido = pedido?.codigo || `Pedido #${pedido?.id || ''}`;
  const nombreChofer = pedido?.chofer?.nombre || 'Chofer';
  const origenTexto = pedido?.viaje?.origen || 'Sin origen';
  const destinoTexto = pedido?.viaje?.destino || 'Sin destino';

  const origenCoords = useMemo(() => {
    const lat = parseCoord(pedido?.viaje?.origenLat);
    const lng = parseCoord(pedido?.viaje?.origenLng);
    return lat != null && lng != null ? { lat, lng } : null;
  }, [pedido]);

  const destinoCoords = useMemo(() => {
    const lat = parseCoord(pedido?.viaje?.destinoLat);
    const lng = parseCoord(pedido?.viaje?.destinoLng);
    return lat != null && lng != null ? { lat, lng } : null;
  }, [pedido]);

  const choferCoords = useMemo(() => {
    if (ubicacionChoferLive?.lat != null && ubicacionChoferLive?.lng != null) {
      return {
        lat: parseCoord(ubicacionChoferLive.lat),
        lng: parseCoord(ubicacionChoferLive.lng)
      };
    }

    const c = pedido?.chofer || {};

    const candidates = [
      { lat: c.latitud, lng: c.longitud },
      { lat: c.lat, lng: c.lng },
      { lat: c.ubicacion_lt, lng: c.ubicacion_lng ?? c.ubicacion_lg },
      { lat: c.ubicacionLat, lng: c.ubicacionLng },
      { lat: c.locationLat, lng: c.locationLng }
    ];

    for (const item of candidates) {
      const lat = parseCoord(item.lat);
      const lng = parseCoord(item.lng);
      if (lat != null && lng != null) return { lat, lng };
    }

    return null;
  }, [pedido, ubicacionChoferLive]);

  useEffect(() => {
    if (!show || !pedido) return;

    const timer = setTimeout(() => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const center = origenCoords
        ? [origenCoords.lat, origenCoords.lng]
        : choferCoords
        ? [choferCoords.lat, choferCoords.lng]
        : destinoCoords
        ? [destinoCoords.lat, destinoCoords.lng]
        : DEFAULT_CENTER;

      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: true
      }).setView(center, 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(mapInstanceRef.current);

      mapInstanceRef.current.invalidateSize();

      const bounds = [];

      if (origenCoords) {
        origenMarkerRef.current = L.marker([origenCoords.lat, origenCoords.lng], {
          icon: createOrigenIcon()
        })
          .addTo(mapInstanceRef.current)
          .bindPopup(`<strong>📍 Origen</strong><br/>${origenTexto}`);
        bounds.push([origenCoords.lat, origenCoords.lng]);
      }

      if (destinoCoords) {
        destinoMarkerRef.current = L.marker([destinoCoords.lat, destinoCoords.lng], {
          icon: createDestinoIcon()
        })
          .addTo(mapInstanceRef.current)
          .bindPopup(`<strong>🏁 Destino</strong><br/>${destinoTexto}`);
        bounds.push([destinoCoords.lat, destinoCoords.lng]);
      }

      if (choferCoords) {
        choferMarkerRef.current = L.marker([choferCoords.lat, choferCoords.lng], {
          icon: createChoferIcon(nombreChofer),
          zIndexOffset: 1000
        })
          .addTo(mapInstanceRef.current)
          .bindPopup(`<strong>🚗 Chofer</strong><br/>${nombreChofer}`);
        bounds.push([choferCoords.lat, choferCoords.lng]);
      }

      if (origenCoords && choferCoords) {
        routeLineRef.current = L.polyline(
          [
            [choferCoords.lat, choferCoords.lng],
            [origenCoords.lat, origenCoords.lng]
          ],
          {
            color: '#16a34a',
            weight: 4,
            opacity: 0.85,
            dashArray: '10, 8'
          }
        ).addTo(mapInstanceRef.current);

        const info = calcularDistanciaYTiempo(
          choferCoords.lat,
          choferCoords.lng,
          origenCoords.lat,
          origenCoords.lng
        );
        setDistancia(info.texto);
        setTiempoEstimado(info.tiempo);
      } else {
        setDistancia(null);
        setTiempoEstimado(null);
      }

      if (bounds.length > 1) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      }
    }, 80);

    return () => {
      clearTimeout(timer);

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      origenMarkerRef.current = null;
      destinoMarkerRef.current = null;
      choferMarkerRef.current = null;
      routeLineRef.current = null;

      setDistancia(null);
      setTiempoEstimado(null);
    };
  }, [show, pedido, origenCoords, destinoCoords, choferCoords, origenTexto, destinoTexto, nombreChofer]);

  useEffect(() => {
    if (!show || !mapInstanceRef.current || !choferMarkerRef.current || !choferCoords) return;

    mapInstanceRef.current.invalidateSize();
    choferMarkerRef.current.setLatLng([choferCoords.lat, choferCoords.lng]);

    if (origenCoords && routeLineRef.current) {
      routeLineRef.current.setLatLngs([
        [choferCoords.lat, choferCoords.lng],
        [origenCoords.lat, origenCoords.lng]
      ]);

      const info = calcularDistanciaYTiempo(
        choferCoords.lat,
        choferCoords.lng,
        origenCoords.lat,
        origenCoords.lng
      );
      setDistancia(info.texto);
      setTiempoEstimado(info.tiempo);
    }
  }, [show, choferCoords, origenCoords]);

  if (!pedido) return null;

  const estadoInfo = getEstadoBadge(pedido?.estado);
  const licencia = pedido?.chofer?.licenciaNumero || 'Sin licencia';

  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header closeButton className="mapa-modal-header">
        <Modal.Title className="fw-bold">
          📍 Ubicación – {licencia}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="mapa-modal-body">
        <div className="row g-3">
          <div className="col-lg-4">
            <div className="card shadow-sm border-0 h-100 mapa-info-card">
              <div className="card-header fw-bold mapa-info-card-header">
                Información del viaje
              </div>

              <div className="card-body mapa-info-card-body">
                <div className="mb-3">
                  <div className="small text-muted">Código</div>
                  <div className="fw-semibold">{codigoPedido}</div>
                </div>

                <div className="mb-3">
                  <div className="small text-muted">Estado</div>
                  <Badge bg={estadoInfo.bg}>{estadoInfo.text}</Badge>
                </div>

                <div className="mb-3">
                  <div className="small text-muted">Chofer</div>
                  <div className="fw-semibold">{nombreChofer}</div>
                </div>

                <div className="mb-3">
                  <div className="small text-muted">Origen</div>
                  <div className="fw-semibold">{origenTexto}</div>
                </div>

                <div className="mb-3">
                  <div className="small text-muted">Destino</div>
                  <div className="fw-semibold">{destinoTexto}</div>
                </div>

                <div className="mb-3">
                  <div className="small text-muted">Ubicación del chofer</div>
                  <div className="fw-semibold">
                    {choferCoords ? (
                      <span className="text-success">Disponible</span>
                    ) : (
                      <span className="text-secondary">Sin ubicación</span>
                    )}
                  </div>
                </div>

                {(distancia || tiempoEstimado) && (
                  <div className="mapa-estimacion-box">
                    <div className="fw-semibold mb-2">Estimación hasta el origen</div>
                    {distancia && <div className="small">📏 Distancia: {distancia}</div>}
                    {tiempoEstimado && <div className="small">⏱️ Tiempo aprox: {tiempoEstimado}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-lg-8">
            <div className="card shadow-sm border-0 mapa-map-card">
              <div className="card-header fw-bold mapa-map-card-header">
                Mapa
              </div>

              <div className="card-body p-0">
                <div ref={mapRef} className="mapa-map-container" />
              </div>
            </div>
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer className="mapa-modal-footer">
        <Button variant="secondary" onClick={onHide}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default MapaUbicacionPedidoModal;