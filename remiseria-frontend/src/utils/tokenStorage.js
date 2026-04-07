import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let accessToken = null;
let bootstrapPromise = null;
let bootstrapDone = false;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token || null;
}

export function clearAccessToken() {
  accessToken = null;
}

export function hasBootstrappedAuth() {
  return bootstrapDone;
}

export async function bootstrapAuth(force = false) {
  if (accessToken && !force) {
    bootstrapDone = true;
    return accessToken;
  }

  if (bootstrapPromise && !force) return bootstrapPromise;

  bootstrapPromise = axios
    .post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true })
    .then((res) => {
      const token = res.data?.accessToken || null;
      setAccessToken(token);
      bootstrapDone = true;
      return token;
    })
    .catch(() => {
      clearAccessToken();
      bootstrapDone = true;
      return null;
    })
    .finally(() => {
      bootstrapPromise = null;
    });

  return bootstrapPromise;
}
