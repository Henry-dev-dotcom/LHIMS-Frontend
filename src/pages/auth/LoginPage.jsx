import { useMemo, useState } from 'react';
import { Activity, ArrowRight, CheckCircle2, KeyRound, ShieldCheck, UserRound } from 'lucide-react';
import { ROLES } from '../../data/roles';
import { useAppStore } from '../../store/AppStore';
import { Button } from '../../components/ui/Button';
import { ToastHost } from '../../components/ui/ToastHost';
import '../../styles/getlabs-theme.css';

export function LoginPage() {
  const { dispatch } = useAppStore();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const selectedRole = useMemo(() => ROLES.find((role) => role.demoUsername === username), [username]);

  function submitCredentials(event) {
    event.preventDefault();
    dispatch({ type: 'LOGIN_WITH_CREDENTIALS', username, password });
  }

  return (
    <div className="getlabs-login min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-7xl flex-col">
        <header className="flex items-center justify-between gap-4 py-3 sm:py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-clinical-500 text-white shadow-lift">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Diagnosis Center</h1>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Orders · Billing · Results</p>
            </div>
          </div>
          <button type="button" className="getlabs-outline-button hidden sm:inline-flex" onClick={() => setUsername('admin')}>Demo access</button>
        </header>

        <main className="grid flex-1 overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-panel lg:grid-cols-[0.92fr_1.08fr]">
          <section className="relative min-h-[22rem] overflow-hidden bg-clinical-700 p-7 sm:p-10 lg:p-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.14),transparent_30%)]" />
            <div className="absolute -bottom-20 -right-10 h-72 w-72 rounded-full bg-clinical-500/40 blur-3xl" />
            <div className="relative flex h-full flex-col justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-clinical-100">Clinical workspace</p>
                <h2 className="getlabs-serif mt-5 max-w-xl text-4xl leading-[1.06] tracking-[-0.03em] !text-white sm:text-5xl lg:text-6xl">
                  Manage lab requests with a calmer, cleaner workflow.
                </h2>
                <p className="mt-5 max-w-lg text-base leading-8 text-clinical-100">
                  A calm, simple interface for clinicians, reception, laboratory, scan, billing, and administration teams.
                </p>
              </div>

              <div className="mt-10 grid gap-3 text-sm sm:grid-cols-2">
                {['Queue requests', 'Accept samples', 'Enter results', 'Send to clinician'].map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-white backdrop-blur">
                    <CheckCircle2 className="h-4 w-4 text-clinical-200" />
                    <span className="font-semibold">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="p-5 sm:p-8 lg:p-12">
            <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Secure sign in</p>
                <h2 className="getlabs-serif mt-2 text-4xl leading-tight tracking-[-0.03em] text-slate-900">Open your workspace.</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">Use the demo credentials or select a role to continue into the platform.</p>

                <form onSubmit={submitCredentials} className="mt-6 space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                  <label className="block" htmlFor="login-username">
                    <span className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600"><UserRound className="h-3.5 w-3.5" aria-hidden="true" /> Username</span>
                    <input id="login-username" name="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} className="getlabs-input" />
                  </label>
                  <label className="block" htmlFor="login-password">
                    <span className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600"><KeyRound className="h-3.5 w-3.5" aria-hidden="true" /> Password</span>
                    <input id="login-password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="getlabs-input" />
                  </label>
                  {selectedRole && (
                    <div className="rounded-2xl border border-clinical-100 bg-clinical-25 px-4 py-3 text-xs text-slate-600">
                      <span className="font-bold text-clinical-800">Selected:</span> {selectedRole.label} — {selectedRole.demoUser}
                    </div>
                  )}
                  <Button className="getlabs-primary-button w-full justify-center" type="submit"><ShieldCheck className="h-4 w-4" /> Sign in</Button>
                </form>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Quick role login</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {ROLES.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => dispatch({ type: 'LOGIN_AS', roleId: role.id })}
                      className="group rounded-3xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-clinical-300 hover:shadow-lift sm:p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-900">{role.label}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{role.subtitle}</p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-clinical-600" />
                      </div>
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                        {role.demoUsername} / {role.demoPassword}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
      <ToastHost />
    </div>
  );
}
