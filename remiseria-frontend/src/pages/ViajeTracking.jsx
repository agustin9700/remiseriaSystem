import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axiosInstance from '../hooks/api/axiosInstance';
import ClienteMapTracking from '../components/cliente/ClienteMapTracking';
import { Badge, Card, CardBody, CardHeader, Loader, PageHeader } from '../components/ui';

const FINAL_TRACKING_STATES = new Set(['COMPLETADO', 'CANCELADO', 'RECHAZADO']);

const ViajeTracking = () => {
  const { codigo } = useParams();
  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPedido = async () => {
    try {
      const res = await axiosInstance.get(`/orders/track/${codigo}`);
      setPedido(res.data || null);
      setError('');
    } catch {
      setPedido(null);
      setError('No se encontró el viaje');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPedido();

    // RECHAZADO aplica a rechazo administrativo.
    if (pedido && FINAL_TRACKING_STATES.has(pedido.estado)) return;

    const interval = setInterval(fetchPedido, 5000);
    return () => clearInterval(interval);
  }, [codigo, pedido?.estado]);

  const renderEstado = () => {
    if (!pedido) return null;

    switch (pedido.estado) {
      case 'PENDIENTE':
        return '🔍 Buscando chofer...';
      case 'ASIGNADO':
        return '🚗 Chofer asignado';
      case 'ACEPTADO':
        return '✅ Chofer aceptó el viaje';
      case 'EN_CAMINO':
        return '🛣️ El chofer está en camino';
      case 'EN_VIAJE':
        return '🚕 Viaje en curso';
      case 'COMPLETADO':
        return '🏁 Viaje finalizado';
      case 'CANCELADO':
        return '❌ Viaje cancelado';
      case 'RECHAZADO':
        return '⛔ Viaje rechazado por operador';
      default:
        return pedido.estado;
    }
  };

  const tarifaEstimada =
    pedido?.montos?.estimado ??
    pedido?.montoEstimado ??
    pedido?.viaje?.montoEstimado ??
    null;

  const precioFinal =
    pedido?.montos?.final ??
    pedido?.montoFinal ??
    pedido?.viaje?.montoFinal ??
    null;

  const metodoPago =
    pedido?.montos?.metodoPago ??
    pedido?.metodoPago ??
    pedido?.viaje?.metodoPago ??
    null;

  if (loading) {
    return <div className="ui-page"><Loader label="Cargando viaje..." /></div>;
  }

  if (error || !pedido) {
    return <div className="ui-page"><div className="alert alert-danger mb-0">{error || 'No se encontro el viaje'}</div></div>;
  }

  return (
    <div className="ui-page">
      <PageHeader title={`Viaje ${pedido.codigo}`} subtitle="Tracking publico en tiempo real" />
      <Card className="mb-3">
        <CardHeader className="d-flex justify-content-between align-items-center">
          <span>Estado actual</span>
          <Badge tone={pedido.estado === 'COMPLETADO' ? 'success' : pedido.estado === 'CANCELADO' || pedido.estado === 'RECHAZADO' ? 'danger' : 'info'}>
            {pedido.estado}
          </Badge>
        </CardHeader>
        <CardBody>
          <p className="mb-2"><strong>Detalle:</strong> {renderEstado()}</p>
          <p className="mb-2"><strong>Origen:</strong> {pedido.viaje?.origen || pedido.origenTexto || 'No disponible'}</p>
          <p className="mb-0"><strong>Destino:</strong> {pedido.viaje?.destino || pedido.destinoTexto || 'No disponible'}</p>
        </CardBody>
      </Card>

      {tarifaEstimada && pedido.estado !== 'COMPLETADO' && (
        <Card className="mb-3"><CardBody><strong>Tarifa estimada:</strong> ${tarifaEstimada}</CardBody></Card>
      )}

      {pedido.chofer ? (
        <Card className="mb-3">
          <CardBody>
          <h3 className="h6">Chofer asignado</h3>
          <p>
            {pedido.chofer.nombre} {pedido.chofer.apellido || ''}
          </p>
          <p>📞 {pedido.chofer.telefono || 'Sin teléfono'}</p>

          {pedido.chofer.vehiculo && (
            <p>
              🚘 {pedido.chofer.vehiculo.marca} {pedido.chofer.vehiculo.modelo} ·{' '}
              {pedido.chofer.vehiculo.color} · {pedido.chofer.vehiculo.patente}
            </p>
          )}
          </CardBody>
        </Card>
      ) : pedido.estado === 'PENDIENTE' || pedido.estado === 'ASIGNADO' ? (
        <Card className="mb-3"><CardBody>Buscando chofer...</CardBody></Card>
      ) : null}
      {pedido.montos?.estimado && (
  <p>
    <strong>Precio estimado:</strong> ${pedido.montos.estimado}
  </p>
)}

      {precioFinal && (
        <p>
          <strong>Precio final:</strong> ${precioFinal}
        </p>
      )}

      {metodoPago && (
        <p>
          <strong>Método de pago:</strong> {metodoPago}
        </p>
      )}

      {['ASIGNADO', 'ACEPTADO', 'EN_CAMINO', 'EN_VIAJE'].includes(pedido.estado) && (
        <div className="mt-3">
          <ClienteMapTracking codigo={codigo} viaje={pedido} onViajeUpdate={setPedido} />
        </div>
      )}
    </div>
  );
};

export default ViajeTracking;