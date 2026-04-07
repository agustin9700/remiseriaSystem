import { useEffect, useRef } from 'react';
import L from 'leaflet';

const TUCUMAN_CENTER = [-26.8083, -65.2176];
const DEFAULT_ZOOM   = 13;

/**
 * Inicializa y gestiona un mapa Leaflet con dos marcadores:
 * uno para el conductor y otro para el punto de retiro del cliente.
 *
 * @param {object} params
 * @param {React.Ref}  params.mapRef         - ref del div contenedor del mapa
 * @param {boolean}    params.ready          - true cuando el componente terminó de cargar datos
 * @param {object|null} params.currentPosition - { lat, lng } posición actual del conductor
 * @param {object|null} params.viajeActivo   - viaje activo con datos del pedido
 *
 * @returns {{ mapInstanceRef, markerRef, clienteMarkerRef }}
 */
export function useLeafletMap({ mapRef, ready, currentPosition, viajeActivo }) {
  const mapInstanceRef    = useRef(null);
  const markerRef         = useRef(null);
  const clienteMarkerRef  = useRef(null);
  const fitBoundsDoneRef  = useRef(false);

  // ── Inicialización del mapa ──────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    const container = mapRef.current;
    if (!container || mapInstanceRef.current) return;

    try {
      mapInstanceRef.current = L.map(container).setView(TUCUMAN_CENTER, DEFAULT_ZOOM);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(mapInstanceRef.current);

      const conductorIcon = L.divIcon({
        className: 'conductor-marker',
        html: `<div style="background:#3B82F6;width:32px;height:32px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);color:white;font-size:16px;">🚗</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      markerRef.current = L.marker(TUCUMAN_CENTER, { icon: conductorIcon })
        .addTo(mapInstanceRef.current)
        .bindPopup('Tu ubicación');

      const clienteIcon = L.divIcon({
        className: 'cliente-marker',
        html: `<div style="background:#EF4444;width:36px;height:36px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);color:white;font-size:18px;">📍</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      clienteMarkerRef.current = L.marker(TUCUMAN_CENTER, { icon: clienteIcon })
        .addTo(mapInstanceRef.current)
        .bindPopup('Punto de retiro');

      clienteMarkerRef.current.setOpacity(0);
    } catch (err) {
      console.error('Error inicializando mapa:', err);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [ready, mapRef]);

  // ── Actualizar posición del conductor ────────────────────────────────────────
  useEffect(() => {
    if (!currentPosition || !markerRef.current || !mapInstanceRef.current) return;

    markerRef.current.setLatLng([currentPosition.lat, currentPosition.lng]);

    // Solo mover la vista si no hay viaje activo (el viaje usa fitBounds)
    if (!viajeActivo) {
      mapInstanceRef.current.setView([currentPosition.lat, currentPosition.lng], 15);
    }
  }, [currentPosition, viajeActivo]);

  // ── Mostrar/ocultar marcador de cliente según viaje activo ───────────────────
  useEffect(() => {
    if (!clienteMarkerRef.current || !mapInstanceRef.current) return;

    if (viajeActivo?.pedido) {
      const lat = parseFloat(viajeActivo.pedido.origenLat ?? viajeActivo.pedido.viaje?.origenLat);
      const lng = parseFloat(viajeActivo.pedido.origenLng ?? viajeActivo.pedido.viaje?.origenLng);

      if (!isNaN(lat) && !isNaN(lng)) {
        clienteMarkerRef.current.setLatLng([lat, lng]);
        clienteMarkerRef.current.bindPopup(
          `<strong>📍 Retirar aquí:</strong><br/>${viajeActivo.pedido.origenTexto ?? viajeActivo.pedido.viaje?.origen ?? ''}`
        );
        clienteMarkerRef.current.setOpacity(1);

        // fitBounds solo la primera vez que aparece el viaje
        if (currentPosition && !fitBoundsDoneRef.current) {
          mapInstanceRef.current.fitBounds(
            [[currentPosition.lat, currentPosition.lng], [lat, lng]],
            { padding: [50, 50], maxZoom: 16 }
          );
          fitBoundsDoneRef.current = true;
        }
      } else {
        clienteMarkerRef.current.setOpacity(0);
      }
    } else {
      fitBoundsDoneRef.current = false;
      clienteMarkerRef.current.setOpacity(0);
    }
  }, [viajeActivo, currentPosition]);

  return { mapInstanceRef, markerRef, clienteMarkerRef };
}
