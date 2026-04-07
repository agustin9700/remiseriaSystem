import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './components/ui';
import PrincipalPage from './pages/PrincipalPage';
import PedidosPage from './pages/PedidosPage';
import ChoferesPage from './pages/ChoferesPage';
import RegistroChofer from './components/choferes/RegistroChofer';
import PerfilChofer from './components/choferes/PerfilChofer';
import CrearUsuario from './pages/CrearUsuario';
import ViajeForm from './pages/ViajeForm';
import ConductorDashboard from './pages/conductorDashboard';
import ViajeTracking from './pages/ViajeTracking';
import NotFoundPage from './pages/NotFoundPage';
import { useEffect } from 'react';
import ProtectedRoute from './components/ProtectedRoute';
import { bootstrapAuth } from './utils/tokenStorage';
import AppShell from './components/AppShell';

function App() {
  useEffect(() => {
    bootstrapAuth();
  }, []);

  return (
    <Router>
      {/* SocketProvider dentro de Router para que SocketContext tenga acceso
          al estado actual de sesión (access token en memoria / refresh por cookie) */}
      <SocketProvider>
        <ToastProvider>
        <Routes>
          <Route path="/" element={<PrincipalPage />} />

          <Route
            path="/crear"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AppShell>
                  <CrearUsuario />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/pedidos"
            element={
              <ProtectedRoute allowedRoles={['OPERATOR', 'ADMIN']}>
                <AppShell>
                  <PedidosPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/choferes"
            element={
              <ProtectedRoute allowedRoles={['OPERATOR', 'ADMIN']}>
                <AppShell>
                  <ChoferesPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/registroChofer"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AppShell>
                  <RegistroChofer />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/perfilChofer"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AppShell>
                  <PerfilChofer />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/chofer"
            element={
              <ProtectedRoute allowedRoles={['DRIVER']}>
                <AppShell>
                  <ConductorDashboard />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route path="/conductorDashboard" element={<Navigate to="/chofer" replace />} />

          {/* Rutas públicas para pasajero */}
          <Route path="/viajes" element={<ViajeForm />} />
          <Route path="/viajes/:codigo" element={<ViajeTracking />} />

          {/* 404 real en lugar de redirect silencioso a / */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </ToastProvider>
      </SocketProvider>
    </Router>
  );
}

export default App;
