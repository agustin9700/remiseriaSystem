import { useState, useEffect } from 'react';
import { Alert, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../hooks/api/axiosInstance';
import { decodeJWT } from '../utils/auth';
import { getAccessToken } from '../utils/tokenStorage';
import { Button, Card, CardBody, PageHeader, Input, Select } from '../components/ui';

const CrearUsuario = () => {
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    email: '',
    password: '',
    rol: '',
    vehiculoMarca: '',
    vehiculoModelo: '',
    vehiculoColor: '',
    patente: '',
    licenciaNumero: '',
  });

  const [error, setError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      navigate('/');
      return;
    }

    const decoded = decodeJWT(token);
    if (!decoded || decoded.rol !== 'ADMIN') {
      setError('Solo administradores pueden acceder a esta página');
      return;
    }

  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (!form.nombre || !form.apellido || !form.telefono || !form.password || !form.rol) {
      setSubmitError('Por favor completá todos los campos obligatorios');
      return;
    }

    if (form.password.length < 6) {
      setSubmitError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      const userPayload = {
        nombre: form.nombre,
        apellido: form.apellido,
        telefono: form.telefono,
        password: form.password,
        rol: form.rol,
        ...(form.email && { email: form.email }),
      };

      const res = await axiosInstance.post('/users', userPayload);
      const nuevoUsuario = res.data;

      if (form.rol === 'DRIVER') {
        const driverPayload = {
          userId: nuevoUsuario.id,
          ...(form.vehiculoMarca && { vehiculoMarca: form.vehiculoMarca }),
          ...(form.vehiculoModelo && { vehiculoModelo: form.vehiculoModelo }),
          ...(form.vehiculoColor && { vehiculoColor: form.vehiculoColor }),
          ...(form.patente && { patente: form.patente }),
          ...(form.licenciaNumero && { licenciaNumero: form.licenciaNumero }),
        };

        await axiosInstance.post('/drivers', driverPayload);
      }

      alert('Usuario creado correctamente');
      navigate('/pedidos');
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Error al crear usuario');
    }
  };

  if (error) {
    return (
      <div className="ui-page">
        <Alert variant="danger">
          <Alert.Heading>Acceso denegado</Alert.Heading>
          <p>{error}</p>
          <hr />
          <Button variant="danger" onClick={() => navigate('/')}>
            Volver al inicio
          </Button>
        </Alert>
      </div>
    );
  }

  return (
    <div className="ui-page">
      <PageHeader title="Crear Usuario" subtitle="Alta de perfiles operativos y choferes." />

      {submitError && <Alert variant="danger">{submitError}</Alert>}

      <Form onSubmit={handleSubmit}>
        <div className="row g-4">
          <div className="col-md-6">
            <Card className="h-100">
              <CardBody>
              <h4 className="ui-form-section-title">Datos del Usuario</h4>

              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Nombre *</Form.Label>
                <Input
                  type="text"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  placeholder="Ej: Juan"
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Apellido *</Form.Label>
                <Input
                  type="text"
                  name="apellido"
                  value={form.apellido}
                  onChange={handleChange}
                  placeholder="Ej: Pérez"
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Teléfono *</Form.Label>
                <Input
                  type="text"
                  name="telefono"
                  value={form.telefono}
                  onChange={handleChange}
                  placeholder="Ej: 3815998242"
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Email</Form.Label>
                <Input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="correo@ejemplo.com"
                />
              </Form.Group>
              </CardBody>
            </Card>
          </div>

          <div className="col-md-6">
            <Card className="h-100">
              <CardBody>
              <h4 className="ui-form-section-title">acceso</h4>

              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Contraseña *</Form.Label>
                <Input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Rol *</Form.Label>
                <Select
                  name="rol"
                  value={form.rol}
                  onChange={handleChange}
                  required
                >
                  <option value="">Seleccionar rol</option>
                  <option value="ADMIN">Administrador</option>
                  <option value="OPERATOR">Operador</option>
                  <option value="DRIVER">Chofer</option>
                </Select>
              </Form.Group>

              <div className="mt-3 p-3 rounded-3" style={{ background: '#f8f9fa', border: '1px solid #e9ecef' }}>
                <small className="text-muted">
                  Completá los datos básicos del usuario. Si elegís el rol <strong>Chofer</strong>,
                  se habilitarán automáticamente los datos del vehículo.
                </small>
              </div>
              </CardBody>
            </Card>
          </div>

          {form.rol === 'DRIVER' && (
            <div className="col-12">
              <Card>
                <CardBody>
                <h4 className="ui-form-section-title">Datos del Vehículo</h4>

                <div className="row">
                  <div className="col-md-4 mb-3">
                    <Form.Group>
                      <Form.Label className="fw-semibold">Marca</Form.Label>
                      <Input
                        type="text"
                        name="vehiculoMarca"
                        value={form.vehiculoMarca}
                        onChange={handleChange}
                        placeholder="Toyota"
                      />
                    </Form.Group>
                  </div>

                  <div className="col-md-4 mb-3">
                    <Form.Group>
                      <Form.Label className="fw-semibold">Modelo</Form.Label>
                      <Input
                        type="text"
                        name="vehiculoModelo"
                        value={form.vehiculoModelo}
                        onChange={handleChange}
                        placeholder="Corolla"
                      />
                    </Form.Group>
                  </div>

                  <div className="col-md-4 mb-3">
                    <Form.Group>
                      <Form.Label className="fw-semibold">Color</Form.Label>
                      <Input
                        type="text"
                        name="vehiculoColor"
                        value={form.vehiculoColor}
                        onChange={handleChange}
                        placeholder="Blanco"
                      />
                    </Form.Group>
                  </div>

                  <div className="col-md-6 mb-3">
                    <Form.Group>
                      <Form.Label className="fw-semibold">Patente</Form.Label>
                      <Input
                        type="text"
                        name="patente"
                        value={form.patente}
                        onChange={handleChange}
                        placeholder="ABC123"
                      />
                    </Form.Group>
                  </div>

                  <div className="col-md-6 mb-3">
                    <Form.Group>
                      <Form.Label className="fw-semibold">Número de Licencia</Form.Label>
                      <Input
                        type="text"
                        name="licenciaNumero"
                        value={form.licenciaNumero}
                        onChange={handleChange}
                        placeholder="123456"
                      />
                    </Form.Group>
                  </div>
                </div>
                </CardBody>
              </Card>
            </div>
          )}

          <div className="col-12 text-center mt-2">
            <Button type="submit" size="lg" className="px-5">
              Crear Usuario
            </Button>
          </div>
        </div>
      </Form>
    </div>
  );
};

export default CrearUsuario;