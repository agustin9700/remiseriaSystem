import { useState } from 'react';
import { Alert, Badge, Button, Card, Form, Modal } from 'react-bootstrap';
import { FaCheck, FaPlay, FaRoad, FaStop } from 'react-icons/fa';
import axiosInstance from '../../hooks/api/axiosInstance';

const ConductorTracking = ({ viajeActivo, onViajeComplete }) => {
  const [error, setError] = useState(null);
  const [showFinalizar, setShowFinalizar] = useState(false);
  const [datosFinalizar, setDatosFinalizar] = useState({ montoFinal: '', metodoPago: 'EFECTIVO' });

  const estadoActual = viajeActivo?.estado || 'SIN_VIAJE';

  const postAction = async (action, body = undefined) => {
    if (!viajeActivo?.id) return;
    try {
      await axiosInstance.post(`/orders/${viajeActivo.id}/${action}`, body);
      if (action === 'finish') {
        setShowFinalizar(false);
        onViajeComplete?.();
      }
    } catch (err) {
      setError(err.response?.data?.message || `No se pudo ejecutar ${action}.`);
    }
  };

  const confirmarFinalizacion = async () => {
    if (!viajeActivo?.id || !datosFinalizar.montoFinal) return;
    await postAction('finish', {
      montoFinal: Number(datosFinalizar.montoFinal),
      metodoPago: datosFinalizar.metodoPago,
    });
  };

  return (
    <div className="conductor-tracking">
      <div className="mb-3 d-flex flex-wrap gap-2">
        <Badge bg="info">Estado: {estadoActual}</Badge>
        <Badge bg="secondary">Tracking GPS gestionado por el dashboard</Badge>
      </div>

      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

      {viajeActivo ? (
        <Card>
          <Card.Body>
            <h5 className="mb-3">Viaje #{viajeActivo.id}</h5>
            <p><strong>Estado:</strong> {viajeActivo.estado}</p>
            <div className="d-grid gap-2">
              {viajeActivo.estado === 'ACEPTADO' && (
                <Button variant="primary" onClick={() => postAction('on-the-way')}><FaRoad className="me-2" />Marcar en camino</Button>
              )}
              {viajeActivo.estado === 'EN_CAMINO' && (
                <Button variant="success" onClick={() => postAction('start')}><FaPlay className="me-2" />Iniciar viaje</Button>
              )}
              {viajeActivo.estado === 'EN_VIAJE' && (
                <Button variant="dark" onClick={() => setShowFinalizar(true)}><FaStop className="me-2" />Finalizar viaje</Button>
              )}
            </div>
          </Card.Body>
        </Card>
      ) : (
        <Alert variant="secondary">Sin viaje activo.</Alert>
      )}

      <Modal show={showFinalizar} onHide={() => setShowFinalizar(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Finalizar viaje</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Monto final</Form.Label>
            <Form.Control type="number" value={datosFinalizar.montoFinal} onChange={(e) => setDatosFinalizar((prev) => ({ ...prev, montoFinal: e.target.value }))} />
          </Form.Group>
          <Form.Group>
            <Form.Label>Método de pago</Form.Label>
            <Form.Select value={datosFinalizar.metodoPago} onChange={(e) => setDatosFinalizar((prev) => ({ ...prev, metodoPago: e.target.value }))}>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="TARJETA">Tarjeta</option>
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowFinalizar(false)}>Cancelar</Button>
          <Button variant="primary" onClick={confirmarFinalizacion}><FaCheck className="me-2" />Confirmar</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ConductorTracking;
