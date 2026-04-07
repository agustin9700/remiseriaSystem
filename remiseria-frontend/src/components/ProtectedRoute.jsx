import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { bootstrapAuth, getAccessToken, hasBootstrappedAuth } from '../utils/tokenStorage';
import { getUserRole, isTokenExpired, clearSession } from '../utils/auth';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const [ready, setReady] = useState(() => hasBootstrappedAuth() || !!getAccessToken());

  useEffect(() => {
    let mounted = true;

    if (getAccessToken()) {
      setReady(true);
      return;
    }

    bootstrapAuth().finally(() => {
      if (mounted) setReady(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) {
    return <div className="container py-5 text-center text-muted">Verificando sesión...</div>;
  }

  const token = getAccessToken();

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (isTokenExpired()) {
    clearSession();
    return <Navigate to="/" replace />;
  }

  const userRole = getUserRole();

  if (!userRole) {
    clearSession();
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    if (userRole === 'DRIVER') return <Navigate to="/chofer" replace />;
    if (userRole === 'OPERATOR' || userRole === 'ADMIN') return <Navigate to="/pedidos" replace />;
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
