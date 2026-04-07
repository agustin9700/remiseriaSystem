import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../hooks/api/axiosInstance';
import { Button, Card, CardBody, Input, PageHeader } from '../ui';

const RegistroChofer = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    email: '',
    password: '',
    vehiculoMarca: '',
    vehiculoModelo: '',
    vehiculoColor: '',
    patente: '',
    licenciaNumero: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Crear usuario con rol DRIVER
      const userRes = await axiosInstance.post('/users', {
        nombre: form.nombre,
        apellido: form.apellido,
        telefono: form.telefono,
        email: form.email || undefined,
        password: form.password,
        rol: 'DRIVER',
      });

      // 2. Crear perfil de chofer con el id del usuario creado
      await axiosInstance.post('/drivers', {
        userId: userRes.data.id,
        vehiculoMarca: form.vehiculoMarca || undefined,
        vehiculoModelo: form.vehiculoModelo || undefined,
        vehiculoColor: form.vehiculoColor || undefined,
        patente: form.patente || undefined,
        licenciaNumero: form.licenciaNumero || undefined,
      });

      alert('Chofer registrado exitosamente');
      navigate('/choferes');
    } catch (error) {
      console.error('Error al registrar chofer:', error);
      alert('Error: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ui-page">
      <PageHeader title="Registro de Chofer" subtitle="Alta de chofer con datos de usuario y vehiculo." />

      <form onSubmit={handleSubmit} className="row g-4">

        {/* DATOS DE USUARIO */}
        <div className="col-md-6">
          <Card className="h-100">
            <CardBody>
            <h4 className="ui-form-section-title">Datos de Usuario</h4>

            <div className="mb-3">
              <label className="form-label">Nombre *</label>
              <Input
                type="text"
                name="nombre"
                className="form-control"
                placeholder="Ej: Juan"
                value={form.nombre}
                onChange={handleChange}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Apellido *</label>
              <Input
                type="text"
                name="apellido"
                className="form-control"
                placeholder="Ej: Pérez"
                value={form.apellido}
                onChange={handleChange}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Teléfono *</label>
              <Input
                type="text"
                name="telefono"
                className="form-control"
                placeholder="Ej: 3815998242"
                value={form.telefono}
                onChange={handleChange}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Email (opcional)</label>
              <Input
                type="email"
                name="email"
                className="form-control"
                placeholder="Ej: juan@mail.com"
                value={form.email}
                onChange={handleChange}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Contraseña *</label>
              <Input
                type="password"
                name="password"
                className="form-control"
                placeholder="Mínimo 6 caracteres"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
              />
            </div>
            </CardBody>
          </Card>
        </div>

        {/* DATOS DEL VEHÍCULO */}
        <div className="col-md-6">
          <Card className="h-100">
            <CardBody>
            <h4 className="ui-form-section-title">Datos del Vehículo</h4>

            <div className="mb-3">
              <label className="form-label">Marca</label>
              <Input
                type="text"
                name="vehiculoMarca"
                className="form-control"
                placeholder="Ej: Toyota"
                value={form.vehiculoMarca}
                onChange={handleChange}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Modelo</label>
              <Input
                type="text"
                name="vehiculoModelo"
                className="form-control"
                placeholder="Ej: Corolla"
                value={form.vehiculoModelo}
                onChange={handleChange}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Color</label>
              <Input
                type="text"
                name="vehiculoColor"
                className="form-control"
                placeholder="Ej: Blanco"
                value={form.vehiculoColor}
                onChange={handleChange}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Patente</label>
              <Input
                type="text"
                name="patente"
                className="form-control"
                placeholder="Ej: ABC123"
                value={form.patente}
                onChange={handleChange}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Número de Licencia</label>
              <Input
                type="text"
                name="licenciaNumero"
                className="form-control"
                placeholder="Ej: 123456"
                value={form.licenciaNumero}
                onChange={handleChange}
              />
            </div>
            </CardBody>
          </Card>
        </div>

        {/* BOTONES */}
        <div className="col-12 ui-form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/choferes')}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading}
          >
            {loading ? 'Registrando...' : 'Crear Chofer'}
          </Button>
        </div>

      </form>
    </div>
  );
};

export default RegistroChofer;