import React from 'react';
import { FaCar, FaPhone, FaIdCard } from 'react-icons/fa';
import { Badge, Button, Card, CardBody } from '../ui';

const ChoferCard = ({ chofer, onVerDetalle }) => {
  const isLibre = chofer.estado === 'DISPONIBLE';
  const isOcupado = chofer.estado === 'OCUPADO';

  const estadoColor = isLibre ? '#10B981' : isOcupado ? '#F59E0B' : '#6B7280';
  const estadoTexto = isLibre ? 'Disponible' : isOcupado ? 'Ocupado' : 'Offline';
  const estadoTone = isLibre ? 'success' : isOcupado ? 'warning' : 'neutral';

  return (
    <Card className="chofer-card" style={{ overflow: 'hidden' }}>
      <div style={{ background: estadoColor, height: '4px' }} />
      <CardBody>
        <div className="chofer-card-header mb-2">
          <div className="chofer-card-header-main">
            <div className="fw-bold" style={{ fontSize: '1rem' }}>
              {chofer.licenciaNumero || 'Sin licencia'}
            </div>
            <Badge tone={estadoTone} className="mt-1">{estadoTexto}</Badge>
          </div>
          <div className="chofer-card-header-action">
          <Button size="sm" variant="secondary" onClick={() => onVerDetalle(chofer)}>
            Detalles
          </Button>
          </div>
        </div>

        <hr className="my-2" />

        {/* Datos */}
        <div className="d-flex align-items-center mb-1">
          <FaPhone className="me-2 text-muted" size={11} />
          <small>{chofer.user?.telefono || 'Sin teléfono'}</small>
        </div>

        {chofer.patente ? (
          <>
            <div className="d-flex align-items-center mb-1">
              <FaCar className="me-2 text-muted" size={11} />
              <small>{chofer.vehiculoMarca} {chofer.vehiculoModelo}</small>
            </div>
            <div className="d-flex align-items-center">
              <FaIdCard className="me-2 text-muted" size={11} />
              <span className="ui-badge ui-badge-neutral" style={{ letterSpacing: '1px' }}>
                {chofer.patente}
              </span>
              {chofer.vehiculoColor && (
                <small className="text-muted ms-2">· {chofer.vehiculoColor}</small>
              )}
            </div>
          </>
        ) : (
          <small className="text-muted fst-italic">Sin vehículo asignado</small>
        )}
      </CardBody>
    </Card>
  );
};

export default ChoferCard;