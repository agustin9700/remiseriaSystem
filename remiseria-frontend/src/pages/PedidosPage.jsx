import React, { useState, useEffect } from 'react';
import { usePedidos } from '../hooks/usePedidos';
import { usePedidosSocket } from '../hooks/usePedidosSocket';
import PedidoCard from '../components/pedidos/PedidoCard';
import ChoferCard from '../components/choferes/ChoferCard';
import ChoferDetailModal from '../components/choferes/ChoferDetailModal';
import NuevoPedidoModal from '../components/pedidos/modals/NuevoPedidoModal';
import ModalFinalizar from '../components/pedidos/modals/ModalFinalizar';
import ModalAsignarChofer from '../components/pedidos/modals/ModalAsignarChofer';
import MapaUbicacionPedidoModal from '../components/pedidos/modals/MapaUbicacionPedidoModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTasks, faPlusCircle, faUserCheck,
  faTruck, faUserLock, faBan
} from '@fortawesome/free-solid-svg-icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getUserRole } from '../utils/auth';
import { Badge, Button, Card, CardBody, CardHeader, PageHeader, StatCard, Table, Skeleton, useToast } from '../components/ui';

const PedidosPage = () => {
  const toast = useToast();
  const userRole   = getUserRole();
  const isOperador = userRole === 'OPERATOR' || userRole === 'ADMIN';

  const {
    pedidos, setPedidos, loading, error,
    asignarPedido, finalizarPedidoPorOperador, cancelarPedido,
    fetchPedidos, reasignarPedido,
  } = usePedidos();

  const [showFinalizarModal,  setShowFinalizarModal]  = useState(false);
  const [pedidoSeleccionado,  setPedidoSeleccionado]  = useState(null);
  const [showNuevoPedido,     setShowNuevoPedido]     = useState(false);
  const [showAsignarChofer,   setShowAsignarChofer]   = useState(false);
  const [showChoferDetail,    setShowChoferDetail]    = useState(false);
  const [choferSeleccionado,  setChoferSeleccionado]  = useState(null);
  const [pedidoAAsignar,      setPedidoAAsignar]      = useState(null);
  const [pedidoParaMapa,      setPedidoParaMapa]      = useState(null);
  const [ubicacionChoferLive, setUbicacionChoferLive] = useState(null);
  const [finalizadosMostrar,  setFinalizadosMostrar]  = useState(2);
  const [canceladosMostrar,   setCanceladosMostrar]   = useState(2);

  const pedidosFinalizadosFiltrados = pedidos.finalizados.slice(0, finalizadosMostrar);
  const pedidosCanceladosFiltrados  = pedidos.cancelados.slice(0,  canceladosMostrar);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Toda la lógica de socket y polling en el hook dedicado
  usePedidosSocket({ setPedidos, fetchPedidos, setUbicacionChoferLive });

  useEffect(() => {
    if (Notification?.permission === 'default') Notification.requestPermission();
  }, []);

  useEffect(() => {
    if (searchParams.get('reload') === 'true') {
      fetchPedidos();
      navigate('/pedidos', { replace: true });
    }
  }, [searchParams, fetchPedidos, navigate]);

  const handleAbrirModalAsignar = (pedido) => { setPedidoAAsignar(pedido); setShowAsignarChofer(true); };
  const handleVerDetalleChofer  = (chofer) => { setChoferSeleccionado(chofer); setShowChoferDetail(true); };
  const handleFinalizarPedido   = (pedido) => { setPedidoSeleccionado(pedido); setShowFinalizarModal(true); };

  if (loading) {
    return (
      <div className="ui-page">
        <PageHeader title="Pedidos" subtitle="Operacion en tiempo real con estados y asignaciones." />
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
        <div className="row g-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="col-md-4" key={i}>
              <Card>
                <CardHeader><Skeleton height={14} /></CardHeader>
                <CardBody>
                  <Skeleton height={12} />
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
  if (error)   return <div className="ui-page"><div className="text-danger">Error: {error}</div></div>;

  const columnasPrincipales = [
    {
      title: `Pedidos Pendientes (${pedidos.pendientes.length})`,
      pedidos: pedidos.pendientes, status: 'pendiente',
      bg: '#fef3c7', textColor: '#92400e',
      actions: { onAsignar: handleAbrirModalAsignar, onCancelar: cancelarPedido },
    },
    {
      title: `Pedidos Asignados (${pedidos.asignados.length})`,
      pedidos: pedidos.asignados, status: 'asignado',
      bg: '#dbeafe', textColor: '#1d4ed8',
      actions: { onFinalizar: handleFinalizarPedido, onReasignar: reasignarPedido, onCancelar: cancelarPedido },
    },
    {
      title: `Pedidos en Curso (${pedidos.en_curso.length})`,
      pedidos: pedidos.en_curso, status: 'en_curso',
      bg: '#dbeafe', textColor: '#1d4ed8',
      actions: { onFinalizar: handleFinalizarPedido },
    },
  ];

  return (
    <div className="ui-page">
      <PageHeader
        title="Pedidos"
        subtitle="Operacion en tiempo real con estados y asignaciones."
        actions={(
          <Button onClick={() => setShowNuevoPedido(true)}>
            <FontAwesomeIcon icon={faPlusCircle} /> Nuevo pedido
          </Button>
        )}
      />

      <div className="ui-section">
        <div className="row g-3">
          <div className="col-md-3"><StatCard label="Pendientes" value={pedidos.pendientes.length} tone="warning" icon={<FontAwesomeIcon icon={faTasks} />} /></div>
          <div className="col-md-3"><StatCard label="Asignados" value={pedidos.asignados.length} tone="info" icon={<FontAwesomeIcon icon={faUserCheck} />} /></div>
          <div className="col-md-3"><StatCard label="En curso" value={pedidos.en_curso.length} tone="info" icon={<FontAwesomeIcon icon={faTruck} />} /></div>
          <div className="col-md-3"><StatCard label="Cancelados" value={pedidos.cancelados.length} tone="neutral" icon={<FontAwesomeIcon icon={faBan} />} /></div>
        </div>
      </div>

      <div className="row g-4">
        {columnasPrincipales.map(({ title, pedidos: lista, status, bg, textColor, actions }, idx) => (
          <div className="col-md-4" key={idx}>
            <Card>
              <CardHeader style={{ background: bg, color: textColor }}>{title}</CardHeader>
              <CardBody style={{ minHeight: '250px' }}>
                {lista.length ? (
                  lista.map((pedido) => (
                    <PedidoCard key={pedido.id} pedido={pedido} status={status} isOperador={isOperador}
                      onVerUbicacion={(p) => setPedidoParaMapa(p)} {...actions} />
                  ))
                ) : (
                  <div className="ui-empty-state">
                    <Badge tone="neutral">Sin pedidos</Badge>
                    <div className="mt-2">No hay pedidos {status.replace('_', ' ')}</div>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        ))}
      </div>

      <div className="row mt-4">
        <div className="col-12">
          <Card>
            <CardHeader className="d-flex justify-content-between align-items-center">
              <span><FontAwesomeIcon icon={faTruck} className="me-2" />Pedidos finalizados</span>
              <Badge tone="success">{pedidos.finalizados.length}</Badge>
            </CardHeader>
            <CardBody>
              {pedidosFinalizadosFiltrados.length ? (
                <>
                  <Table>
                    <thead>
                      <tr><th>Codigo</th><th>Cliente</th><th>Chofer</th><th>Monto</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      {pedidosFinalizadosFiltrados.map((p) => (
                        <tr key={p.id}>
                          <td>{p.codigo || p.id}</td>
                          <td>{p.cliente?.nombre || p.nombreCliente || 'N/A'}</td>
                          <td>{p.chofer?.nombre || 'Sin asignar'}</td>
                          <td>
                            {(() => {
                              const monto = p.montoFinal ?? p.montos?.final ?? p.viaje?.montoFinal ?? p.montoEstimado;
                              if (!monto && monto !== 0) return '$-';
                              const num = typeof monto === 'number' ? monto : Number(String(monto).replace(/[^\d.-]/g, ''));
                              return Number.isFinite(num) ? `$ ${num.toLocaleString('es-AR')}` : '$-';
                            })()}
                          </td>
                          <td><Badge tone="success">Finalizado</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  {finalizadosMostrar < pedidos.finalizados.length && (
                    <div className="text-center mt-3">
                      <Button variant="secondary" onClick={() => setFinalizadosMostrar((n) => n + 10)}>Ver mas</Button>
                    </div>
                  )}
                </>
              ) : <div className="ui-empty-state"><div className="text-muted">No hay pedidos finalizados</div></div>}
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="row mt-4">
        <div className="col-12">
          <Card>
            <CardHeader className="d-flex justify-content-between align-items-center">
              <span><FontAwesomeIcon icon={faBan} className="me-2" />Pedidos cancelados / rechazados</span>
              <Badge tone="neutral">{pedidos.cancelados.length}</Badge>
            </CardHeader>
            <CardBody style={{ minHeight: '180px' }}>
              {pedidosCanceladosFiltrados.length ? (
                <>
                  {pedidosCanceladosFiltrados.map((p) => <PedidoCard key={p.id} pedido={p} status="cancelado" />)}
                  {canceladosMostrar < pedidos.cancelados.length && (
                    <div className="text-center mt-3">
                      <Button variant="secondary" onClick={() => setCanceladosMostrar((n) => n + 10)}>Ver mas</Button>
                    </div>
                  )}
                </>
) : (
                  <div className="ui-empty-state">
                    <Badge tone="neutral">Sin cancelados</Badge>
                    <div className="mt-2">No hay pedidos cancelados</div>
                  </div>
                )}
            </CardBody>
          </Card>
        </div>
      </div>

      {[
        { title: 'Choferes Activos y Libres',   icon: faUserCheck, bg: '#10B981', choferes: pedidos.choferesLibres,   emptyMessage: 'No hay choferes disponibles actualmente' },
        { title: 'Choferes Activos y Ocupados', icon: faUserLock,  bg: '#6B7280', choferes: pedidos.choferesOcupados, emptyMessage: 'No hay choferes ocupados actualmente' },
      ].map(({ title, icon, bg, choferes, emptyMessage }, i) => (
        <div className="row mt-5" key={i}>
          <div className="col-12">
            <Card>
              <CardHeader className="d-flex flex-wrap justify-content-between align-items-center gap-2" style={{ background: bg, color: '#fff' }}>
                <div className="d-flex align-items-center gap-2">
                  <FontAwesomeIcon icon={icon} />
                  <span>{title}</span>
                  <Badge tone="neutral">{choferes.length}</Badge>
                </div>
                <Button size="sm" variant="secondary" onClick={() => navigate('/choferes')}>Ver choferes</Button>
              </CardHeader>
              <CardBody>
                {choferes.length ? (
                  <div className="driver-grid driver-grid-tight">
                    {choferes.map((chofer) => (
                      <ChoferCard key={chofer.id} chofer={chofer} onVerDetalle={() => handleVerDetalleChofer(chofer)} />
                    ))}
                  </div>
                ) : (
                  <div className="ui-empty-state">
                    <div className="text-muted">{emptyMessage}</div>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      ))}

      <NuevoPedidoModal show={showNuevoPedido} onHide={() => setShowNuevoPedido(false)} onPedidoCreado={() => {}} />

      <ModalAsignarChofer
        show={showAsignarChofer}
        onHide={() => { setShowAsignarChofer(false); setPedidoAAsignar(null); }}
        pedido={pedidoAAsignar}
        asignarPedido={asignarPedido}
      />

      <ModalFinalizar
        show={showFinalizarModal}
        onHide={() => setShowFinalizarModal(false)}
        onConfirm={(datos) =>
          finalizarPedidoPorOperador(pedidoSeleccionado.id, datos)
            .then(() => {
              toast.success('Pedido finalizado correctamente');
              setShowFinalizarModal(false);
            })
            .catch((err) => {
              console.error('Error al finalizar:', err);
              toast.error(err.response?.data?.message || 'Error al finalizar el pedido');
            })
        }
        pedido={pedidoSeleccionado}
      />

      <ChoferDetailModal show={showChoferDetail} onHide={() => setShowChoferDetail(false)} chofer={choferSeleccionado} />

      <MapaUbicacionPedidoModal
        show={!!pedidoParaMapa}
        onHide={() => { setPedidoParaMapa(null); setUbicacionChoferLive(null); }}
        pedido={pedidoParaMapa}
        ubicacionChoferLive={ubicacionChoferLive}
      />
    </div>
  );
};

export default PedidosPage;
