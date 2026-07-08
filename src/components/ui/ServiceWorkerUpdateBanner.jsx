import { useEffect, useState } from 'react';
import { DownloadCloud, X } from 'lucide-react';
import { Button } from './Button';

export function ServiceWorkerUpdateBanner() {
  const [registration, setRegistration] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleUpdateReady = (event) => {
      if (event.detail?.registration) {
        setRegistration(event.detail.registration);
        setDismissed(false);
      }
    };

    const handleControllerChanged = () => {
      if (registration) window.location.reload();
    };

    window.addEventListener('diagnosis-sw-update-ready', handleUpdateReady);
    window.addEventListener('diagnosis-sw-controller-changed', handleControllerChanged);

    return () => {
      window.removeEventListener('diagnosis-sw-update-ready', handleUpdateReady);
      window.removeEventListener('diagnosis-sw-controller-changed', handleControllerChanged);
    };
  }, [registration]);

  if (!registration || dismissed) return null;

  const applyUpdate = () => {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      return;
    }
    window.location.reload();
  };

  return (
    <section className="mobile-system-banner mx-3 mt-2 rounded-[1.15rem] border border-clinical-200/80 bg-clinical-50/95 px-3 py-2 text-clinical-950 shadow-sm backdrop-blur-xl sm:mx-5 lg:mx-8 print:hidden" role="status" aria-live="polite">
      <div className="mx-auto flex max-w-[1540px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <DownloadCloud className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em]">Update ready</p>
            <p className="mt-0.5 text-xs font-semibold leading-5 text-clinical-900/80">A newer mobile build is available. Update now to avoid using an old cached version.</p>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2 sm:flex sm:shrink-0">
          <Button size="sm" onClick={applyUpdate} className="w-full sm:w-auto">Update now</Button>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-2xl border border-clinical-200 bg-white/80 text-clinical-800 transition hover:bg-white"
            aria-label="Dismiss update notice"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
