import { CloudOff, GaugeCircle } from 'lucide-react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export function NetworkStatusBanner() {
  const { online, effectiveType, saveData, slowConnection } = useNetworkStatus();

  if (online && !slowConnection) return null;

  const Icon = online ? GaugeCircle : CloudOff;
  const title = online ? 'Low-bandwidth mode detected' : 'You are offline';
  const detail = online
    ? `The app is online, but ${saveData ? 'data saver is enabled' : `${effectiveType || 'the network'} looks slow`}. Large reports and uploads may take longer.`
    : 'Saved screens may still open, but live records, uploads, and delivery actions need network access.';

  return (
    <section className="mobile-system-banner mx-3 mt-2 rounded-[1.15rem] border border-amber-200/80 bg-amber-50/95 px-3 py-2 text-amber-950 shadow-sm backdrop-blur-xl sm:mx-5 lg:mx-8 print:hidden" role="status" aria-live="polite">
      <div className="mx-auto flex max-w-[1540px] items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.08em]">{title}</p>
          <p className="mt-0.5 text-xs font-semibold leading-5 text-amber-900/80">{detail}</p>
        </div>
      </div>
    </section>
  );
}
