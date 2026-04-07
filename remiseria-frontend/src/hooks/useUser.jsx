import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from './api/axiosInstance';
import { clearAccessToken, setAccessToken } from '../utils/tokenStorage';

export const useUser = () => {
  const [usuario, setUsuario] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const navigate = useNavigate();

  const login = async ({ usuario: user, password }) => {
    try {
      setMensaje('');

      const res = await axiosInstance.post('/auth/login', {
        telefono: user,
        password,
      });

      const accessToken = res.data.accessToken ?? res.data.token;

      if (!accessToken) {
        throw new Error('No se recibió token del servidor');
      }

      setAccessToken(accessToken);
      setUsuario(res.data.user);
      window.dispatchEvent(new Event('auth-changed'));

      return res.data.user;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Error al iniciar sesión';
      setMensaje(errorMsg);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await axiosInstance.post('/auth/logout', {});
    } catch {
      // Ignorar errores de logout — limpiar sesión de todas formas
    }

    setUsuario(null);
    clearAccessToken();
    window.dispatchEvent(new Event('auth-changed'));
    navigate('/');
  };

  return {
    usuario,
    mensaje,
    setMensaje,
    login,
    logout,
  };
};
