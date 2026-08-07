import { Activity } from 'lucide-react';

/* Shown only while the workspace hydrates right after login, so pages never
   flash an empty "no records" state before real data arrives. */
export function WorkspaceLoading() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-slate-50 p-6 text-slate-900">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-clinical-500 text-white shadow-lift motion-safe:animate-pulse">
          <Activity className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">Loading your workspace</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Fetching orders, results and queues…</p>
        </div>
      </div>
    </div>
  );
}
