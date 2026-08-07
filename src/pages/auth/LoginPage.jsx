import { useState } from 'react';
import { Activity, CheckCircle2, KeyRound, Loader2, ShieldCheck, UserRound } from 'lucide-react';
import { useAppStore } from '../../store/AppStore';
import { Button } from '../../components/ui/Button';
import { ToastHost } from '../../components/ui/ToastHost';
import '../../styles/getlabs-theme.css';

export function LoginPage() {
  const { dispatch } = useAppStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function submitCredentials(event) {
    event.preventDefault();
    if (submitting || !username.trim() || !password) return;
    setSubmitting(true);
    dispatch({ type: 'LOGIN_WITH_CREDENTIALS', username, password });
    // The command layer navigates away on success; re-enable the form shortly
    // so a failed attempt can be retried.
    window.setTimeout(() => setSubmitting(false), 1500);
  }

  return (
    <div className="getlabs-login min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-6xl flex-col">
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
        </header>

        <main className="grid flex-1 overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-panel lg:grid-cols-[1.1fr_0.9fr]">
          <section className="relative min-h-[20rem] overflow-hidden bg-clinical-700 p-7 sm:p-10 lg:p-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.14),transparent_30%)]" />
            <div className="absolute -bottom-20 -right-10 h-72 w-72 rounded-full bg-clinical-500/40 blur-3xl" />
            <div className="relative flex h-full flex-col justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-clinical-100">Clinical workspace</p>
                <h2 className="getlabs-serif mt-5 max-w-xl text-4xl leading-[1.06] tracking-[-0.03em] !text-white sm:text-5xl">
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

          <section className="flex items-center p-5 sm:p-8 lg:p-12">
            <div className="w-full max-w-md">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Secure sign in</p>
              <h2 className="getlabs-serif mt-2 text-4xl leading-tight tracking-[-0.03em] text-slate-900">Open your workspace.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">Sign in with the staff account issued by your administrator.</p>

              <form onSubmit={submitCredentials} className="mt-6 space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                <label className="block" htmlFor="login-username">
                  <span className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600"><UserRound className="h-3.5 w-3.5" aria-hidden="true" /> Username</span>
                  <input id="login-username" name="username" autoComplete="username" autoFocus value={username} onChange={(event) => setUsername(event.target.value)} className="getlabs-input" />
                </label>
                <label className="block" htmlFor="login-password">
                  <span className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600"><KeyRound className="h-3.5 w-3.5" aria-hidden="true" /> Password</span>
                  <input id="login-password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="getlabs-input" />
                </label>
                <Button className="getlabs-primary-button w-full justify-center" type="submit" disabled={submitting || !username.trim() || !password}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {submitting ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>

              <p className="mt-4 text-xs leading-5 text-slate-500">
                Sessions are secured with httpOnly cookies. Contact your system administrator if you need an account or a password reset.
              </p>
            </div>
          </section>
        </main>
      </div>
      <ToastHost />
    </div>
  );
}
