import React, { useState } from 'react';
import { Form, Spinner, Alert } from 'react-bootstrap';
import axiosInstance from '../../../hooks/api/axiosInstance';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMapMarkerAlt, faFlag, faArrowDown, faMapPin,
  faInfoCircle, faPaperPlane
} from '@fortawesome/free-solid-svg-icons';
import { Button, Input, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle, useToast } from '../../ui';

const NuevoPedidoModal = ({ show, onHide, onPedidoCreado }) => {
  const toast = useToast();
  const [formData, setFormData] = useState({
    calle_inicial: '',
    numero_inicial: '',
    calle_final: '',
    numero_final: '',
    nombreCliente: '',
    telefonoCliente: '',
    observaciones: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (
      !formData.calle_inicial.trim() ||
      !formData.numero_inicial.trim() ||
      !formData.calle_final.trim() ||
      !formData.numero_final.trim()
    ) {
      setError('Todos los campos de dirección son obligatorios.');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        nombreCliente: formData.nombreCliente || 'Sin nombre',
        telefonoCliente: formData.telefonoCliente || 'Sin teléfono',
        origenTexto: `${formData.calle_inicial} ${formData.numero_inicial}`.trim(),
        destinoTexto: `${formData.calle_final} ${formData.numero_final}`.trim(),
        ...(formData.observaciones && { observaciones: formData.observaciones }),
      };

      await axiosInstance.post('/orders', payload);

      toast.success('Pedido creado correctamente');

      if (onPedidoCreado) {
        onPedidoCreado();
      }

      setFormData({
        calle_inicial: '',
        numero_inicial: '',
        calle_final: '',
        numero_final: '',
        nombreCliente: '',
        telefonoCliente: '',
        observaciones: ''
      });

      onHide();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Ocurrió un error al crear el pedido.');
      setError(err.response?.data?.message || 'Ocurrió un error al crear el pedido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <ModalHeader closeButton>
        <ModalTitle>
          <FontAwesomeIcon icon={faMapMarkerAlt} className="me-2 text-primary" />
          Crear Nuevo Pedido
        </ModalTitle>
      </ModalHeader>

      <ModalBody>
        {error && <Alert variant="danger">{error}</Alert>}

        <Form onSubmit={handleSubmit}>
          <h5 className="text-primary">
            <FontAwesomeIcon icon={faFlag} className="me-2" />
            Origen
          </h5>
          <div className="row g-3 mb-3">
            <div className="col-md-8">
              <Form.Label>Calle</Form.Label>
              <Input
                type="text"
                name="calle_inicial"
                value={formData.calle_inicial}
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-4">
              <Form.Label>Número</Form.Label>
              <Input
                type="text"
                name="numero_inicial"
                value={formData.numero_inicial}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="d-flex align-items-center my-3">
            <hr className="flex-grow-1" />
            <div className="px-3 text-muted">
              <FontAwesomeIcon icon={faArrowDown} />
            </div>
            <hr className="flex-grow-1" />
          </div>

          <h5 className="text-primary">
            <FontAwesomeIcon icon={faMapPin} className="me-2" />
            Destino
          </h5>
          <div className="row g-3 mb-3">
            <div className="col-md-8">
              <Form.Label>Calle</Form.Label>
              <Input
                type="text"
                name="calle_final"
                value={formData.calle_final}
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-4">
              <Form.Label>Número</Form.Label>
              <Input
                type="text"
                name="numero_final"
                value={formData.numero_final}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <h5 className="text-primary mt-4">
            <FontAwesomeIcon icon={faInfoCircle} className="me-2" />
            Información del Cliente
          </h5>
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <Form.Label>Nombre del Cliente</Form.Label>
              <Input
                type="text"
                name="nombreCliente"
                value={formData.nombreCliente}
                onChange={handleChange}
                placeholder="Nombre del cliente"
              />
            </div>
            <div className="col-md-6">
              <Form.Label>Teléfono del Cliente</Form.Label>
              <Input
                type="tel"
                name="telefonoCliente"
                value={formData.telefonoCliente}
                onChange={handleChange}
                placeholder="Teléfono"
              />
            </div>
          </div>

          <Form.Group className="mb-3">
            <Form.Label>Observaciones</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              name="observaciones"
              value={formData.observaciones}
              onChange={handleChange}
            />
          </Form.Group>

          <ModalFooter className="d-flex justify-content-end gap-2 px-0 pb-0">
            <Button variant="secondary" onClick={onHide} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Spinner as="span" animation="border" size="sm" />
                  <span className="ms-2">Guardando...</span>
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faPaperPlane} className="me-2" />
                  Crear Pedido
                </>
              )}
            </Button>
          </ModalFooter>
        </Form>
      </ModalBody>
    </Modal>
  );
};

export default NuevoPedidoModal;