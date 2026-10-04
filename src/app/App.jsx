import { lazy, Suspense, useEffect, useState } from 'react';
import { AppStoreProvider, useAppStore } from '../store/AppStore';
import { LoginPage } from '../pages/auth/LoginPage';
import { AppShell } from '../layouts/AppShell';
import { ReportVerificationPage } from '../pages/public/ReportVerificationPage';
import { PatientPortalAccessPage } from '../pages/public/PatientPortalAccessPage';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { WorkspaceLoading } from '../components/ui/WorkspaceLoading';
import { useMobileViewportMetrics } from '../hooks/useMobileViewportMetrics';
import { readSiteRoute, rememberedFacilityCode } from '../services/publicService';

// The public website loads only for visitors who are not signed in.
const HomePage = lazy(() => import('../pages/site/HomePage').then((m) => ({ default: m.HomePage })));
const FeaturesPage = lazy(() => import('../pages/site/FeaturesPage').then((m) => ({ default: m.FeaturesPage })));
const PricingPage = lazy(() => import('../pages/site/PricingPage').then((m) => ({ default: m.PricingPage })));
const SignupPage = lazy(() => import('../pages/site/SignupPage').then((m) => ({ default: m.SignupPage })));
const DemoRequestPage = lazy(() => import('../pages/site/DemoRequestPage').then((m) => ({ default: m.DemoRequestPage })));

const SITE_PAGES = { home: HomePage, features: FeaturesPage, pricing: PricingPage, signup: SignupPage, demo: DemoRequestPage };

function useHashRoute() {
  const [route, setRoute] = useState(readSiteRoute);
  useEffect(() => {
    const onChange = () => setRoute(readSiteRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

/** Deep links that belong to a recipient, not to the workspace. */
const PUBLIC_DEEP_LINKS = ['#/verify-report/', '#/patient/results/'];

function AppContent() {
  const { state } = useAppStore();
  const route = useHashRoute();
  const hash = typeof window !== 'undefined' ? window.location.hash || '' : '';

  /*
    Keep the workspace page in the address, so refreshing returns to the screen
    somebody was on instead of their landing page. replaceState rather than a
    hash assignment: it fires no hashchange, and it leaves the back button
    behaving as it did rather than stepping through every screen they opened.
  */
  const { currentPage, auth } = state;
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (PUBLIC_DEEP_LINKS.some((prefix) => window.location.hash.startsWith(prefix))) return;
    if (!auth) {
      // Signing out should not leave a workspace page in the address bar.
      if (window.location.hash.startsWith('#/app/')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      return;
    }
    const want = `#/app/${currentPage}`;
    if (window.location.hash !== want) window.history.replaceState(null, '', want);
  }, [auth, currentPage]);

  if (hash.startsWith('#/verify-report/')) return <ReportVerificationPage />;
  if (hash.startsWith('#/patient/results/')) return <PatientPortalAccessPage />;

  if (!state.auth) {
    if (route.path === 'login') return <LoginPage key={route.parts[1] || ''} initialCode={route.parts[1] || ''} />;
    // Staff who have signed in on this device before go straight to sign-in.
    const Page = SITE_PAGES[route.path] || (!route.path && !rememberedFacilityCode() ? HomePage : null);
    if (Page) {
      return (
        <Suspense fallback={<WorkspaceLoading />}>
          <Page />
        </Suspense>
      );
    }
    return <LoginPage />;
  }
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
