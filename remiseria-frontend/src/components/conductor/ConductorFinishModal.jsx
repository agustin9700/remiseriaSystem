import { Modal, Button, Form } from 'react-bootstrap';
import { FaCheck } from 'react-icons/fa';

/**
 * Modal para monto y método de pago al finalizar viaje.
 */
export default function ConductorFinishModal({
  show,
  onHide,
  codigoViaje,
  datosFinalizar,
  setDatosFinalizar,
  onConfirm,
}) {
  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Finalizar viaje {codigoViaje || ''}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Monto final ($)</Form.Label>
            <Form.Control
              type="number"
              placeholder="0.00"
              value={datosFinalizar.precio}
              onChange={(e) => setDatosFinalizar((p) => ({ ...p, precio: e.target.value }))}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Método de pago</Form.Label>
            <Form.Select
              value={datosFinalizar.metodo_pago}
              onChange={(e) => setDatosFinalizar((p) => ({ ...p, metodo_pago: e.target.value }))}
            >
              <option value="EFECTIVO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="TARJETA">Tarjeta</option>
            </Form.Select>
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={onConfirm}>
          <FaCheck className="me-2" />
          Confirmar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
