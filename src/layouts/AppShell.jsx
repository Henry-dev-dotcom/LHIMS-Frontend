import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ToastHost } from '../components/ui/ToastHost';
import { MobileBottomNav } from '../components/ui/MobileBottomNav';
import { NetworkStatusBanner } from '../components/ui/NetworkStatusBanner';
import { ServiceWorkerUpdateBanner } from '../components/ui/ServiceWorkerUpdateBanner';
import { SubscriptionBanner } from '../components/ui/SubscriptionBanner';
import { AppRouter } from '../routes/AppRouter';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';

export function AppShell() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-app-radial text-slate-900 print:bg-white">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden lg:ml-[19rem]">
        <Header />
        <SubscriptionBanner />
        <NetworkStatusBanner />
        <ServiceWorkerUpdateBanner />
        <main
          id="main-content"
          tabIndex={-1}
          className="relative z-0 min-w-0 flex-1 overflow-x-hidden px-3 pb-[calc(var(--mobile-bottom-nav-space,6.75rem)+env(safe-area-inset-bottom))] pt-3 outline-none sm:px-5 lg:px-8 lg:pb-6 lg:pt-4 print:px-0 print:py-0"
        >
          <div className="mx-auto w-full min-w-0 max-w-[1540px] overflow-x-hidden print:max-w-none">
            <ErrorBoundary>
              <AppRouter />
            </ErrorBoundary>
          </div>
        </main>
        <MobileBottomNav />
        <ToastHost />
      </div>
    </div>
  );
}
