import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faTimes,
  faUserPlus,
  faMapMarkerAlt,
  faRedo
} from '@fortawesome/free-solid-svg-icons';
import { Badge, Button, Card, CardBody } from '../ui';

const PedidoCard = ({
  pedido,
  status,
  onAsignar,
  onReasignar,
  onCancelar,
  onFinalizar,
  onVerUbicacion,
  isOperador = true
}) => {
  const estadoReal = pedido?.estado || '';

  const getEstadoBadge = (estado) => {
    const badges = {
      PENDIENTE: { tone: 'warning', text: 'Pendiente' },
      ASIGNADO: { tone: 'info', text: 'Asignado' },
      ACEPTADO: { tone: 'info', text: 'Aceptado' },
      EN_CAMINO: { tone: 'info', text: 'En camino' },
      EN_VIAJE: { tone: 'success', text: 'En viaje' },
      COMPLETADO: { tone: 'success', text: 'Finalizado' },
      CANCELADO: { tone: 'neutral', text: 'Cancelado' },
      RECHAZADO: { tone: 'danger', text: 'Rechazado por operador' },
    };

    const badge = badges[estado] || {
      tone: 'neutral',
      text: estado || 'Sin estado'
    };

    return <Badge tone={badge.tone}>{badge.text}</Badge>;
  };

  const codigoPedido =
    pedido.codigo || `PED-${(pedido.id || '').toString().substring(0, 6)}`;

  const nombreChofer = pedido.chofer?.nombre
    ? `${pedido.chofer.nombre} ${pedido.chofer.apellido || ''}`.trim()
    : null;

  const timestamps = pedido?.timestamps || {};

  const fechaFinalizado =
    pedido.completadoAt || timestamps.completadoAt || null;

  const fechaCancelado =
    pedido.canceladoAt || timestamps.canceladoAt || null;

  const motivoCancelacion =
    pedido.motivoCancelacion ||
    pedido.motivoRechazo ||
    pedido.estados?.motivoCancelacion ||
    pedido.estados?.motivoRechazo ||
    'No especificado';

  const mostrarBloqueChofer =
    ['asignado', 'en_curso', 'finalizado', 'cancelado'].includes(status) ||
    ['ASIGNADO', 'ACEPTADO', 'EN_CAMINO', 'EN_VIAJE', 'COMPLETADO', 'CANCELADO', 'RECHAZADO'].includes(estadoReal);

  const mostrarDatosEnCurso =
    ['ACEPTADO', 'EN_CAMINO', 'EN_VIAJE'].includes(estadoReal) || status === 'en_curso';

  const mostrarFinalizado =
    estadoReal === 'COMPLETADO' || status === 'finalizado';

  const mostrarCancelado =
    ['CANCELADO', 'RECHAZADO'].includes(estadoReal) || status === 'cancelado';

  const getEstadoTimestamp = () => {
    switch (estadoReal) {
      case 'ASIGNADO':
        return {
          label: 'Hora asignado',
          value: timestamps.asignadoAt || null,
        };
      case 'ACEPTADO':
        return {
          label: 'Hora aceptado',
          value: timestamps.aceptadoAt || null,
        };
      case 'EN_CAMINO':
        return {
          label: 'Hora en camino',
          value: timestamps.enCaminoAt || null,
        };
      case 'EN_VIAJE':
        return {
          label: 'Hora de inicio',
          value: timestamps.iniciadoAt || null,
        };
      default:
        return {
          label: 'Hora',
          value: null,
        };
    }
  };

  const estadoTimestamp = getEstadoTimestamp();

  return (
    <Card className="pedido-card">
      <CardBody>
      <div className="d-flex justify-content-between align-items-start">
        <h6 className="mb-1">
          <span className="ui-badge ui-badge-neutral me-2">{codigoPedido}</span>
        </h6>
        {getEstadoBadge(estadoReal)}
      </div>

      <p className="mb-1">
        <small>
          <strong>Cliente:</strong>{' '}
          {pedido.cliente?.nombre || pedido.nombreCliente || 'Sin datos'} —{' '}
          {pedido.cliente?.telefono || pedido.telefonoCliente || 'Sin datos'}
        </small>
      </p>

      <p className="mb-1">
        <small>
          <strong>Origen:</strong>{' '}
          {pedido.viaje?.origen || pedido.origenTexto || 'Sin datos'}
        </small>
      </p>

      <p className="mb-1">
        <small>
          <strong>Destino:</strong>{' '}
          {pedido.viaje?.destino || pedido.destinoTexto || 'Sin especificar'}
        </small>
      </p>

      {mostrarBloqueChofer && (
        <>
          <p className="mb-1">
            <small>
              <strong>Chofer:</strong> {nombreChofer || 'Sin asignar'}
            </small>
          </p>
          <p className="mb-1">
            <small>
              <strong>Licencia:</strong>{' '}
              {pedido.chofer?.licenciaNumero || 'Sin datos'}
            </small>
          </p>
        </>
      )}

      {mostrarDatosEnCurso && (
        <>
          <p className="mb-1">
            <small>
              <strong>Estado actual:</strong> {getEstadoBadge(estadoReal)}
            </small>
          </p>
          <p className="mb-1">
            <small>
              <strong>{estadoTimestamp.label}:</strong>{' '}
              {estadoTimestamp.value
                ? new Date(estadoTimestamp.value).toLocaleString()
                : 'No registrada'}
            </small>
          </p>
        </>
      )}

      {mostrarFinalizado && (
        <>
          <p className="mb-1">
            <small>
              <strong>Precio:</strong> $
              {pedido.montoFinal ??
                pedido.montos?.final ??
                pedido.viaje?.montoFinal ??
                'No informado'}
            </small>
          </p>
          <p className="mb-1">
            <small>
              <strong>Método de Pago:</strong>{' '}
              {pedido.metodoPago ||
                pedido.montos?.metodoPago ||
                pedido.viaje?.metodoPago ||
                'No especificado'}
            </small>
          </p>
          <p className="mb-1">
            <small>
              <strong>Finalizado:</strong>{' '}
              {fechaFinalizado
                ? new Date(fechaFinalizado).toLocaleString()
                : 'No registrada'}
            </small>
          </p>
        </>
      )}

      {mostrarCancelado && (
        <>
          <p className="mb-1">
            <small>
              <strong>Motivo:</strong> {motivoCancelacion}
            </small>
          </p>
          <p className="mb-1">
            <small>
              <strong>Cancelado:</strong>{' '}
              {fechaCancelado
                ? new Date(fechaCancelado).toLocaleString()
                : 'No registrada'}
            </small>
          </p>
        </>
      )}

      <div className="d-flex flex-wrap justify-content-end mt-2 gap-2">
        {status === 'pendiente' && isOperador && (
          <>
            <Button size="sm" variant="secondary" onClick={() => onAsignar(pedido)}>
              <FontAwesomeIcon icon={faUserPlus} /> Asignar
            </Button>
            <Button size="sm" variant="danger" onClick={() => onCancelar(pedido.id)}>
              <FontAwesomeIcon icon={faTimes} /> Cancelar
            </Button>
          </>
        )}

        {status === 'asignado' && isOperador && (
          <>
            <Button size="sm" variant="secondary" onClick={() => onReasignar(pedido.id)}>
              <FontAwesomeIcon icon={faRedo} /> Reasignar
            </Button>
            <Button size="sm" variant="danger" onClick={() => onCancelar(pedido.id)}>
              <FontAwesomeIcon icon={faTimes} /> Cancelar
            </Button>
          </>
        )}

        {isOperador && status === 'en_curso' && onVerUbicacion && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="ubicacion-btn"
            onClick={() => onVerUbicacion(pedido)}
          >
            <FontAwesomeIcon icon={faMapMarkerAlt} /> Ver ubicación
          </Button>
        )}

        {isOperador && status === 'en_curso' && (
          <Button size="sm" className="finalizar-btn" onClick={() => onFinalizar(pedido)}>
            <FontAwesomeIcon icon={faCheck} /> Finalizar
          </Button>
        )}
      </div>
      </CardBody>
    </Card>
  );
};

export default PedidoCard;