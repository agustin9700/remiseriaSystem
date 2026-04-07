import { useState, useCallback } from 'react';
import axiosInstance from './api/axiosInstance';

const useChoferes = () => {
  const [choferes, setChoferes] = useState([]);
  const [choferesLibres, setChoferesLibres] = useState([]);
  const [choferesOcupados, setChoferesOcupados] = useState([]);
  const [choferesInactivos, setChoferesInactivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchChoferes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/drivers');
      const todos = response.data;
  
      const libres = todos.filter(d => d.estado === 'DISPONIBLE');
      const ocupados = todos.filter(d => d.estado === 'OCUPADO');
      const inactivos = todos.filter(d => d.estado === 'OFFLINE');
  
      setChoferes(todos);
      setChoferesLibres(libres);
      setChoferesOcupados(ocupados);
      setChoferesInactivos(inactivos);
      setError(null);
    } catch (err) {
      console.error('Error al obtener choferes:', err);
      setError(err.message);
      setChoferes([]);
      setChoferesLibres([]);
      setChoferesOcupados([]);
      setChoferesInactivos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    choferes,
    choferesLibres,
    choferesOcupados,
    choferesInactivos,
    loading,
    error,
    fetchChoferes
  };
};

export default useChoferes;
