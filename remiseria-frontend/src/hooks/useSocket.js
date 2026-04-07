/**
 * Re-exporta useSocket y useConductorSocket desde SocketContext.
 *
 * El socket ahora vive como singleton en <SocketProvider>.
 * Este archivo mantiene los imports existentes funcionando sin cambios.
 */
export { useSocket, useConductorSocket, useClienteSocket } from '../context/SocketContext';
