import { useState } from "react";
import { Form } from "react-bootstrap";
import { Button, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle, useToast } from "../../ui";

export default function ModalCancelarPedido({ show, onHide, onConfirm }) {
  const toast = useToast();
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState(null);

  const validate = () => {
    if (!motivo.trim()) {
      setError("El motivo es obligatorio");
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onConfirm(motivo.trim());
    setMotivo("");
  };

  const handleClose = () => {
    setError(null);
    setMotivo("");
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} backdrop="static" keyboard={false}>
      <ModalHeader closeButton>
        <ModalTitle>Cancelar Pedido</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <Form>
          <Form.Group controlId="formMotivo">
            <Form.Label>Motivo de Cancelación</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              isInvalid={!!error}
              placeholder="Ingrese el motivo por el que se cancela el pedido"
            />
            <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
          </Form.Group>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={handleClose}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={handleSubmit}>
          Confirmar Cancelación
        </Button>
      </ModalFooter>
    </Modal>
  );
}
