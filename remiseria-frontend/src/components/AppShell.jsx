import { Link, useLocation } from 'react-router-dom';
import { createElement, useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Car,
  UserCircle,
  UserPlus,
  LogOut,
} from 'lucide-react';
import { getUserFromToken, clearSession } from '../utils/auth';
import axiosInstance from '../hooks/api/axiosInstance';
import { Badge, Button } from './ui';

const navItems = [
  { to: '/pedidos', label: 'Pedidos', icon: ClipboardList, roles: ['ADMIN', 'OPERATOR'] },
  { to: '/choferes', label: 'Choferes', icon: Users, roles: ['ADMIN', 'OPERATOR'] },
  { to: '/chofer', label: 'Panel chofer', icon: Car, roles: ['DRIVER'] },
  { to: '/perfilChofer', label: 'Mi perfil', icon: UserCircle, roles: ['DRIVER'] },
  { to: '/crear', label: 'Usuarios', icon: UserPlus, roles: ['ADMIN'] },
];

const AppShell = ({ children }) => {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px)').matches
  );
  const toggleButtonRef = useRef(null);
  const drawerRef = useRef(null);
  const hadMobileOpenRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const onChange = () => setIsNarrowViewport(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const isMobile = isNarrowViewport;
  const sidebarCollapsed = !isMobile && collapsed;
  const showFullSidebar = isMobile ? mobileOpen : !collapsed;

  useEffect(() => {
    const syncUser = () => {
      const tokenUser = getUserFromToken();
      if (!tokenUser) {
        setUser(null);
        return;
      }
      setUser({
        userId: tokenUser.userId || '',
        nombre: tokenUser.nombre || '',
        apellido: tokenUser.apellido || '',
        telefono: tokenUser.telefono || '',
        rol: tokenUser.rol || '',
      });
    };

    syncUser();
    window.addEventListener('auth-changed', syncUser);
    return () => window.removeEventListener('auth-changed', syncUser);
  }, []);

  const handleLogout = async () => {
    try {
      await axiosInstance.post('/auth/logout', {});
    } catch {
      // ignorar error remoto
    }
    clearSession();
    setUser(null);
    window.dispatchEvent(new Event('auth-changed'));
    window.location.href = '/';
  };

  const roleLabel = (rol) => {
    const labels = {
      ADMIN: 'Administrador',
      OPERATOR: 'Operador',
      DRIVER: 'Chofer',
    };
    return labels[rol] || rol || 'Usuario';
  };

  const filteredItems = navItems.filter((item) =>
    !user?.rol ? false : item.roles.includes(user.rol)
  );

  const initials = user
    ? `${(user.nombre || '').charAt(0)}${(user.apellido || '').charAt(0)}`.toUpperCase() || 'U'
    : 'U';

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!isNarrowViewport || !mobileOpen) return;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    drawerRef.current?.focus();
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, isNarrowViewport]);

  useEffect(() => {
    if (hadMobileOpenRef.current && !mobileOpen) {
      toggleButtonRef.current?.focus();
    }
    hadMobileOpenRef.current = mobileOpen;
  }, [mobileOpen]);

  return (
    <div className="app-shell">
      <aside
        id="app-shell-drawer"
        ref={drawerRef}
        tabIndex={-1}
        className={`app-shell-sidebar ${sidebarCollapsed ? 'app-shell-sidebar-collapsed' : ''} ${mobileOpen ? 'app-shell-sidebar-open' : ''}`}
      >
        <div className="app-shell-sidebar-header">
            <Link to={user?.rol === 'DRIVER' ? '/chofer' : '/pedidos'} className="app-shell-logo">
              <span className="app-shell-logo-mark">RA</span>
              {showFullSidebar && <span className="app-shell-logo-text">Remiseria Avenida</span>}
            </Link>
        </div>

        <nav className="app-shell-nav">
          {user && filteredItems.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`app-shell-nav-item ${active ? 'app-shell-nav-item-active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                {createElement(Icon, { size: 18, className: 'app-shell-nav-icon' })}
                {showFullSidebar && <span className="app-shell-nav-label">{label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="app-shell-sidebar-footer">
          {user && (
            <div className="app-shell-user">
              <div className="app-shell-avatar">{initials}</div>
              {showFullSidebar && (
                <div className="app-shell-user-meta">
                  <div className="app-shell-user-name">
                    {(user.nombre || user.apellido)
                      ? `${user.nombre || ''} ${user.apellido || ''}`.trim()
                      : 'Usuario'}
                  </div>
                  <Badge tone="info" className="mt-1">{roleLabel(user.rol)}</Badge>
                </div>
              )}
            </div>
          )}
          {showFullSidebar && (
            <Button
              variant="ghost"
              size="sm"
              className="app-shell-logout"
              onClick={handleLogout}
            >
              <LogOut size={16} />
              <span>Salir</span>
            </Button>
          )}
        </div>
      </aside>

      <div className="app-shell-main">
        <header className="app-shell-topbar">
          <button
            ref={toggleButtonRef}
            type="button"
            className="app-shell-collapse-btn"
            aria-label={mobileOpen ? 'Cerrar menu lateral' : 'Abrir menu lateral'}
            aria-controls="app-shell-drawer"
            aria-expanded={mobileOpen}
            onClick={() => {
              if (isNarrowViewport) {
                setMobileOpen((v) => {
                  const next = !v;
                  if (next) setCollapsed(false);
                  return next;
                });
              } else {
                setCollapsed((v) => !v);
              }
            }}
          >
            <LayoutDashboard size={18} />
          </button>
        </header>
        <main className="app-shell-content">
          {children}
        </main>
      </div>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Cerrar menu lateral"
          className="app-shell-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </div>
  );
};

export default AppShell;

