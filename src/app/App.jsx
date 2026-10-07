import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AppStoreProvider, useAppStore } from '../store/AppStore';
import { LoginPage } from '../pages/auth/LoginPage';
import { AppShell } from '../layouts/AppShell';
import { ReportVerificationPage } from '../pages/public/ReportVerificationPage';
import { PatientPortalAccessPage } from '../pages/public/PatientPortalAccessPage';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { WorkspaceLoading } from '../components/ui/WorkspaceLoading';
import { useMobileViewportMetrics } from '../hooks/useMobileViewportMetrics';
import { readSiteRoute } from '../services/publicService';
import { pageFromAddress, workspaceHash } from '../utils/workspaceAddress';

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
  const { state, dispatch } = useAppStore();
  const route = useHashRoute();
  const hash = typeof window !== 'undefined' ? window.location.hash || '' : '';

  /*
    Keep the address and the open screen agreeing, in both directions.

    The page lives in the address as #/app/<page> so that refreshing returns to
    the screen somebody was on, and so a screen can be linked to at all. That
    much only ever wrote the address from the state - which meant an address
    typed or pasted into the bar, or arrived at with the back button, was
    silently overwritten with the page already open. The screen never changed
    and the address quietly reverted, which reads as the link being broken.

    So whichever of the two changed last wins. The address is written with
    replaceState, which fires no hashchange and leaves the back button stepping
    through where somebody actually went rather than every screen they opened;
    remembering what was written is what distinguishes our own write from a
    person editing the bar.
  */
  const { currentPage, auth } = state;
  const lastWritten = useRef(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (PUBLIC_DEEP_LINKS.some((prefix) => window.location.hash.startsWith(prefix))) return;
    if (!auth) {
      // Signing out should not leave a workspace page in the address bar.
      if (window.location.hash.startsWith('#/app/')) {
        lastWritten.current = null;
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      return;
    }

    const current = window.location.hash;
    const want = workspaceHash(currentPage);
    if (current === want) return;

    // Somebody put this address here: open it if they may, and if not, correct
    // the bar rather than leaving it describing a screen that is not showing.
    if (current !== lastWritten.current) {
      const target = pageFromAddress(auth, current);
      if (target && target !== currentPage) {
        dispatch({ type: 'NAVIGATE', pageId: target });
        lastWritten.current = workspaceHash(target);
        return;
      }
    }

    lastWritten.current = want;
    window.history.replaceState(null, '', want);
  }, [auth, currentPage, hash, dispatch]);

  if (hash.startsWith('#/verify-report/')) return <ReportVerificationPage />;
  if (hash.startsWith('#/patient/results/')) return <PatientPortalAccessPage />;

  if (!state.auth) {
    if (route.path === 'login') return <LoginPage key={route.parts[1] || ''} initialCode={route.parts[1] || ''} />;
    /*
       The website is the front door, always.

       Signing in once used to be remembered forever, and from then on the plain
       address skipped the site and went straight to the form - on that device,
       for everybody who used it. So the one link you hand out stopped showing
       what the product is to anyone who had ever signed in, including you. The
       site carries "Sign in" in its header and footer, which is the one click
       this costs staff; a facility that wants to skip it can bookmark #/login.
    */
    const Page = SITE_PAGES[route.path] || (!route.path ? HomePage : null);
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
