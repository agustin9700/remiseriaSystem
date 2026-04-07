import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

const apiLatency = Trend('api_latency');
const success = new Rate('success');
const conflicts = new Rate('conflicts');

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    api_latency: ['p(95)<1000'],
    success: ['rate>0.8'],
  },
};

const operator = {
  telefono: '12345678',
  password: 'password123',
};

const login = (telefono, password) => {
  const start = Date.now();
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({ telefono, password }), {
    headers: { 'Content-Type': 'application/json' },
  });
  apiLatency.add(Date.now() - start);
  return res.status === 200 ? JSON.parse(res.body).accessToken : null;
};

const createOrder = (token) => {
  const start = Date.now();
  const res = http.post(`${BASE_URL}/orders`, JSON.stringify({
    nombreCliente: `Cliente ${Date.now()}`,
    telefono: `55${Math.floor(Math.random() * 100000000)}`,
    origenTexto: 'Origen Test',
    destinoTexto: 'Destino Test',
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  apiLatency.add(Date.now() - start);
  return res.status === 201 ? JSON.parse(res.body) : null;
};

const getDrivers = (token) => {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/drivers`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  apiLatency.add(Date.now() - start);
  if (res.status === 200) {
    return JSON.parse(res.body).filter(d => d.estado === 'DISPONIBLE');
  }
  return [];
};

const assignDriver = (token, orderId, driverId) => {
  const start = Date.now();
  const res = http.post(`${BASE_URL}/orders/${orderId}/assign-driver`, JSON.stringify({ driverId }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  apiLatency.add(Date.now() - start);
  if (res.status === 409) conflicts.add(1);
  return res.status;
};

const getOrders = (token) => {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/orders`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  apiLatency.add(Date.now() - start);
  return res.status === 200 ? JSON.parse(res.body).orders : [];
};

export default function () {
  const token = login(operator.telefono, operator.password);
  if (!token) return;

  const drivers = getDrivers(token);
  if (drivers.length > 0) {
    const order = createOrder(token);
    if (order) {
      const status = assignDriver(token, order.id, drivers[0].id);
      success.add(status === 200 || status === 409 ? 1 : 0);
    }
  }

  const orders = getOrders(token);
  success.add(orders.length > 0 ? 1 : 0);

  sleep(Math.random() * 0.5);
}