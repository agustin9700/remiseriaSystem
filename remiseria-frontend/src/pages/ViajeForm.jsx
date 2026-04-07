import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../hooks/api/axiosInstance';
import '../styles/viajeForm.css';

const ViajeForm = () => {
  const navigate = useNavigate();

  const [origenCalle, setOrigenCalle] = useState('');
  const [origenNumero, setOrigenNumero] = useState('');
  const [destinoCalle, setDestinoCalle] = useState('');
  const [destinoNumero, setDestinoNumero] = useState('');
  const [origenCoords, setOrigenCoords] = useState(null);
  const [destinoCoords, setDestinoCoords] = useState(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [seleccionando, setSeleccionando] = useState(null);
  const [estimatedPrice, setEstimatedPrice] = useState(null);
  const [distanciaReal, setDistanciaReal] = useState(null);
  const [duracionEstimada, setDuracionEstimada] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [metodo_pago, setMetodoPago] = useState('efectivo');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef({ origen: null, destino: null });
  const routeControlRef = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('favoritos');
      const parsed = raw ? JSON.parse(raw) : [];
      // Validar que sea un array de objetos con las propiedades esperadas
      const valid = Array.isArray(parsed)
        ? parsed.filter(
            (f) =>
              f &&
              typeof f === 'object' &&
              typeof f.nombre === 'string' &&
              typeof f.calle === 'string'
          )
        : [];
      setFavorites(valid);
    } catch {
      // Dato corrupto — limpiar y arrancar vacío
      localStorage.removeItem('favoritos');
      setFavorites([]);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const loadLeaflet = async () => {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      if (!document.getElementById('leaflet-routing-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-routing-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css';
        document.head.appendChild(link);
      }

      if (!window.L) {
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = resolve;
          document.body.appendChild(script);
        });
      }

      if (!window.L.Routing) {
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js';
          script.onload = resolve;
          document.body.appendChild(script);
        });
      }

      const L = window.L;
      const map = L.map(mapRef.current).setView([-26.8083, -65.2176], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstance.current = map;
    };

    loadLeaflet();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;

    const handleMapClickListener = (e) => {
      if (!seleccionando) return;
      const { lat, lng } = e.latlng;
      handleMapClick(lat, lng);
    };

    if (seleccionando) {
      mapInstance.current.on('click', handleMapClickListener);
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.off('click', handleMapClickListener);
      }
    };
  }, [seleccionando]);

  useEffect(() => {
    if (origenCoords && destinoCoords && window.L && mapInstance.current) {
      calcularRuta();
    }
  }, [origenCoords, destinoCoords]);

  const calcularRuta = async () => {
    const L = window.L;
    if (!L?.Routing || !mapInstance.current || !origenCoords || !destinoCoords) return;

    if (routeControlRef.current) {
      mapInstance.current.removeControl(routeControlRef.current);
      routeControlRef.current = null;
    }

    const routeControl = L.Routing.control({
      waypoints: [
        L.latLng(origenCoords.lat, origenCoords.lng),
        L.latLng(destinoCoords.lat, destinoCoords.lng),
      ],
      routeWhileDragging: false,
      showAlternatives: false,
      addWaypoints: false,
      fitSelectedRoutes: true,
      show: false,
      createMarker: () => null,
      lineOptions: {
        styles: [{ color: '#6366f1', opacity: 0.8, weight: 6 }],
      },
    }).addTo(mapInstance.current);

    routeControlRef.current = routeControl;

    routeControl.on('routesfound', (e) => {
      const route = e.routes?.[0];
      if (!route) return;

      const distanciaMetros = route.summary.totalDistance;
      const distanciaKm = (distanciaMetros / 1000).toFixed(2);
      const duracionMin = Math.ceil(route.summary.totalTime / 60);

      setDistanciaReal(distanciaKm);
      setDuracionEstimada(duracionMin);

      const precioBase = 600;
      const precioPorTramo = 150;

      let precioCalculado = precioBase;
      if (distanciaMetros > 100) {
        const metrosExtra = distanciaMetros - 100;
        const tramosExtra = Math.ceil(metrosExtra / 100);
        precioCalculado += tramosExtra * precioPorTramo;
      }

      setEstimatedPrice(precioCalculado);
    });

    routeControl.on('routingerror', () => {
      setMensaje('❌ No se pudo calcular la ruta');
    });
  };

  const createMarkerIcon = (label, color) => {
    const L = window.L;
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        background: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 16px;
      ">${label}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });
  };

  const handleMapClick = async (lat, lng) => {
    const L = window.L;
    if (!L || !mapInstance.current) return;

    const coords = { lat, lng };

    if (seleccionando === 'origen') {
      setOrigenCoords(coords);

      if (markersRef.current.origen) {
        markersRef.current.origen.remove();
      }

      markersRef.current.origen = L.marker([lat, lng], {
        icon: createMarkerIcon('A', '#10b981'),
      }).addTo(mapInstance.current);

      await reverseGeocode(lat, lng, 'origen');
      setSeleccionando(null);
    }

    if (seleccionando === 'destino') {
      setDestinoCoords(coords);

      if (markersRef.current.destino) {
        markersRef.current.destino.remove();
      }

      markersRef.current.destino = L.marker([lat, lng], {
        icon: createMarkerIcon('B', '#ef4444'),
      }).addTo(mapInstance.current);

      await reverseGeocode(lat, lng, 'destino');
      setSeleccionando(null);
    }
  };

  const reverseGeocode = async (lat, lng, tipo) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'RemiseriaApp/1.0',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Error en la respuesta de Nominatim');
      }

      const data = await response.json();

      if (data?.address) {
        const calle =
          data.address.road ||
          data.address.pedestrian ||
          data.address.path ||
          data.address.suburb ||
          data.address.neighbourhood ||
          'Ubicación seleccionada';

        const numero = data.address.house_number || 'S/N';

        if (tipo === 'origen') {
          setOrigenCalle(calle);
          setOrigenNumero(numero);
        } else {
          setDestinoCalle(calle);
          setDestinoNumero(numero);
        }
      }
    } catch (error) {
      console.error('Error en geocodificación:', error);
      if (tipo === 'origen') {
        setOrigenCalle('No se pudo obtener la dirección');
      } else {
        setDestinoCalle('No se pudo obtener la dirección');
      }
    }
  };

  const obtenerUbicacionActual = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización');
      return;
    }

    setLoading(true);
    setMensaje('📍 Obteniendo tu ubicación...');

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude, longitude } = coords;

        if (mapInstance.current) {
          mapInstance.current.setView([latitude, longitude], 15);
        }

        setSeleccionando('origen');
        await handleMapClick(latitude, longitude);

        setLoading(false);
        setMensaje('');
      },
      (error) => {
        console.error('Error al obtener ubicación:', error);
        alert('No se pudo obtener tu ubicación. Verifica los permisos del navegador.');
        setLoading(false);
        setMensaje('');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const agregarFavorito = () => {
    if (!origenCalle || !origenCoords) {
      alert('Selecciona primero una ubicación de origen');
      return;
    }

    const nombre = prompt('Nombre del favorito (ej: Casa, Trabajo):');
    if (!nombre) return;

    const nuevoFavorito = {
      id: Date.now(),
      nombre,
      calle: origenCalle,
      numero: origenNumero,
      lat: origenCoords.lat,
      lng: origenCoords.lng,
    };

    const nuevosFavoritos = [...favorites, nuevoFavorito];
    setFavorites(nuevosFavoritos);
    localStorage.setItem('favoritos', JSON.stringify(nuevosFavoritos));
    setMensaje(`✅ "${nombre}" agregado a favoritos`);
    setTimeout(() => setMensaje(''), 3000);
  };

  const seleccionarFavorito = (fav) => {
    setOrigenCalle(fav.calle);
    setOrigenNumero(fav.numero);
    setOrigenCoords({ lat: fav.lat, lng: fav.lng });

    if (mapInstance.current && window.L) {
      const L = window.L;

      if (markersRef.current.origen) {
        markersRef.current.origen.remove();
      }

      markersRef.current.origen = L.marker([fav.lat, fav.lng], {
        icon: createMarkerIcon('A', '#10b981'),
      }).addTo(mapInstance.current);

      mapInstance.current.setView([fav.lat, fav.lng], 15);
    }

    setShowFavorites(false);
  };

  const eliminarFavorito = (id) => {
    if (!window.confirm('¿Eliminar este favorito?')) return;

    const nuevosFavoritos = favorites.filter((f) => f.id !== id);
    setFavorites(nuevosFavoritos);
    localStorage.setItem('favoritos', JSON.stringify(nuevosFavoritos));
  };

  const limpiarFormulario = () => {
    setOrigenCalle('');
    setOrigenNumero('');
    setDestinoCalle('');
    setDestinoNumero('');
    setOrigenCoords(null);
    setDestinoCoords(null);
    setEstimatedPrice(null);
    setDistanciaReal(null);
    setDuracionEstimada(null);
    setMensaje('');

    if (markersRef.current.origen) {
      markersRef.current.origen.remove();
      markersRef.current.origen = null;
    }

    if (markersRef.current.destino) {
      markersRef.current.destino.remove();
      markersRef.current.destino = null;
    }

    if (routeControlRef.current && mapInstance.current) {
      mapInstance.current.removeControl(routeControlRef.current);
      routeControlRef.current = null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!origenCalle || !destinoCalle) {
      setMensaje('❌ Por favor completa origen y destino');
      return;
    }

    if (!origenCoords || !destinoCoords) {
      setMensaje('❌ Selecciona las ubicaciones en el mapa');
      return;
    }
   

    setLoading(true);
    setMensaje('');

    try {
      const pedidoData = {
        nombreCliente: 'Pasajero',
        telefonoCliente: 'Sin teléfono',
        origenTexto: `${origenCalle} ${origenNumero || 'S/N'}`.trim(),
        origenLat: origenCoords.lat,
        origenLng: origenCoords.lng,
        destinoTexto: `${destinoCalle} ${destinoNumero || 'S/N'}`.trim(),
        destinoLat: destinoCoords.lat,
        destinoLng: destinoCoords.lng,
        observaciones: `Método de pago: ${metodo_pago}`,
      };

      const res = await axiosInstance.post('/orders/public', pedidoData);
      // El código lo genera el servidor — lo leemos de la respuesta
      const codigoServidor = res.data?.codigo;

      setMensaje('✅ ¡Pedido creado exitosamente! Redirigiendo...');

      setTimeout(() => {
        limpiarFormulario();
        navigate(`/viajes/${codigoServidor}`);
      }, 800);
    } catch (error) {
      console.error('Error al crear pedido:', error);
      console.error('Backend response:', error.response?.data);
      setMensaje('❌ Error al crear el pedido. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="viaje-container">
      <div className="mapa-wrapper">
        <div ref={mapRef} className="mapa"></div>

        {seleccionando && (
          <div className="instruccion-mapa">
            📍 Toca el mapa para seleccionar {seleccionando === 'origen' ? 'ORIGEN' : 'DESTINO'}
          </div>
        )}

        {distanciaReal && duracionEstimada && (
          <div className="info-ruta">
            <div className="info-item">
              <span className="icono">📏</span>
              <span>{distanciaReal} km</span>
            </div>
            <div className="info-item">
              <span className="icono">⏱️</span>
              <span>{duracionEstimada} min</span>
            </div>
          </div>
        )}
      </div>

      <div className="tarjeta-naranja">
        <div className="viaje-header">
          <h1>🚕 Pedí tu viaje</h1>
        </div>

        <form className="viaje-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              <span className="punto-verde"></span> Origen
            </label>

            <div className="input-group">
              <input
                type="text"
                className="form-input"
                value={origenCalle}
                onChange={(e) => setOrigenCalle(e.target.value)}
                placeholder="Calle"
                required
              />
              <input
                type="text"
                className="form-input-small"
                value={origenNumero}
                onChange={(e) => setOrigenNumero(e.target.value)}
                placeholder="Nº"
              />
            </div>

            <div className="button-group">
              <button
                type="button"
                className="btn-secundario"
                onClick={() => setSeleccionando('origen')}
              >
                📍 Seleccionar en mapa
              </button>

              <button
                type="button"
                className="btn-ubicacion"
                onClick={obtenerUbicacionActual}
                disabled={loading}
              >
                📡
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              <span className="punto-rojo"></span> Destino
            </label>

            <div className="input-group">
              <input
                type="text"
                className="form-input"
                value={destinoCalle}
                onChange={(e) => setDestinoCalle(e.target.value)}
                placeholder="Calle"
                required
              />
              <input
                type="text"
                className="form-input-small"
                value={destinoNumero}
                onChange={(e) => setDestinoNumero(e.target.value)}
                placeholder="Nº"
              />
            </div>

            <button
              type="button"
              className="btn-secundario"
              onClick={() => setSeleccionando('destino')}
            >
              📍 Seleccionar en mapa
            </button>
          </div>

          <div className="favoritos-section">
            <button
              type="button"
              className="btn-favoritos"
              onClick={() => setShowFavorites(!showFavorites)}
            >
              ⭐ {showFavorites ? 'Ocultar' : 'Ver'} Favoritos
            </button>

            {showFavorites && (
              <div className="favoritos-lista">
                {favorites.length === 0 ? (
                  <p className="sin-favoritos">No tienes favoritos guardados</p>
                ) : (
                  favorites.map((fav) => (
                    <div key={fav.id} className="favorito-item">
                      <div
                        onClick={() => seleccionarFavorito(fav)}
                        style={{ flex: 1, cursor: 'pointer' }}
                      >
                        <div className="favorito-nombre">⭐ {fav.nombre}</div>
                        <div className="favorito-direccion">
                          {fav.calle} {fav.numero}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => eliminarFavorito(fav.id)}
                        className="btn-eliminar"
                      >
                        ❌
                      </button>
                    </div>
                  ))
                )}

                <button
                  type="button"
                  className="btn-agregar-fav"
                  onClick={agregarFavorito}
                >
                  + Agregar origen actual
                </button>
              </div>
            )}
          </div>

          {estimatedPrice && (
            <div className="precio-estimado">
              <div className="precio-valor">$ {estimatedPrice}</div>
              <div className="precio-label">Precio estimado</div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Método de pago</label>
            <select
              className="form-select"
              value={metodo_pago}
              onChange={(e) => setMetodoPago(e.target.value)}
            >
              <option value="efectivo">💵 Efectivo</option>
              <option value="transferencia">🏦 Transferencia</option>
              <option value="tarjeta">💳 Tarjeta</option>
            </select>
          </div>

          <div className="divisor"></div>

          {mensaje && (
            <div className={`mensaje ${mensaje.includes('✅') ? 'success' : 'error'}`}>
              {mensaje}
            </div>
          )}

          <button
            type="submit"
            className="btn-blanco"
            disabled={loading || !origenCalle || !destinoCalle}
          >
            {loading ? '⏳ Procesando...' : '🚕 Pedir viaje'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ViajeForm;