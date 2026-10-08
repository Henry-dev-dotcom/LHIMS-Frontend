import { Activity, CheckCircle2, Database, ShieldCheck } from 'lucide-react';

/* Shown only while the workspace hydrates right after login, so pages never
   flash an empty "no records" state before real data arrives. */
export function WorkspaceLoading() {
  return (
    <div className="relative grid min-h-[100dvh] overflow-hidden bg-[#f4fafb] p-4 text-slate-900 sm:p-8" aria-live="polite">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_88%_92%,rgba(16,185,129,0.10),transparent_30%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(15,118,110,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,118,110,0.05)_1px,transparent_1px)] [background-size:42px_42px]" aria-hidden="true" />

      <div className="relative m-auto w-full max-w-2xl">
        <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 shadow-[0_24px_70px_rgba(15,78,92,0.12)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-slate-100/90 px-5 py-4 sm:px-7">
            <img src="/icons/curatamed-logo.png" alt="CurataMed" className="h-auto w-40 sm:w-48" />
            <span className="hidden rounded-full border border-clinical-100 bg-clinical-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-clinical-800 sm:inline-flex">Secure workspace</span>
          </div>

          <div className="px-5 py-10 sm:px-12 sm:py-14">
            <div className="mx-auto max-w-md text-center">
              <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-[1.65rem] bg-gradient-to-br from-clinical-500 to-cyan-600 text-white shadow-[0_16px_35px_rgba(8,145,178,0.28)] motion-safe:animate-pulse">
                <span className="absolute inset-[-0.55rem] rounded-[2rem] border border-clinical-200/70 motion-safe:animate-ping" aria-hidden="true" />
                <Activity className="relative h-9 w-9" strokeWidth={1.8} />
              </div>
              <p className="mt-7 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Preparing your workspace</p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">Connecting your hospital data and arranging the tools for your role.</p>

              <div className="mt-8 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Loading workspace" aria-valuetext="Preparing workspace">
                <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-clinical-500 via-cyan-500 to-emerald-400 motion-safe:animate-[loading-sweep_1.4s_ease-in-out_infinite]" />
              </div>
            </div>

            <div className="mx-auto mt-10 grid max-w-lg gap-2 sm:grid-cols-3">
              {[
                [Database, 'Hospital data'],
                [CheckCircle2, 'Orders & results'],
                [ShieldCheck, 'Secure session']
              ].map(([Icon, label]) => (
                <div key={label} className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-left">
                  <Icon className="h-4 w-4 shrink-0 text-clinical-600" />
                  <span className="text-xs font-semibold text-slate-600">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100/90 bg-slate-50/60 px-5 py-3 text-center text-[11px] font-semibold text-slate-400 sm:px-7">
            CurataMed Hospital Management System
          </div>
        </div>
      </div>
    </div>
  );
}
