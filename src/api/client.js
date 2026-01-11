import axios from "axios";
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "../storage/tokenStore";

const API_BASE_URL = "https://apis.bseptechnologies.com"; // <-- change this

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000,
});

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});



let isRefreshing = false;
let pending = [];

function resolvePending(error, token = null) {
  pending.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  pending = [];
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err);
    }

    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pending.push({
          resolve: (token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          },
          reject,
        });
      });
    }

    isRefreshing = true;
    try {
      const refreshToken = await getRefreshToken();
        if (!refreshToken) throw new Error("User is not registered with us, Please Register ");

      const resp = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { refreshToken });
      const { accessToken, refreshToken: newRefresh } = resp.data;

      await setTokens({ accessToken, refreshToken: newRefresh });
      resolvePending(null, accessToken);

      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    } catch (e) {
      resolvePending(e, null);
      await clearTokens();
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }
);
