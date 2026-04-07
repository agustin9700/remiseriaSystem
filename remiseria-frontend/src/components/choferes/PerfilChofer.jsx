import React, { useCallback, useEffect, useState } from 'react';
import axiosInstance from '../../hooks/api/axiosInstance';
import { Badge, Button, Card, CardBody, PageHeader } from '../ui';

/**
 * Perfil del conductor: usa el contrato real GET/PATCH /drivers/me*.
 * Turno y edición de móvil no tienen equivalente en API → solo lectura / deshabilitado.
 */
const PerfilChofer = () => {
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const fetchPerfil = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await axiosInstance.get('/drivers/me');
      setDriver(res.data ?? null);
    } catch (err) {
      const msg =
        err.response?.status === 403
          ? 'No tenés permiso para ver este perfil.'
          : err.response?.data?.message || err.message || 'No se pudo cargar el perfil.';
      setError(msg);
      setDriver(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPerfil();
  }, [fetchPerfil]);

  const toggleEstadoOperativo = async () => {
    if (!driver || statusLoading) return;
    if (driver.estado === 'OCUPADO') return;

    const siguiente = driver.estado === 'DISPONIBLE' ? 'OFFLINE' : 'DISPONIBLE';
    setStatusLoading(true);
    try {
      await axiosInstance.patch('/drivers/me/status', { estado: siguiente });
      await fetchPerfil();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'No se pudo actualizar el estado.';
      setError(msg);
    } finally {
      setStatusLoading(false);
    }
  };

  if (loading && !driver) {
    return (
      <div className="ui-page">
        <div className="text-center mt-5 text-muted">Cargando perfil…</div>
      </div>
    );
  }

  if (error && !driver) {
    return (
      <div className="ui-page">
        <PageHeader title="Perfil del chofer" subtitle="Datos de tu cuenta como conductor." />
        <Card>
          <CardBody>
            <p className="text-danger mb-3">{error}</p>
            <Button type="button" onClick={() => fetchPerfil()}>
              Reintentar
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!driver?.user) {
    return (
      <div className="ui-page">
        <PageHeader title="Perfil del chofer" subtitle="Datos de tu cuenta como conductor." />
        <Card>
          <CardBody>
            <p className="text-muted mb-3">No hay datos de perfil para mostrar.</p>
            <Button type="button" variant="secondary" onClick={() => fetchPerfil()}>
              Reintentar
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  const u = driver.user;
  const estadoLabel = {
    DISPONIBLE: 'Disponible',
    OFFLINE: 'Fuera de línea',
    OCUPADO: 'Ocupado (en viaje)',
  }[driver.estado] || driver.estado;

  return (
    <div className="ui-page">
      <PageHeader title="Perfil del chofer" subtitle="Estado operativo y datos registrados por la remisería." />

      {error && (
        <div
          className="mb-3 p-2 rounded small"
          style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e' }}
          role="status"
        >
          {error}
        </div>
      )}

      <Card>
        <CardBody>
          <h4 className="ui-form-section-title">Datos personales</h4>
          <p>
            <strong>Nombre:</strong> {u.nombre} {u.apellido}
          </p>
          <p>
            <strong>Teléfono:</strong> {u.telefono || '—'}
          </p>
          <p>
            <strong>Rol:</strong> {u.rol}
          </p>
          <p>
            <strong>Cuenta activa:</strong>{' '}
            <Badge tone={u.activo ? 'success' : 'danger'}>{u.activo ? 'Sí' : 'No'}</Badge>
          </p>

          <hr />

          <h4 className="ui-form-section-title">Conductor</h4>
          <p>
            <strong>Licencia:</strong> {driver.licenciaNumero || '—'}
          </p>
          <p>
            <strong>Estado operativo:</strong> {estadoLabel}
          </p>

          <p className="text-muted small mb-2">
            Turnos por API no están disponibles; la disponibilidad se gestiona con el estado operativo (como en el panel
            del conductor).
          </p>

          <Button
            type="button"
            onClick={toggleEstadoOperativo}
            variant={driver.estado === 'DISPONIBLE' ? 'secondary' : 'primary'}
            className="mt-1"
            disabled={statusLoading || driver.estado === 'OCUPADO'}
          >
            {statusLoading
              ? 'Actualizando…'
              : driver.estado === 'OCUPADO'
                ? 'No podés cambiar estado durante un viaje'
                : driver.estado === 'DISPONIBLE'
                  ? 'Pasar a fuera de línea'
                  : 'Pasar a disponible'}
          </Button>

          <hr />

          <h4 className="ui-form-section-title">Vehículo registrado</h4>
          <p className="text-muted small">
            Los cambios de vehículo los realiza un administrador; acá solo se muestran los datos actuales.
          </p>
          <p>
            <strong>Marca / modelo:</strong> {[driver.vehiculoMarca, driver.vehiculoModelo].filter(Boolean).join(' ') || '—'}
          </p>
          <p>
            <strong>Color:</strong> {driver.vehiculoColor || '—'}
          </p>
          <p>
            <strong>Patente:</strong> {driver.patente || '—'}
          </p>

          <div className="mt-3">
            <Button type="button" variant="secondary" size="sm" onClick={() => fetchPerfil()} disabled={loading}>
              Actualizar datos
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default PerfilChofer;
