import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

const errors = new Rate('errors');
const requestsMade = new Rate('requests_made');

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 30 },
    { duration: '30s', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.05'],
  },
};

const loginAsOperator = () => {
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    telefono: '12345678',
    password: 'password123',
  }), { headers: { 'Content-Type': 'application/json' } });

  if (res.status === 200) {
    const body = JSON.parse(res.body);
    return body.accessToken;
  }
  return null;
};

const createOrder = (token) => {
  const res = http.post(`${BASE_URL}/orders`, JSON.stringify({
    nombreCliente: `Cliente Load ${Date.now()}`,
    telefono: `55${Math.floor(Math.random() * 100000000)}`,
    origenTexto: 'Origen Load Test',
    destinoTexto: 'Destino Load Test',
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  return { status: res.status, body: res.status === 201 ? JSON.parse(res.body) : null };
};

export default function () {
  const token = loginAsOperator();
  if (!token) {
    errors.add(1);
    return;
  }

  requestsMade.add(1);
  const orderRes = createOrder(token);
  
  if (orderRes.status === 201) {
    errors.add(0);
  } else {
    errors.add(1);
  }

  sleep(Math.random() * 0.5);
}