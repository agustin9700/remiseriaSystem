import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../hooks/useUser';
import { getUserRole } from '../utils/auth';
import { Button, Card, CardBody, Input } from '../components/ui';

const PrincipalPage = () => {
  const [formData, setFormData] = useState({ usuario: '', password: '' });
  const { login, mensaje, setMensaje } = useUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const role = getUserRole();

    if (role === 'ADMIN' || role === 'OPERATOR') {
      navigate('/pedidos', { replace: true });
      return;
    }

    if (role === 'DRIVER') {
      navigate('/chofer', { replace: true });
      return;
    }
  }, [navigate]);

  useEffect(() => {
    const sessionReason = searchParams.get('session');

    if (sessionReason === 'invalidated') {
      setMensaje('Tu sesión fue cerrada porque iniciaste sesión en otro dispositivo.');
      window.history.replaceState({}, document.title, '/');
    }

    if (sessionReason === 'expired') {
      setMensaje('Tu sesión expiró. Iniciá sesión nuevamente.');
      window.history.replaceState({}, document.title, '/');
    }
  }, [searchParams, setMensaje]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const redirectByRole = (rol) => {
    if (rol === 'ADMIN' || rol === 'OPERATOR') {
      navigate('/pedidos', { replace: true });
      return;
    }

    if (rol === 'DRIVER') {
      navigate('/chofer', { replace: true });
      return;
    }

    setMensaje('Rol no reconocido');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const respuesta = await login({
        usuario: formData.usuario,
        password: formData.password
      });

      if (respuesta && respuesta.rol) {
        redirectByRole(respuesta.rol);
      } else {
        setMensaje('Usuario o contraseña incorrectos');
      }
    } catch (error) {
      setMensaje((prev) => prev || error?.response?.data?.message || error?.message || 'Error en la autenticación');
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center p-4" style={{ background: '#F7F8FA' }}>
      <Card className="w-100" style={{ maxWidth: 980 }}>
        <CardBody className="p-0">
          <div className="row g-0">
            <div className="col-md-6 p-4 p-md-5 border-end" style={{ background: '#111827', color: '#fff', borderColor: '#1f2937' }}>
              <p className="text-uppercase mb-2" style={{ letterSpacing: '0.08em', color: '#9ca3af', fontSize: 12 }}>
                Sistema operativo de remiseria
              </p>
              <h1 className="h3 mb-3">Remiseria Avenida</h1>
              <p className="mb-4" style={{ color: '#d1d5db' }}>
                Operacion en tiempo real para pedidos, choferes y seguimiento.
              </p>
              <div className="ui-skeleton mb-2" style={{ height: 8, maxWidth: 220 }} />
              <div className="ui-skeleton mb-2" style={{ height: 8, maxWidth: 180 }} />
              <div className="ui-skeleton" style={{ height: 8, maxWidth: 240 }} />
            </div>
            <div className="col-md-6 p-4 p-md-5">
              <h2 className="h5 mb-1">Iniciar sesion</h2>
              <p className="text-muted mb-4">Ingresa con tus credenciales para continuar.</p>

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="usuario" className="form-label">Usuario</label>
                  <Input
                    type="text"
                    id="usuario"
                    name="usuario"
                    value={formData.usuario}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="password" className="form-label">Contrasena</label>
                  <Input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                </div>

                <Button type="submit" className="w-100 mt-2">
                  Iniciar sesion
                </Button>
              </form>

              {mensaje && (
                <div className="alert alert-danger mt-3 mb-0" role="alert">
                  {mensaje}
                </div>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default PrincipalPage;