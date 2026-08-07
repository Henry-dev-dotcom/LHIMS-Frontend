import { AppStoreProvider, useAppStore } from '../store/AppStore';
import { LoginPage } from '../pages/auth/LoginPage';
import { AppShell } from '../layouts/AppShell';
import { ReportVerificationPage } from '../pages/public/ReportVerificationPage';
import { PatientPortalAccessPage } from '../pages/public/PatientPortalAccessPage';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { WorkspaceLoading } from '../components/ui/WorkspaceLoading';
import { useMobileViewportMetrics } from '../hooks/useMobileViewportMetrics';

function AppContent() {
  const { state } = useAppStore();
  const hash = typeof window !== 'undefined' ? window.location.hash || '' : '';
  if (hash.startsWith('#/verify-report/')) return <ReportVerificationPage />;
  if (hash.startsWith('#/patient/results/')) return <PatientPortalAccessPage />;
  if (!state.auth) return <LoginPage />;
  if (state.hydrating) return <WorkspaceLoading />;
  return <AppShell />;
}

export default function App() {
  useMobileViewportMetrics();

  return (
    <ErrorBoundary>
      <AppStoreProvider>
        <AppContent />
      </AppStoreProvider>
    </ErrorBoundary>
  );
}
