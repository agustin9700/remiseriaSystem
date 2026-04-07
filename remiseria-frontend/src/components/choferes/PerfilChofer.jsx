import React, { useEffect, useState } from 'react';
import axiosInstance from '../../hooks/api/axiosInstance';
import { Badge, Button, Card, CardBody, Input, PageHeader, Select } from '../ui';

const PerfilChofer = () => {
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editTurno, setEditTurno] = useState(false);
  const [nuevoTurno, setNuevoTurno] = useState('');
  const [editMovil, setEditMovil] = useState(false);
  const [movilForm, setMovilForm] = useState({
    numero: '',
    marca: '',
    modelo: '',
    patente: ''
  });

  const obtenerPerfil = async () => {
    try {
      const res = await axiosInstance.get('/choferes/perfil');
      setPerfil(res.data);
      setNuevoTurno(res.data.turno);
      setMovilForm({
        numero: res.data.movilActual?.numero || '',
        marca: res.data.movilActual?.marca || '',
        modelo: res.data.movilActual?.modelo || '',
        patente: res.data.movilActual?.patente || ''
      });
    } catch (err) {
      console.error('Error al obtener perfil del chofer', err);
    }
  };

  useEffect(() => {
    obtenerPerfil();
  }, []);

  const toggleEstado = async () => {
    if (!perfil) return;
    const nuevoEstado = !perfil.activo;
    setLoading(true);

    try {
      await axiosInstance.put('/choferes/estado', { activo: nuevoEstado });
      await obtenerPerfil();
    } catch (err) {
      console.error('Error al actualizar estado', err);
    } finally {
      setLoading(false);
    }
  };

  const guardarNuevoTurno = async () => {
    try {
      await axiosInstance.put('/choferes/turno', { turno: nuevoTurno });
      setEditTurno(false);
      await obtenerPerfil();
    } catch (err) {
      console.error('Error al actualizar turno', err);
    }
  };

  const guardarMovil = async () => {
    try {
      await axiosInstance.put('/choferes/movil', movilForm);
      setEditMovil(false);
      await obtenerPerfil();
    } catch (err) {
      console.error('Error al actualizar datos del móvil', err);
    }
  };

  const handleMovilChange = (e) => {
  const { name, value } = e.target;
  setMovilForm((prev) => ({
    ...prev,
    [name]: value
  }));
};

  if (!perfil) return <div className="ui-page"><div className="text-center mt-5">Cargando perfil...</div></div>;

  const { user, telefono, turno, licencia, activo, estado_operativo, movilActual } = perfil;

  return (
    <div className="ui-page">
      <PageHeader title="Perfil del Chofer" subtitle="Gestion de estado, turno y movil asignado." />
      <Card>
        <CardBody>
        <h4 className="ui-form-section-title">Datos personales</h4>
        <p><strong>Nombre:</strong> {user.nombre} {user.apellido}</p>
        <p><strong>Usuario:</strong> {user.usuario}</p>
        <p><strong>Rol:</strong> {user.role}</p>

        <hr />

        <h4 className="ui-form-section-title">Datos como chofer</h4>
        <p><strong>Teléfono:</strong> {telefono}</p>

        <p><strong>Turno:</strong>{' '}
          {editTurno ? (
            <>
              <Select
                className="w-auto d-inline-block"
                value={nuevoTurno}
                onChange={(e) => setNuevoTurno(e.target.value)}
              >
                <option value="mañana">Mañana</option>
                <option value="tarde">Tarde</option>
                <option value="noche">Noche</option>
              </Select>
              <Button size="sm" onClick={guardarNuevoTurno} className="ms-2">
                Guardar
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setEditTurno(false)} className="ms-2">
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <span className="ms-1">{turno}</span>
              <Button size="sm" variant="secondary" onClick={() => setEditTurno(true)} className="ms-3">
                Editar
              </Button>
            </>
          )}
        </p>

        <p><strong>Licencia:</strong> {licencia}</p>

        <p>
          <strong>Activo:</strong>{' '}
          <Badge tone={activo ? 'success' : 'danger'} className="ms-2">{activo ? 'Sí' : 'No'}</Badge>
        </p>
        <p><strong>Estado operativo:</strong> {estado_operativo}</p>

        <Button
          onClick={toggleEstado}
          variant={activo ? 'secondary' : 'primary'}
          className="mt-3"
          disabled={loading}
        >
          {loading
            ? 'Cambiando estado...'
            : activo
              ? 'Finalizar turno'
              : 'Iniciar turno'}
        </Button>

        {movilActual && (
  <>
    <hr />
    <h4 className="ui-form-section-title">Móvil asignado</h4>

    {editMovil ? (
      <>
        <div className="row">
          <div className="col-md-6 mb-2">
            <label><strong>Número</strong></label>
            <Input
              type="text"
              name="numero"
              className="form-control"
              value={movilForm.numero}
              onChange={handleMovilChange}
            />
          </div>
          <div className="col-md-6 mb-2">
            <label><strong>Marca</strong></label>
            <Input
              type="text"
              name="marca"
              className="form-control"
              value={movilForm.marca}
              onChange={handleMovilChange}
            />
          </div>
          <div className="col-md-6 mb-2">
            <label><strong>Modelo</strong></label>
            <Input
              type="text"
              name="modelo"
              className="form-control"
              value={movilForm.modelo}
              onChange={handleMovilChange}
            />
          </div>
          <div className="col-md-6 mb-2">
            <label><strong>Patente</strong></label>
            <Input
              type="text"
              name="patente"
              className="form-control"
              value={movilForm.patente}
              onChange={handleMovilChange}
            />
          </div>
        </div>
        <Button className="mt-2 me-2" onClick={guardarMovil}>
          Guardar
        </Button>
        <Button variant="secondary" className="mt-2" onClick={() => setEditMovil(false)}>
          Cancelar
        </Button>
      </>
    ) : (
      <>
        <p><strong>Número:</strong> {movilActual.numero}</p>
        <p><strong>Marca:</strong> {movilActual.marca}</p>
        <p><strong>Modelo:</strong> {movilActual.modelo}</p>
        <p><strong>Patente:</strong> {movilActual.patente}</p>
        <Button
          size="sm"
          variant="secondary"
          className="mt-2"
          onClick={() => setEditMovil(true)}
        >
          Editar datos del móvil
        </Button>
      </>
    )}
  </>
)}
        </CardBody>
      </Card>
    </div>
  );
};

export default PerfilChofer;
