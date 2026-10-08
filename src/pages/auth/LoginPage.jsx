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
    <div className="getlabs-login login-shell public-ambient min-h-screen p-3 text-slate-900 sm:p-4">
      <div className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full items-center justify-center">
        <main className="login-panel grid w-full overflow-hidden rounded-[1.5rem] border bg-white shadow-panel lg:aspect-[5/3] lg:w-[76vw] lg:max-w-6xl lg:grid-cols-[1.1fr_0.9fr]">
          <section className="login-hero relative min-h-[27rem] overflow-hidden bg-clinical-700 p-6 sm:p-8 lg:min-h-0 lg:px-8 lg:pb-8 lg:pt-10">
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
                <path className="login-wave-glow" d="M520 94 H650 L668 88 L682 98 L699 95 L716 50 L731 124 L748 78 L765 96 H1000" stroke="#83f7f4" strokeOpacity=".85" strokeWidth="2.4" />
                <g fill="#66f0ee">
                  <circle cx="76" cy="278" r="4" /><circle cx="246" cy="305" r="3.5" /><circle cx="418" cy="246" r="4" />
                  <circle cx="592" cy="292" r="3.5" /><circle cx="790" cy="258" r="4" /><circle cx="930" cy="220" r="3.5" />
                </g>
              </svg>
            </div>
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div>
                <div className="mb-12 inline-flex max-w-full items-center gap-2 sm:mb-12">
                  <img src={`${import.meta.env.BASE_URL}icons/curatamed-mark.png`} alt="" aria-hidden="true" className="h-10 w-10 shrink-0 object-contain sm:h-11 sm:w-11" />
                  <img src={`${import.meta.env.BASE_URL}icons/curatamed-wordmark-light.png`} alt="CurataMed" className="h-8 w-auto max-w-[11rem] object-contain sm:h-9" />
                </div>
                <h2 className="getlabs-serif mt-0 max-w-xl text-3xl leading-[1.08] tracking-[-0.035em] !text-white sm:text-4xl lg:text-[clamp(1.85rem,2.75vw,2.5rem)]">
                  Run your <span className="text-cyan-200">whole hospital,</span><br className="hidden lg:block" />{' '}
                  or only the <span className="text-cyan-200">departments</span><br className="hidden lg:block" />{' '}
                  you need.
                </h2>
                <p className="mt-3 max-w-lg text-xs leading-5 text-cyan-50/90 sm:text-sm sm:leading-6 lg:text-xs lg:leading-5">
                  One patient record across every department you switch on — and nothing on your screens for the ones you do not.
                </p>
              </div>

              <div className="mt-6 grid gap-2 text-[11px] sm:grid-cols-2 sm:text-xs">
                {['Outpatients, wards & theatre', 'Laboratory & imaging', 'Pharmacy & stores', 'Billing & NHIS claims'].map((item) => (
                  <div key={item} className="flex min-h-9 items-center gap-1 rounded-full border border-white/20 bg-white/[0.08] px-2 py-1.5 text-[10px] text-white shadow-sm backdrop-blur-sm sm:px-2 sm:text-[10px]">
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-teal-200" />
                    <span className="font-semibold">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="login-form-section flex items-center p-5 sm:p-8 lg:px-8 lg:pb-4 lg:pt-8">
            <div className="w-full max-w-md">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 sm:text-xs">Secure sign in</p>
              <h2 className="getlabs-serif mt-1.5 text-[1.45rem] leading-tight tracking-[-0.035em] text-slate-900 sm:text-2xl">Open your workspace.</h2>
              <p className="mt-1.5 text-[11px] leading-5 text-slate-500 sm:text-xs sm:leading-5 lg:whitespace-nowrap lg:text-[10px]">Sign in with the staff account issued by your administrator.</p>

              <form onSubmit={submitCredentials} className="login-form mt-3 space-y-1 rounded-2xl border border-cyan-100 bg-cyan-50/45 p-2.5 sm:mt-3 sm:p-3">
                <label className="block" htmlFor="login-facility">
                  <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-slate-600"><Building2 className="h-3.5 w-3.5" aria-hidden="true" /> Facility code</span>
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
                  <span id="login-facility-hint" className="mt-1 block text-[10px] text-slate-500">The code your hospital or clinic was given.</span>
                </label>
                <label className="block" htmlFor="login-username">
                  <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-slate-600"><UserRound className="h-3.5 w-3.5" aria-hidden="true" /> Username</span>
                  <input id="login-username" name="username" autoComplete="username" autoFocus={Boolean(facilityCode)} value={username} onChange={(event) => setUsername(event.target.value)} className="getlabs-input" />
                </label>
                <label className="block" htmlFor="login-password">
                  <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-slate-600"><KeyRound className="h-3.5 w-3.5" aria-hidden="true" /> Password</span>
                  <input id="login-password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="getlabs-input" />
                </label>
                <Button className="getlabs-primary-button w-full justify-center" type="submit" disabled={submitting || !username.trim() || !password}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {submitting ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>

              <p className="mt-1.5 text-[10px] leading-4 text-slate-500 sm:mt-2 sm:text-[10px]">
                Sessions are secured with httpOnly cookies. Contact your system administrator if you need an account or a password reset.
              </p>
              <p className="mt-1 text-[11px] text-slate-600 sm:mt-1 sm:text-[10px] lg:whitespace-nowrap">
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
