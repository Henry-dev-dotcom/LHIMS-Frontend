import { clearStoredTokens, setStoredTokens } from '../api/config';

export const authService = {
  me: async (client) => client.request('/auth/me'),
  login: async (client, credentials) => {
    const data = await client.login(credentials);
    setStoredTokens(data);
    return data;
  },
  refresh: async (client) => {
    // Refresh token is carried by the httpOnly cookie; no body is sent.
    const data = await client.request('/auth/refresh', { method: 'POST', skipAuth: true });
    setStoredTokens(data);
    return data;
  },
  logout: async (client) => {
    try {
      return await client.logout();
    } finally {
      clearStoredTokens();
    }
  },
  changePassword: async (client, payload) => client.request('/auth/change-password', { method: 'PATCH', body: payload })
};
