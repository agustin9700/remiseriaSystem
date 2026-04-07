import { Col, Card, Button } from 'react-bootstrap';
import { FaMapMarkedAlt } from 'react-icons/fa';

/**
 * Mapa Leaflet + acciones de centrar y toggle disponible/offline.
 */
export default function ConductorMapCard({
  mapRef,
  mapInstanceRef,
  currentPosition,
  miEstado,
  viajeActivo,
  toggleEstado,
}) {
  const handleCenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (currentPosition) map.setView([currentPosition.lat, currentPosition.lng], 15);
  };

  return (
    <Col lg={8} className="mb-3">
      <Card className="shadow-sm h-100" style={{ minHeight: '400px' }}>
        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center bg-primary text-white gap-2">
          <span>
            <FaMapMarkedAlt className="me-2" />
            Mapa
          </span>
          <div className="d-flex gap-2">
            <Button size="sm" variant="light" onClick={handleCenter}>
              📍 Centrar
            </Button>
            <Button
              size="sm"
              variant={miEstado === 'DISPONIBLE' ? 'warning' : 'success'}
              onClick={toggleEstado}
              disabled={!!viajeActivo}
            >
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
  );
}
