import React, { useEffect, useState } from 'react';
import axiosInstance from '../../../hooks/api/axiosInstance';
import { Form, Spinner, Alert } from 'react-bootstrap';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle, Select, useToast } from '../../ui';

const ModalAsignarChofer = ({ show, onHide, pedido, asignarPedido }) => {
  const toast = useToast();

  const [choferes, setChoferes] = useState([]);
  const [choferSeleccionado, setChoferSeleccionado] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!show) {
      setChoferSeleccionado('');
      setError(null);
      setChoferes([]);
      return;
    }

    const fetchChoferes = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get('/drivers');
        const todos = Array.isArray(res.data) ? res.data : [];
        // Solo mostrar choferes disponibles
        setChoferes(todos.filter(c => c.estado === 'DISPONIBLE'));
      } catch {
        setError('Error al cargar choferes');
      } finally {
        setLoading(false);
      }
    };

    fetchChoferes();
  }, [show]);

  const pedido_id = typeof pedido === 'object' ? pedido?.id : pedido;
  if (!pedido_id) {
    return (
      <Modal show={show} onHide={onHide} centered>
        <ModalHeader closeButton>
          <ModalTitle>Error</ModalTitle>
        </ModalHeader>
        <ModalBody>No se recibió un pedido válido para asignar.</ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={onHide}>Cerrar</Button>
        </ModalFooter>
      </Modal>
    );
  }

  const handleAsignar = async () => {
    if (!choferSeleccionado) {
      setError('Debe seleccionar un chofer');
      return;
    }

    try {
      setLoading(true);
      await asignarPedido(pedido_id, choferSeleccionado);
      toast.success('Chofer asignado correctamente');
      onHide();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al asignar el pedido');
      toast.error(err.response?.data?.message || 'Error al asignar el pedido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered backdrop="static">
      <ModalHeader closeButton>
      <ModalTitle>Asignar chofer al pedido {pedido?.codigo || `#${pedido_id?.substring(0, 6)}`}</ModalTitle>
      </ModalHeader>

      <ModalBody>
        {loading && choferes.length === 0 && (
          <div className="text-center">
            <Spinner animation="border" />
            <p>Cargando choferes disponibles...</p>
          </div>
        )}

        {!loading && choferes.length === 0 && (
          <Alert variant="info">No hay choferes disponibles en este momento.</Alert>
        )}

        {error && <Alert variant="danger">{error}</Alert>}

        {choferes.length > 0 && (
          <Form.Group className="mb-3">
            <Form.Label>Chofer:</Form.Label>
            <Select
              value={choferSeleccionado}
              onChange={e => setChoferSeleccionado(e.target.value)}
              disabled={loading}
            >
              <option value="">-- Seleccione un chofer --</option>
              {choferes.map(chofer => (
                <option key={chofer.id} value={chofer.id}>
                  {chofer.user?.nombre} {chofer.user?.apellido}
                  {chofer.patente ? ` — ${chofer.vehiculoMarca || ''} ${chofer.vehiculoModelo || ''} (${chofer.patente})` : ' — Sin vehículo'}
                </option>
              ))}
            </Select>
          </Form.Group>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleAsignar}
          disabled={loading || !choferSeleccionado}
        >
          {loading ? <Spinner animation="border" size="sm" /> : 'Asignar'}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default ModalAsignarChofer;