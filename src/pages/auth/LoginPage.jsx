import { useState } from 'react';
import { Building2, CheckCircle2, KeyRound, Loader2, ShieldCheck, UserRound } from 'lucide-react';
import { useAppStore } from '../../store/AppStore';
import { Button } from '../../components/ui/Button';
import { ToastHost } from '../../components/ui/ToastHost';
import '../../styles/getlabs-theme.css';

/*
  Staff sign in to the same facility every day, so once a sign-in has worked the
  code is remembered on that device and filled in for them next time. It starts
  empty on a device nobody has signed in on, and the platform operator - who
  belongs to no facility - clears it.
*/
const FACILITY_CODE_KEY = 'curatamed.lastFacilityCode';

function readRememberedFacilityCode() {
  try {
    return window.localStorage.getItem(FACILITY_CODE_KEY) || '';
  } catch {
    return '';
  }
}

export function LoginPage({ initialCode = '' }) {
  const { dispatch } = useAppStore();
  // A facility sign-in link (#/login/CODE) fills in the code.
  const [facilityCode, setFacilityCode] = useState(() => String(initialCode || readRememberedFacilityCode()).toUpperCase().replace(/[^A-Z0-9]/g, ''));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function submitCredentials(event) {
    event.preventDefault();
    if (submitting || !username.trim() || !password) return;
    setSubmitting(true);
    const code = facilityCode.trim().toUpperCase();
    // The code is remembered by the command layer, and only once the sign-in
    // has actually worked - a mistyped code should not stick to the device.
    dispatch({ type: 'LOGIN_WITH_CREDENTIALS', facilityCode: code, username, password });
    // The command layer navigates away on success; re-enable the form shortly
    // so a failed attempt can be retried.
    window.setTimeout(() => setSubmitting(false), 1500);
  }

  return (
    <div className="getlabs-login login-shell min-h-screen p-4 text-slate-900 sm:p-6">
      <div className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col justify-center">
        <main className="login-panel grid flex-1 overflow-hidden rounded-[2rem] border bg-white shadow-panel lg:grid-cols-[1.08fr_0.92fr]">
          <section className="login-hero relative min-h-[34rem] overflow-hidden bg-clinical-700 p-7 sm:p-10 lg:p-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.14),transparent_30%)]" />
            <div className="absolute -bottom-20 -right-10 h-72 w-72 rounded-full bg-clinical-500/40 blur-3xl" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[42%] opacity-75" aria-hidden="true">
              <svg className="h-full w-full" viewBox="0 0 1000 360" preserveAspectRatio="none" fill="none">
                <defs>
                  <linearGradient id="login-wave-gradient" x1="0" y1="0" x2="1" y2="0">
                    <stop stopColor="#58e8ed" stopOpacity="0.08" />
                    <stop offset="0.42" stopColor="#51edf0" stopOpacity="0.72" />
                    <stop offset="1" stopColor="#48d9e9" stopOpacity="0.2" />
                  </linearGradient>
                </defs>
                <g stroke="url(#login-wave-gradient)" strokeWidth="1.6">
                  <path d="M0 184 C130 110 160 258 290 188 S470 112 590 190 800 248 1000 138" />
                  <path d="M0 222 C125 142 202 292 340 218 S490 154 640 224 827 276 1000 180" opacity=".72" />
                  <path d="M0 263 C140 180 232 322 380 254 S560 176 700 254 876 310 1000 220" opacity=".52" />
                </g>
                <path className="login-wave-glow" d="M0 350 H192 L208 346 L222 351 L241 349 L255 331 L270 356 L287 340 L303 350 H468 L485 347 L498 351 H650 L667 346 L681 351 L704 349 L719 326 L734 356 L750 340 L766 350 H1000" stroke="#83f7f4" strokeOpacity=".85" strokeWidth="2.4" />
                <g fill="#66f0ee">
                  <circle cx="76" cy="278" r="4" /><circle cx="246" cy="305" r="3.5" /><circle cx="418" cy="246" r="4" />
                  <circle cx="592" cy="292" r="3.5" /><circle cx="790" cy="258" r="4" /><circle cx="930" cy="220" r="3.5" />
                </g>
              </svg>
            </div>
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div>
                <div className="mb-8 inline-flex max-w-full rounded-2xl border border-white/60 bg-white p-2.5 shadow-xl shadow-slate-950/20 ring-1 ring-white/25 sm:mb-9">
                  <img src={`${import.meta.env.BASE_URL}icons/curatamed-logo.png`} alt="CurataMed — Hospital Management System" className="h-auto w-[min(17rem,68vw)] max-w-full object-contain" />
                </div>
                <h2 className="getlabs-serif mt-0 max-w-xl text-3xl leading-[1.08] tracking-[-0.035em] !text-white sm:text-4xl lg:text-[2.65rem]">
                  Run your <span className="text-cyan-200">whole hospital</span>, or only the departments you need.
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-7 text-cyan-50/90 sm:text-base">
                  One patient record across every department you switch on — and nothing on your screens for the ones you do not.
                </p>
              </div>

              <div className="mt-8 grid gap-2.5 text-xs sm:grid-cols-2 sm:text-sm">
                {['Outpatients, wards & theatre', 'Laboratory & imaging', 'Pharmacy & stores', 'Billing & NHIS claims'].map((item) => (
                  <div key={item} className="flex min-h-10 items-center gap-2 rounded-full border border-white/20 bg-white/[0.08] px-3 py-2 text-white shadow-sm backdrop-blur-sm sm:px-4">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-200" />
                    <span className="font-semibold">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="login-form-section flex items-center p-5 sm:p-8 lg:p-10">
            <div className="w-full max-w-md">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 sm:text-xs">Secure sign in</p>
              <h2 className="getlabs-serif mt-2 text-[1.7rem] leading-tight tracking-[-0.035em] text-slate-900 sm:text-3xl">Open your workspace.</h2>
              <p className="mt-2 text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6">Sign in with the staff account issued by your administrator.</p>

              <form onSubmit={submitCredentials} className="login-form mt-5 space-y-3 rounded-3xl border border-cyan-100 bg-cyan-50/45 p-4 sm:mt-6 sm:space-y-3.5 sm:p-5">
                <label className="block" htmlFor="login-facility">
                  <span className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600"><Building2 className="h-3.5 w-3.5" aria-hidden="true" /> Facility code</span>
                  <input
                    id="login-facility"
                    name="facilityCode"
                    autoComplete="organization"
                    autoCapitalize="characters"
                    spellCheck={false}
                    autoFocus={!facilityCode}
                    placeholder="e.g. KBTH"
                    aria-describedby="login-facility-hint"
                    value={facilityCode}
                    onChange={(event) => setFacilityCode(event.target.value.toUpperCase())}
                    className="getlabs-input uppercase tracking-[0.08em]"
                  />
                  <span id="login-facility-hint" className="mt-1.5 block text-xs text-slate-500">The code your hospital or clinic was given.</span>
                </label>
                <label className="block" htmlFor="login-username">
                  <span className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600"><UserRound className="h-3.5 w-3.5" aria-hidden="true" /> Username</span>
                  <input id="login-username" name="username" autoComplete="username" autoFocus={Boolean(facilityCode)} value={username} onChange={(event) => setUsername(event.target.value)} className="getlabs-input" />
                </label>
                <label className="block" htmlFor="login-password">
                  <span className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600"><KeyRound className="h-3.5 w-3.5" aria-hidden="true" /> Password</span>
                  <input id="login-password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="getlabs-input" />
                </label>
                <Button className="getlabs-primary-button w-full justify-center" type="submit" disabled={submitting || !username.trim() || !password}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {submitting ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>

              <p className="mt-3 text-[11px] leading-[1.45rem] text-slate-500 sm:mt-4 sm:text-xs">
                Sessions are secured with httpOnly cookies. Contact your system administrator if you need an account or a password reset.
              </p>
              <p className="mt-2 text-xs text-slate-600 sm:mt-3 sm:text-sm">
                New to CurataMed? <a href="#/pricing" className="font-semibold text-clinical-700 underline">Start a free trial</a> · <a href="#/home" className="font-semibold text-clinical-700 underline">About CurataMed</a>
              </p>
            </div>
          </section>
        </main>
      </div>
      <ToastHost />
    </div>
  );
}
