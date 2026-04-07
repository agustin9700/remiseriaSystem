import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlusCircle, faSyncAlt, faColumns
} from '@fortawesome/free-solid-svg-icons';
import ChoferCard from '../components/choferes/ChoferCard';
import ChoferDetailModal from '../components/choferes/ChoferDetailModal';
import useChoferes from '../hooks/useChoferes';
import { getUserRole } from '../utils/auth';
import { Badge, Button, Card, CardBody, Loader, PageHeader, StatCard, Tabs, Skeleton } from '../components/ui';

const ChoferesPage = () => {
  const userRole = getUserRole();
  const isAdmin = userRole === 'ADMIN';
  const navigate = useNavigate();
  const { choferes, loading, error, fetchChoferes } = useChoferes();

  const [filtro, setFiltro] = useState('todos');
  const [showChoferDetail, setShowChoferDetail] = useState(false);
  const [choferSeleccionado, setChoferSeleccionado] = useState(null);

  useEffect(() => {
    fetchChoferes();
  }, []);

  const getChoferesArray = () => {
    if (Array.isArray(choferes)) return choferes;
    if (choferes && typeof choferes === 'object') return Object.values(choferes);
    return [];
  };

  const choferesArray = getChoferesArray();

  const choferesFiltrados = choferesArray.filter(chofer => {
    if (!chofer || typeof chofer !== 'object') return false;

    if (filtro === 'todos') return true;
    if (filtro === 'libres') return chofer.estado === 'DISPONIBLE';
    if (filtro === 'ocupados') return chofer.estado === 'OCUPADO';
    if (filtro === 'inactivos') return chofer.estado === 'OFFLINE';

    return false;
  });

  const contarChoferes = (tipo) => {
    switch (tipo) {
      case 'libres':
        return choferesArray.filter(c => c.estado === 'DISPONIBLE').length;
      case 'ocupados':
        return choferesArray.filter(c => c.estado === 'OCUPADO').length;
      case 'inactivos':
        return choferesArray.filter(c => c.estado === 'OFFLINE').length;
      default:
        return choferesArray.length;
    }
  };

  const handleVerDetalleChofer = (chofer) => {
    setChoferSeleccionado(chofer);
    setShowChoferDetail(true);
  };

  if (loading) {
    return (
      <div className="ui-page">
        <PageHeader
          title="Choferes"
          subtitle="Monitoreo y gestion operativa de conductores."
        />
        <Card className="mb-3">
          <CardBody>
            <Skeleton height={32} />
          </CardBody>
        </Card>
        <div className="row g-3 mb-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="col-md-3" key={i}>
              <Card>
                <CardBody>
                  <Skeleton height={14} />
                  <div className="mt-2">
                    <Skeleton height={24} />
                  </div>
                </CardBody>
              </Card>
            </div>
          ))}
        </div>
        <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="col" key={i}>
              <Card>
                <CardBody>
                  <Skeleton height={16} />
                  <div className="mt-2"><Skeleton height={12} /></div>
                  <div className="mt-2"><Skeleton height={12} /></div>
                </CardBody>
              </Card>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (error) return <div className="ui-page"><div className="alert alert-danger">Error: {error}</div></div>;

  return (
    <div className="ui-page">
      <PageHeader
        title="Choferes"
        subtitle="Monitoreo y gestion operativa de conductores."
        actions={(
          <>
            <Button variant="secondary" onClick={() => navigate('/pedidos')}>
              <FontAwesomeIcon icon={faColumns} /> Panel pedidos
            </Button>
            {isAdmin && (
              <Button onClick={() => navigate('/registroChofer')}>
                <FontAwesomeIcon icon={faPlusCircle} /> Nuevo chofer
              </Button>
            )}
          </>
        )}
      />

      <Card className="mb-3">
        <CardBody className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <Tabs
            value={filtro}
            onChange={setFiltro}
            items={[
              { value: 'todos', label: 'Todos' },
              { value: 'libres', label: 'Libres' },
              { value: 'ocupados', label: 'Ocupados' },
              { value: 'inactivos', label: 'Inactivos' },
            ]}
          />
          <Button variant="secondary" onClick={fetchChoferes}>
            <FontAwesomeIcon icon={faSyncAlt} /> Actualizar
          </Button>
        </CardBody>
      </Card>

      <div className="row g-3 mb-3">
        <div className="col-md-3"><StatCard label="Total" value={contarChoferes('todos')} tone="info" /></div>
        <div className="col-md-3"><StatCard label="Libres" value={contarChoferes('libres')} tone="success" /></div>
        <div className="col-md-3"><StatCard label="Ocupados" value={contarChoferes('ocupados')} tone="warning" /></div>
        <div className="col-md-3"><StatCard label="Inactivos" value={contarChoferes('inactivos')} tone="neutral" /></div>
      </div>

      {choferesFiltrados.length > 0 ? (
        <div className="driver-grid">
          {choferesFiltrados.map((chofer) => (
            <ChoferCard key={chofer.id} chofer={chofer} onVerDetalle={handleVerDetalleChofer} />
          ))}
        </div>
      ) : (
        <Card>
          <CardBody className="ui-empty-state">
            <Badge tone="neutral">Sin resultados</Badge>
            <p className="text-muted mt-2">No hay choferes para este filtro.</p>
          </CardBody>
        </Card>
      )}

      <ChoferDetailModal
        show={showChoferDetail}
        onHide={() => {
          setShowChoferDetail(false);
          setChoferSeleccionado(null);
        }}
        chofer={choferSeleccionado}
      />
    </div>
  );
};

export default ChoferesPage;