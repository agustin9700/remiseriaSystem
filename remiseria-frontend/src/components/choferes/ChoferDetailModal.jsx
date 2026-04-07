import { useEffect, useRef } from 'react';
import { ListGroup } from 'react-bootstrap';
import { FaMapMarkedAlt, FaCar, FaPhone, FaIdCard, FaTachometerAlt } from 'react-icons/fa';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Badge, Button, Card, CardBody, CardHeader, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle } from '../ui';

const ChoferDetailModal = ({ show, onHide, chofer }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (show && chofer) {
      setTimeout(() => {
        const mapContainer = document.getElementById(`chofer-map-${chofer.id}`);
        if (mapContainer && !mapInstanceRef.current) {
          const choferLat = parseFloat(chofer.latitud) || -26.8241;
          const choferLng = parseFloat(chofer.longitud) || -65.2226;

          const newMap = L.map(mapContainer).setView([choferLat, choferLng], 15);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
          }).addTo(newMap);

          const choferIcon = L.divIcon({
            className: 'chofer-marker',
            html: '<div style="background:#22C55E;width:35px;height:35px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,0.3);font-size:18px;">🚗</div>',
            iconSize: [35, 35],
            iconAnchor: [17, 17]
          });

          L.marker([choferLat, choferLng], { icon: choferIcon })
            .addTo(newMap)
            .bindPopup(`<strong>${chofer.user?.nombre} ${chofer.user?.apellido}</strong>`)
            .openPopup();

          mapInstanceRef.current = newMap;
        }
      }, 100);
    }

    // Cleanup al cerrar
    if (!show && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
  }, [show, chofer]);

  if (!chofer) return null;

  const isLibre = chofer.estado === 'DISPONIBLE';
  const tieneUbicacion = chofer.latitud != null && chofer.longitud != null;

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <ModalHeader closeButton className="text-white" style={{ background: isLibre ? '#22C55E' : '#EF4444' }}>
        <ModalTitle>
          <FaIdCard className="me-2" />
          {chofer.user?.nombre} {chofer.user?.apellido}
        </ModalTitle>
      </ModalHeader>

      <ModalBody>
        <div className="row g-3">
          <div className="col-md-5">
            <Card className="mb-3">
              <CardHeader className="bg-light fw-bold">📋 Información Personal</CardHeader>
              <CardBody className="p-0">
                <ListGroup variant="flush">
                  <ListGroup.Item>
                    <FaPhone className="me-2 text-success" />
                    <strong>Teléfono:</strong> {chofer.user?.telefono || 'No disponible'}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>Estado:</strong>{' '}
                    <Badge tone={isLibre ? 'success' : 'danger'}>
                      {isLibre ? '🟢 Disponible' : '🔴 Ocupado'}
                    </Badge>
                  </ListGroup.Item>
                  {chofer.licenciaNumero && (
                    <ListGroup.Item>
                      <FaIdCard className="me-2 text-primary" />
                      <strong>Licencia:</strong> {chofer.licenciaNumero}
                    </ListGroup.Item>
                  )}
                </ListGroup>
              </CardBody>
            </Card>

            {chofer.patente && (
              <Card>
                <CardHeader className="bg-light fw-bold">🚗 Vehículo</CardHeader>
                <CardBody className="p-0">
                  <ListGroup variant="flush">
                    <ListGroup.Item>
                      <FaCar className="me-2 text-primary" />
                      <strong>Marca/Modelo:</strong> {chofer.vehiculoMarca} {chofer.vehiculoModelo}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Color:</strong> {chofer.vehiculoColor || 'No especificado'}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Patente:</strong>{' '}
                      <Badge tone="neutral" style={{ letterSpacing: '1px' }}>{chofer.patente}</Badge>
                    </ListGroup.Item>
                  </ListGroup>
                </CardBody>
              </Card>
            )}
          </div>

          <div className="col-md-7">
            <Card>
              <CardHeader className="bg-light fw-bold">
                <FaMapMarkedAlt className="me-2 text-danger" />
                Ubicación Actual
              </CardHeader>
              <CardBody className="p-0">
                {tieneUbicacion ? (
                  <>
                    <div
                      id={`chofer-map-${chofer.id}`}
                      ref={mapRef}
                      style={{ height: '350px', width: '100%', borderRadius: '0 0 8px 8px' }}
                    />
                    <div className="p-2 bg-light text-center">
                      <small className="text-muted">
                        📍 {parseFloat(chofer.latitud).toFixed(5)}, {parseFloat(chofer.longitud).toFixed(5)}
                      </small>
                    </div>
                  </>
                ) : (
                  <div className="d-flex flex-column align-items-center justify-content-center text-muted py-5">
                    <FaTachometerAlt size={32} className="mb-3" />
                    <p className="mb-0">El conductor no ha compartido su ubicación</p>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="secondary" onClick={onHide}>Cerrar</Button>
      </ModalFooter>
    </Modal>
  );
};

export default ChoferDetailModal;