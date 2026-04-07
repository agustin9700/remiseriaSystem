import { Card, ListGroup } from 'react-bootstrap';
import { FaHistory } from 'react-icons/fa';
import { formatearFechaHistorial } from './conductorDashboard.helpers';

/**
 * Lista de historial de viajes del chofer.
 */
export default function ConductorHistoryCard({ historial }) {
  return (
    <Card className="shadow-sm">
      <Card.Header className="bg-dark text-white">
        <FaHistory className="me-2" />
        Historial
      </Card.Header>
      <Card.Body>
        {historial.length > 0 ? (
          <ListGroup variant="flush">
            {historial.map((item) => (
              <ListGroup.Item key={item.id}>
                <strong>{item.codigo}</strong> — {formatearFechaHistorial(item)}
              </ListGroup.Item>
            ))}
          </ListGroup>
        ) : (
          <p className="text-muted text-center">Sin viajes recientes</p>
        )}
      </Card.Body>
    </Card>
  );
}
