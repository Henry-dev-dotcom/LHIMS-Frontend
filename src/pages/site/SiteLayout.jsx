import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { goTo } from '../../services/publicService';

const LINKS = [
  { path: 'features', label: 'Departments' },
  { path: 'pricing', label: 'Pricing' },
  { path: 'demo', label: 'Request a demo' }
];

/** Header and footer shared by the public website pages. */
export function SiteLayout({ active, children }) {
  const [open, setOpen] = useState(false);
  const isLanding = active === 'home';
  const link = (path, label) => (
    <a
      key={path}
      href={`#/${path}`}
      onClick={() => setOpen(false)}
      className={`rounded-xl px-3 py-2 text-sm font-semibold ${active === path ? 'bg-clinical-50 text-clinical-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
      aria-current={active === path ? 'page' : undefined}
    >
      {label}
    </a>
  );

  return (
    <div className={`min-h-screen text-slate-900 ${isLanding ? 'bg-slate-50' : 'public-ambient'}`}>
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/82 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <a href="#/home" className="flex items-center gap-2.5" aria-label="CurataMed home">
            <img src={`${import.meta.env.BASE_URL}icons/curatamed-logo.png`} alt="CurataMed — Hospital Management System" className="h-10 w-auto" />
          </a>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Website">
            {LINKS.map((l) => link(l.path, l.label))}
            <a href="#/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Sign in</a>
            <a href="#/pricing" className="ml-1 rounded-xl bg-clinical-500 px-4 py-2 text-sm font-semibold text-white shadow-lift hover:bg-clinical-600">Start free trial</a>
          </nav>
          <button type="button" className="rounded-xl p-2 md:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <nav className="flex flex-col gap-1 border-t border-slate-200 px-4 py-3 md:hidden" aria-label="Website">
            {LINKS.map((l) => link(l.path, l.label))}
            <a href="#/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600">Sign in</a>
            <a href="#/pricing" onClick={() => setOpen(false)} className="rounded-xl bg-clinical-500 px-4 py-2 text-center text-sm font-semibold text-white">Start free trial</a>
          </nav>
        )}
      </header>

      <main id="main-content">{children}</main>

      <footer className="mt-16 border-t border-slate-200/80 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} CurataMed · Hospital management for Ghana and beyond. Prices in Ghana cedis (GHS).</p>
          <div className="flex flex-wrap gap-4">
            <a href="#/features" className="hover:text-slate-900">Departments</a>
            <a href="#/pricing" className="hover:text-slate-900">Pricing</a>
            <a href="#/demo" className="hover:text-slate-900">Contact</a>
            <button type="button" className="hover:text-slate-900" onClick={() => goTo('login')}>Staff sign in</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
