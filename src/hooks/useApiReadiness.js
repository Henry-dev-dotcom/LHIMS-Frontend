import { useMemo } from 'react';
import { useAppStore } from '../store/AppStore';
import { createApiClient } from '../api/apiClient';
import { getApiConfig, getStoredTokens } from '../api/config';
import { flattenEndpointMap } from '../api/endpointMap';

/* Live-only API diagnostics for the integration console. The mock/demo mode
   was removed together with the demo store. */
export function useApiReadiness() {
  const { state } = useAppStore();
  const config = getApiConfig();
  const tokens = getStoredTokens();
  const client = useMemo(() => createApiClient({ auth: state.auth }), [state.auth]);
  const endpoints = useMemo(() => flattenEndpointMap(), []);
  const readiness = useMemo(() => {
    const services = ['auth','patient','doctor','order','reception','lab','scan','billing','finance','admin','results','report','notification','file'];
    return {
      apiMode: client.mode,
      baseUrl: config.baseUrl,
      endpointCount: endpoints.length,
      serviceCount: services.length,
      mappedModels: ['Patient','Order','Result','Invoice','Catalog Item','Notification','File Metadata','DICOM Study'],
      blockers: [],
      liveRequirements: ['API server reachable at the configured base URL', 'PostgreSQL running', 'Prisma migrations applied', 'Production seed loaded', 'Valid session after login'],
      // Auth tokens are httpOnly cookies (not readable from JS); a cached user
      // profile indicates an established session.
      hasActiveSession: Boolean(tokens.user),
      services
    };
  }, [client.mode, config.baseUrl, endpoints.length, tokens.user]);

  return { client, config, endpoints, readiness };
}
