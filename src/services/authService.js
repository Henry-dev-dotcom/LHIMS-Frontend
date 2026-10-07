import { clearStoredTokens, setStoredTokens } from '../api/config';

export const authService = {
  me: async (client) => {
    const user = await client.request('/auth/me');
    // Keep the cached profile current (setup finished, plan changed, new logo).
    if (user) setStoredTokens({ user: user?.user || user });
    return user;
  },
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
  changePassword: async (client, payload) => client.request('/auth/change-password', { method: 'PATCH', body: payload }),
  // Emails the signed-in user a link to confirm their address.
  requestEmailVerification: async (client) => client.request('/auth/email/request-verification', { method: 'POST', body: {} }),
  // Public: the token in the emailed link is the only credential, and the link is
  // often opened on a phone that is not signed in, so no session is sent.
  verifyEmail: async (client, token) => client.request('/auth/email/verify', { method: 'POST', body: { token }, skipAuth: true })
};
