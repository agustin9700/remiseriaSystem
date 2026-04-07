import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { getUserFromToken, clearSession } from '../utils/auth';
import { bootstrapAuth, getAccessToken, setAccessToken } from '../utils/tokenStorage';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const SocketContext = createContext(null);

async function tryRefreshToken() {
  try {
    const res = await axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true });
    const accessToken = res.data?.accessToken || null;
    if (accessToken) {
      setAccessToken(accessToken);
      window.dispatchEvent(new Event('auth-changed'));
    }
    return accessToken;
  } catch {
    return null;
  }
}

export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const subscriptionsRef = useRef(new Map());
  const authIdentityRef = useRef(null);

  const disconnectSocket = useCallback(() => {
    const prev = socketRef.current;
    socketRef.current = null;
    if (prev) {
      prev.removeAllListeners();
      prev.disconnect();
    }
    setIsConnected(false);
    authIdentityRef.current = null;
  }, []);

  const connectSocket = useCallback((token, user) => {
    const prev = socketRef.current;
    socketRef.current = null;
    if (prev) {
      prev.removeAllListeners();
      prev.disconnect();
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      reconnectionDelayMax: 30000,
    });

    socketRef.current = socket;
    authIdentityRef.current = `${user.userId}:${token}`;

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);

      for (const { event, callback } of subscriptionsRef.current.values()) {
        socket.off(event, callback);
        socket.on(event, callback);
      }

      if (user.rol === 'DRIVER') {
        socket.emit('join-driver-room');
      } else if (user.rol === 'OPERATOR' || user.rol === 'ADMIN') {
        socket.emit('join-operator-room');
      }
    });

    socket.on('disconnect', () => {
      if (socketRef.current === socket) setIsConnected(false);
    });

    socket.on('connect_error', async (err) => {
      if (err.message === 'TOKEN_EXPIRED') {
        const newToken = await tryRefreshToken();
        if (newToken) {
          const freshUser = getUserFromToken();
          if (freshUser && socketRef.current === socket) {
            connectSocket(newToken, freshUser);
            return;
          }
        }

        clearSession();
        window.dispatchEvent(new Event('auth-changed'));
        window.location.href = '/?session=expired';
        return;
      }

      if (socketRef.current === socket) {
        setError(err.message);
        setIsConnected(false);
      }
    });

    socket.on('error', (err) => {
      if (socketRef.current === socket) {
        setError(err?.message || 'Error de socket');
      }

      if (err?.code === 'SESSION_INVALIDATED') {
        clearSession();
        window.dispatchEvent(new Event('auth-changed'));
        window.location.href = '/?session=invalidated';
      }
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    const syncSocket = async () => {
      let token = getAccessToken();
      if (!token) {
        token = await bootstrapAuth();
      }

      const user = getUserFromToken();

      if (!mounted) return;

      if (!token || !user) {
        disconnectSocket();
        return;
      }

      const identity = `${user.userId}:${token}`;
      if (authIdentityRef.current !== identity || !socketRef.current?.connected) {
        connectSocket(token, user);
      }
    };

    syncSocket();
    window.addEventListener('auth-changed', syncSocket);

    return () => {
      mounted = false;
      window.removeEventListener('auth-changed', syncSocket);
      disconnectSocket();
    };
  }, [connectSocket, disconnectSocket]);

  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const subscribe = useCallback((event, callback) => {
    const key = Symbol(event);
    subscriptionsRef.current.set(key, { event, callback });
    if (socketRef.current) {
      socketRef.current.off(event, callback);
      socketRef.current.on(event, callback);
    }
    return () => {
      subscriptionsRef.current.delete(key);
      if (socketRef.current) {
        socketRef.current.off(event, callback);
      }
    };
  }, []);

  const joinTrip = useCallback((viajeId) => {
    if (socketRef.current?.connected && viajeId) {
      socketRef.current.emit('join-trip', { viajeId });
    }
  }, []);

  const leaveTrip = useCallback((viajeId) => {
    if (socketRef.current?.connected && viajeId) {
      socketRef.current.emit('leave-trip', { viajeId });
    }
  }, []);

  const value = { socket: socketRef.current, isConnected, error, emit, subscribe, joinTrip, leaveTrip };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket debe usarse dentro de <SocketProvider>');
  return ctx;
}

export function useConductorSocket() {
  const { socket, isConnected, error, emit, subscribe } = useSocket();

  return { socket, isConnected, error, subscribe, emit };
}

export function useClienteSocket() {
  const { socket, isConnected, error, subscribe, joinTrip, leaveTrip } = useSocket();
  return { socket, isConnected, error, authenticated: isConnected, subscribe, joinTrip, leaveTrip };
}
