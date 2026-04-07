import { Card, Alert, Button } from 'react-bootstrap';
import {
  FaClock, FaCheck, FaTimes, FaRoad, FaCar, FaStop, FaSatelliteDish,
} from 'react-icons/fa';
import {
  estadoColor,
  getNombreCliente,
  getTelefonoCliente,
  getOrigen,
  getDestino,
  getObservaciones,
} from './conductorDashboard.helpers';

/**
 * Panel lateral: detalle del viaje activo y acciones del conductor.
 */
export default function ConductorTripPanel({
  viajeActivo,
  onAceptar,
  onRechazar,
  onEnCamino,
  onStartTrip,
  onOpenFinalizar,
}) {
  return (
    <Card className="shadow-sm mb-3">
        <Card.Header
          className={
            viajeActivo
              ? `bg-${estadoColor[viajeActivo.estado] || 'primary'} text-white`
              : 'bg-secondary text-white'
          }
        >
          <FaClock className="me-2" />
          {viajeActivo ? 'Viaje en Progreso' : 'Sin Viaje'}
        </Card.Header>
        <Card.Body>
          {viajeActivo ? (
            <>
              <Alert variant={estadoColor[viajeActivo.estado] || 'info'} className="mb-3">
                <strong>Código: {viajeActivo.pedido?.codigo || viajeActivo.id}</strong>
                <br />
                <small>
                  Estado: <strong>{viajeActivo.estado}</strong>
                </small>
              </Alert>

              <div className="mb-2 p-2 bg-light rounded">
                <h6 className="mb-1">👤 Cliente</h6>
                <p className="mb-0">
                  <strong>{getNombreCliente(viajeActivo.pedido)}</strong>
                </p>
                <p className="mb-0 text-muted">{getTelefonoCliente(viajeActivo.pedido)}</p>
              </div>

              <div className="mb-2">
                <strong>📍 Origen:</strong>
                <br />
                <small>{getOrigen(viajeActivo.pedido)}</small>
              </div>
              <div className="mb-2">
                <strong>🏁 Destino:</strong>
                <br />
                <small>{getDestino(viajeActivo.pedido)}</small>
              </div>

              {getObservaciones(viajeActivo.pedido) && (
                <div className="mb-2 p-2 bg-warning bg-opacity-10 rounded">
                  <strong>📝 Notas:</strong>
                  <br />
                  <small>{getObservaciones(viajeActivo.pedido)}</small>
                </div>
              )}

              <div className="d-grid gap-2 mt-3">
                {viajeActivo.estado === 'ASIGNADO' && (
                  <>
                    <Button variant="primary" onClick={onAceptar}>
                      <FaCheck className="me-2" />
                      Aceptar viaje
                    </Button>
                    <Button variant="danger" onClick={onRechazar}>
                      <FaTimes className="me-2" />
                      Rechazar
                    </Button>
                  </>
                )}
                {viajeActivo.estado === 'ACEPTADO' && (
                  <Button variant="warning" onClick={onEnCamino}>
                    <FaRoad className="me-2" />
                    En Camino
                  </Button>
                )}
                {viajeActivo.estado === 'EN_CAMINO' && (
                  <Button variant="success" onClick={onStartTrip}>
                    <FaCar className="me-2" />
                    Iniciar Viaje
                  </Button>
                )}
                {viajeActivo.estado === 'EN_VIAJE' && (
                  <Button variant="primary" onClick={onOpenFinalizar}>
                    <FaStop className="me-2" />
                    Finalizar
                  </Button>
                )}
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
  );
}
