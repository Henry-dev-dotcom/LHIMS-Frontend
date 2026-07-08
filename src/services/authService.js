import { clearStoredTokens, setStoredTokens } from '../api/config';

export const authService = {
  me: async (client) => client.mode === 'mock' ? client.get(client.mock.auth.me, client.auth) : client.request('/auth/me'),
  login: async (client, credentials) => {
    if (client.mode === 'mock') return { token: 'demo-token', user: credentials };
    const data = await client.login(credentials);
    setStoredTokens(data);
    return data;
  },
  refresh: async (client) => {
    if (client.mode === 'mock') return { success: true };
    // Refresh token is carried by the httpOnly cookie; no body is sent.
    const data = await client.request('/auth/refresh', { method: 'POST', skipAuth: true });
    setStoredTokens(data);
    return data;
  },
  logout: async (client) => {
    if (client.mode === 'mock') return { success: true };
    try {
      return await client.logout();
    } finally {
      clearStoredTokens();
    }
  },
  changePassword: async (client, payload) => client.mode === 'mock' ? { pendingBackend: true, payload } : client.request('/auth/change-password', { method: 'PATCH', body: payload })
};
