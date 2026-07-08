import { useMemo, useState } from 'react';
import { useAppStore } from '../store/AppStore';
import { createApiClient } from '../api/apiClient';
import { getApiConfig, getStoredTokens, setApiMode } from '../api/config';
import { flattenEndpointMap } from '../api/endpointMap';

export function useApiReadiness() {
  const { state } = useAppStore();
  const [modeVersion, setModeVersion] = useState(0);
  const config = getApiConfig();
  const tokens = getStoredTokens();
  const client = useMemo(() => createApiClient({ mode: config.mode, data: state.data, auth: state.auth }), [config.mode, state.data, state.auth, modeVersion]);
  const endpoints = useMemo(() => flattenEndpointMap(), []);
  const readiness = useMemo(() => {
    const services = ['auth','patient','doctor','order','reception','lab','scan','billing','finance','admin','results','report','notification','file'];
    return {
      apiMode: client.mode,
      baseUrl: config.baseUrl,
      endpointCount: endpoints.length,
      serviceCount: services.length,
      mappedModels: ['Patient','Order','Result','Invoice','Catalog Item','Notification','File Metadata','DICOM Study'],
      blockers: client.mode === 'mock' ? ['Mock mode is active. Switch to live mode when server requests should be used.'] : [],
      liveRequirements: ['API server running on port 5000', 'PostgreSQL running', 'Prisma migrations applied', 'Seed data loaded', 'Valid JWT after login'],
      // Auth tokens are httpOnly cookies (not readable from JS); a cached user
      // profile indicates an established session.
      hasActiveSession: Boolean(tokens.user),
      services
    };
  }, [client.mode, config.baseUrl, endpoints.length, tokens.user]);

  const updateMode = (mode) => {
    setApiMode(mode);
    setModeVersion((value) => value + 1);
  };

  return { client, config, endpoints, readiness, updateMode };
}
