import { createApiClient } from '../api/apiClient';
import { authService } from '../services/authService';
import { normalizeAuthUser } from '../api/normalizers';

/*
  Async command router. Write actions keep their historical dispatch names
  (pages still call dispatch({ type: 'X', payload })), but instead of mutating
  the local demo store they call the backend through the service layer and
  then refresh the affected state. The sync reducer in AppStore.jsx only
  handles UI/local state and hydration set-actions.
*/

export const apiClient = createApiClient({});

function toastAction(type, message) {
  return { type: 'SHOW_TOAST', toast: { type, message } };
}

const commands = {
  LOGIN_WITH_CREDENTIALS: async (action, dispatch) => {
    const data = await authService.login(apiClient, {
      username: String(action.username || '').trim(),
      password: String(action.password || '')
    });
    const auth = normalizeAuthUser(data?.user);
    if (!auth) throw new Error('Login response did not include a user profile.');
    dispatch({ type: 'SET_AUTH', auth, navigate: auth.landing });
    dispatch(toastAction('success', `Welcome, ${auth.userName}`));
  },

  LOGOUT: async (_action, dispatch) => {
    try {
      await authService.logout(apiClient);
    } catch {
      // Session is cleared locally regardless; the cookie may already be gone.
    }
    dispatch({ type: 'SET_AUTH', auth: null, navigate: 'login' });
    dispatch(toastAction('success', 'Signed out'));
  }
};

export function hasCommand(type) {
  return Object.prototype.hasOwnProperty.call(commands, type);
}

export async function runCommand(action, dispatch, getState) {
  const handler = commands[action.type];
  if (!handler) return;
  try {
    await handler(action, dispatch, getState);
  } catch (error) {
    const message = error?.message || 'Request failed. Please try again.';
    dispatch(toastAction('error', message));
  }
}
