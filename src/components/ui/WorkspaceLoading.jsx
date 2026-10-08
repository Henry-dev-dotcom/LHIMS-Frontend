/* Shown only while the workspace hydrates right after login, so pages never
   flash an empty "no records" state before real data arrives. */
function Skeleton({ className = '' }) {
  return <span className={`loading-skeleton block rounded-lg ${className}`} aria-hidden="true" />;
}

const sidebarSections = [
  ['Overview', 1],
  ['Laboratory', 3],
  ['Core records', 2],
  ['Administration', 2]
];

export function WorkspaceLoading() {
  return (
    <div className="min-h-[100dvh] bg-app-radial text-slate-900" aria-live="polite" role="status" aria-label="Preparing your workspace">
      <aside className="fixed inset-y-0 left-0 hidden w-[19rem] flex-col border-r border-slate-200/80 bg-white lg:flex" aria-hidden="true">
        <div className="border-b border-slate-100 p-5">
          <img src={`${import.meta.env.BASE_URL}icons/curatamed-logo.png`} alt="" className="h-auto max-h-16 w-full max-w-52 object-contain object-left" />
          <Skeleton className="mt-3 h-3 w-40" />
        </div>
        <div className="border-b border-slate-100 px-5 py-3">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="mt-2 h-4 w-20" />
        </div>
        <nav className="flex-1 px-3 py-5">
          {sidebarSections.map(([section, items]) => (
            <div key={section} className="mb-6">
              <Skeleton className="mb-3 ml-3 h-2.5 w-20" />
              <div className="space-y-2">
                {Array.from({ length: items }).map((_, index) => (
                  <div key={`${section}-${index}`} className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <Skeleton className={`h-3 ${index === 0 ? 'w-28' : 'w-24'}`} />
                    <Skeleton className="ml-auto h-3 w-3 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-[100dvh] min-w-0 flex-col lg:ml-[19rem]">
        <header className="border-b border-slate-200/80 bg-white/90 px-3 py-3 backdrop-blur sm:px-5 lg:px-8" aria-hidden="true">
          <div className="mx-auto flex min-h-[4.5rem] max-w-[1540px] items-center justify-between gap-4 rounded-[1.35rem] border border-slate-200/70 bg-white px-4 shadow-sm sm:px-6">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-2.5 w-28" />
              <Skeleton className="mt-2 h-6 w-60 max-w-[70%]" />
              <Skeleton className="mt-2 h-3 w-96 max-w-[90%]" />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Skeleton className="h-10 w-10 rounded-2xl" />
              <Skeleton className="hidden h-10 w-24 rounded-2xl sm:block" />
              <Skeleton className="h-10 w-12 rounded-2xl sm:w-36" />
            </div>
          </div>
        </header>

        <main className="relative flex-1 overflow-hidden px-3 pb-8 pt-4 sm:px-5 lg:px-8 lg:pt-5" aria-hidden="true">
          <div className="mx-auto w-full max-w-[1540px]">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <Skeleton className="h-2.5 w-28" />
                <Skeleton className="mt-3 h-8 w-56" />
                <Skeleton className="mt-2 h-3 w-80 max-w-[75vw]" />
              </div>
              <Skeleton className="hidden h-10 w-28 rounded-2xl sm:block" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-[1.2rem] border border-slate-200/70 bg-white p-4 shadow-sm">
                  <Skeleton className="h-2.5 w-24" />
                  <Skeleton className="mt-3 h-7 w-16" />
                </div>
              ))}
            </div>

            <section className="mt-5 overflow-hidden rounded-[1.65rem] border border-slate-200/70 bg-white p-4 shadow-[0_8px_24px_rgba(15,78,92,0.07)] sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <Skeleton className="h-5 w-52" />
                  <Skeleton className="mt-2 h-3 w-72 max-w-[70vw]" />
                </div>
                <Skeleton className="h-10 w-full rounded-2xl sm:w-64" />
              </div>
              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100">
                <div className="grid grid-cols-[1.15fr_1fr_1fr_auto] gap-4 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                  {['w-20', 'w-24', 'w-32', 'w-16'].map((width) => <Skeleton key={width} className={`h-2.5 ${width}`} />)}
                </div>
                <div className="divide-y divide-slate-100">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="grid grid-cols-[1.15fr_1fr_1fr_auto] items-center gap-4 px-4 py-4">
                      <div><Skeleton className="h-3.5 w-36" /><Skeleton className="mt-2 h-2.5 w-24" /></div>
                      <Skeleton className="h-7 w-28 rounded-full" />
                      <div><Skeleton className="h-3.5 w-32" /><Skeleton className="mt-2 h-2.5 w-24" /></div>
                      <Skeleton className="h-8 w-20 rounded-xl" />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
