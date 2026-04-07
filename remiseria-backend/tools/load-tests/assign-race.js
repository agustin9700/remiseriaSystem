import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

const assignErrors = new Rate('assign_errors');
const assignSuccess = new Rate('assign_success');
const doubleAssign = new Counter('double_assign');

export const options = {
  stages: [
    { duration: '10s', target: 20 },
    { duration: '30s', target: 50 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    assign_errors: ['rate<0.1'],
    double_assign: ['count<5'],
  },
};

const loginAsOperator = () => {
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    telefono: '12345678',
    password: 'password123',
  }), { headers: { 'Content-Type': 'application/json' } });

  if (res.status === 200) {
    return JSON.parse(res.body).accessToken;
  }
  return null;
};

const getDrivers = (token) => {
  const res = http.get(`${BASE_URL}/drivers`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (res.status === 200) {
    const drivers = JSON.parse(res.body);
    return drivers.filter(d => d.estado === 'DISPONIBLE').slice(0, 1);
  }
  return [];
};

const createOrder = (token) => {
  const res = http.post(`${BASE_URL}/orders`, JSON.stringify({
    nombreCliente: `Cliente Race ${Date.now()}`,
    telefono: `55${Math.floor(Math.random() * 100000000)}`,
    origenTexto: 'Origen Race Test',
    destinoTexto: 'Destino Race Test',
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  return res.status === 201 ? JSON.parse(res.body) : null;
};

const assignDriver = (token, orderId, driverId) => {
  const res = http.post(`${BASE_URL}/orders/${orderId}/assign-driver`, JSON.stringify({
    driverId,
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  return res.status;
};

export default function () {
  const token = loginAsOperator();
  if (!token) return;

  const drivers = getDrivers(token);
  if (drivers.length === 0) {
    return;
  }

  const order = createOrder(token);
  if (!order) return;

  const orderId = order.id;
  const driverId = drivers[0].id;

  const res = assignDriver(token, orderId, driverId);
  if (res === 200) {
    assignSuccess.add(1);
  } else if (res === 409) {
    doubleAssign.add(1);
  } else {
    assignErrors.add(1);
  }

  sleep(0.1);
}