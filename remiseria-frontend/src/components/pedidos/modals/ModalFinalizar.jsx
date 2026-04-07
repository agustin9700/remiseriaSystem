import React, { useEffect, useState } from "react";
import { Button, Input, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle, Select, useToast } from "../../ui";

const ModalFinalizar = ({ show, onHide, onConfirm, pedido }) => {
  const toast = useToast();
  const [formData, setFormData] = useState({
    precio: '',
    metodo_pago: 'efectivo',
    nota: '',
  });

  useEffect(() => {
    if (show) {
      setFormData({
        precio: '',
        metodo_pago: 'efectivo',
        nota: '',
      });
    }
  }, [show, pedido?.id]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.precio || !formData.metodo_pago) {
      toast.error('Por favor complete todos los campos');
      return;
    }

    onConfirm({
      id: pedido?.id,
      precio: parseFloat(formData.precio),
      metodo_pago: formData.metodo_pago,
      nota: formData.nota?.trim() || undefined,
      hora_finalizacion: new Date().toISOString(),
    });
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <ModalHeader closeButton>
        <ModalTitle>Finalizar pedido {pedido?.codigo || ''}</ModalTitle>
      </ModalHeader>

      <form onSubmit={handleSubmit}>
        <ModalBody className="modal-body-form">
          <div className="modal-info">
            <span className="modal-info-label">Código:</span> {pedido?.codigo || 'Sin código'}
          </div>

          <div className="mb-3">
            <label className="form-label">Precio ($)</label>
            <Input
              type="number"
              value={formData.precio}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, precio: e.target.value }))
              }
              step="0.01"
              min="0"
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Método de pago</label>
            <Select
              value={formData.metodo_pago}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, metodo_pago: e.target.value }))
              }
              required
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
            </Select>
          </div>

          <div className="mb-3">
            <label className="form-label">Nota (opcional)</label>
            <textarea
              className="form-control"
              value={formData.nota}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, nota: e.target.value }))
              }
              rows={2}
              placeholder="Observaciones adicionales..."
            />
          </div>
        </ModalBody>

        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onHide}>
            Cancelar
          </Button>
          <Button type="submit">
            Confirmar finalización
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};

export default ModalFinalizar;