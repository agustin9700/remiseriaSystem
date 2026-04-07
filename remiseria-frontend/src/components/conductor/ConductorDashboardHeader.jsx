import { Row, Col, Card, Badge } from 'react-bootstrap';
import { Badge as UiBadge, PageHeader } from '../ui';

/**
 * Cabecera: título, nombre, rol y badges de conexión / estado operativo.
 */
export default function ConductorDashboardHeader({
  nombreConductor,
  userRole,
  isConnected,
  miEstado,
}) {
  return (
    <Row className="mb-3">
      <Col>
        <Card className="shadow-sm border-0">
          <Card.Body className="d-flex flex-wrap justify-content-between align-items-center">
            <div>
              <PageHeader title="Panel del conductor" subtitle={nombreConductor} />
              <small className="text-muted">
                {userRole && <UiBadge tone="info">{userRole}</UiBadge>}
              </small>
            </div>
            <div className="d-flex gap-2 mt-2 mt-md-0">
              <Badge bg={isConnected ? 'success' : 'secondary'} className="px-3 py-2 rounded-pill">
                {isConnected ? '🟢 Tiempo real' : '⚫ Modo REST'}
              </Badge>
              <Badge
                bg={miEstado === 'DISPONIBLE' ? 'success' : miEstado === 'OCUPADO' ? 'warning' : 'secondary'}
                className="px-3 py-2 rounded-pill"
              >
                {miEstado === 'DISPONIBLE'
                  ? '🟢 Disponible'
                  : miEstado === 'OCUPADO'
                    ? '🟡 Ocupado'
                    : '⚫ Offline'}
              </Badge>
            </div>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}
