import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, BedDouble, Check, CreditCard, Database, FlaskConical, Lock, Package, Receipt, ShieldCheck, Smartphone, Users } from 'lucide-react';
import { goTo } from '../../services/publicService';
import '../../styles/landing.css';

/*
  The public home page.

  The look is a dark, glowing one: a heartbeat line drawn behind everything,
  glass cards that light up under the pointer, and sections that fade in as they
  scroll into view. It lives on its own layout instead of SiteLayout because the
  pricing, features and sign-up pages are light pages that share that layout, and
  they would not survive being put on a dark background.

  Links are hash routes (#/pricing), not in-page anchors, because the app's own
  router owns the hash.
*/

const NAV_LINKS = [
  { href: '#/features', label: 'Departments' },
  { href: '#/pricing', label: 'Pricing' },
  { href: '#/demo', label: 'Request a demo' }
];

const DEPARTMENTS = [
  { icon: Users, title: 'Reception & OPD', text: 'Front desk, queues & visits' },
  { icon: BedDouble, title: 'Wards & theatre', text: 'Beds, rounds & surgery lists' },
  { icon: FlaskConical, title: 'Lab & imaging', text: 'Orders, results & films' },
  { icon: ShieldCheck, title: 'NHIS claims', text: 'Prepare & track claims' },
  { icon: CreditCard, title: 'Billing & finance', text: 'Invoices, receipts & reports' },
  { icon: Package, title: 'Stores & HR', text: 'Stock, staff & shifts' }
];

const MARQUEE = ['Reception & OPD', 'Wards & theatre', 'Lab & imaging', 'NHIS claims', 'Billing & finance', 'Stores & HR', 'Mobile money payments', 'One patient record'];

const STATS = [
  { value: 6, suffix: '+', label: 'Core departments' },
  { value: 2, suffix: ' min', label: 'Sign-up time' },
  { value: 100, suffix: '%', label: 'Your data stays yours' }
];

const STEPS = [
  { title: 'Choose your departments', text: 'Pick a plan and any extra departments on the pricing page. You see the price as you go — pay only for what you use.' },
  { title: 'Sign up in two minutes', text: 'Create your hospital and your administrator account. Your free trial starts at once — no card needed.' },
  { title: 'Set up and start', text: 'Add your details, staff and price list with the setup checklist, then register your first patient.' }
];

const prefersReducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/* One heartbeat of an ECG trace, as a function of how far through the beat we are. */
function beat(u) {
  const x = ((u % 1) + 1) % 1;
  const g = (c, s) => {
    let d = Math.abs(x - c);
    d = Math.min(d, 1 - d);
    return Math.exp(-(d / s) * (d / s));
  };
  return 0.13 * g(0.14, 0.045) - 0.09 * g(0.34, 0.014) + g(0.37, 0.011) - 0.17 * g(0.4, 0.014) + 0.26 * g(0.56, 0.055);
}

/** The heartbeat line that runs behind the page. Stops drawing when the page is left. */
function HeartbeatCanvas() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const cx = canvas?.getContext('2d');
    if (!canvas || !cx) return undefined;
    let W = 0;
    let H = 0;
    let raf = 0;

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (shift) => {
      const mobile = W < 640;
      const beats = Math.max(4, Math.round(W / 260));
      const y0 = H * (mobile ? 0.3 : 0.4);
      const amp = Math.min(120, H * 0.15) * (mobile ? 0.65 : 1);
      cx.clearRect(0, 0, W, H);
      cx.beginPath();
      for (let x = 0; x <= W; x += 3) {
        const y = y0 - amp * beat((x / W) * beats - shift);
        if (x === 0) cx.moveTo(x, y);
        else cx.lineTo(x, y);
      }
      cx.strokeStyle = 'rgba(34,211,238,.28)';
      cx.lineWidth = 5;
      cx.shadowColor = 'rgba(34,211,238,.8)';
      cx.shadowBlur = 14;
      cx.stroke();
      cx.shadowBlur = 0;
      cx.strokeStyle = 'rgba(160,245,255,.9)';
      cx.lineWidth = 1.6;
      cx.stroke();
      // The bright head that travels along the line.
      const hx = W - (((shift % beats) + beats) % beats) / beats * W;
      const hy = y0 - amp * beat((hx / W) * beats - shift);
      const glow = cx.createRadialGradient(hx, hy, 0, hx, hy, 26);
      glow.addColorStop(0, 'rgba(140,240,255,.5)');
      glow.addColorStop(1, 'rgba(140,240,255,0)');
      cx.fillStyle = glow;
      cx.beginPath();
      cx.arc(hx, hy, 26, 0, 7);
      cx.fill();
      cx.fillStyle = '#dffaff';
      cx.beginPath();
      cx.arc(hx, hy, 3, 0, 7);
      cx.fill();
    };

    size();
    window.addEventListener('resize', size);
    if (prefersReducedMotion()) {
      draw(0);
    } else {
      const start = performance.now();
      const loop = (now) => {
        draw(((now - start) / 1000) * 1.1);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
    };
  }, []);

  return <canvas ref={ref} className="cm-ecg" aria-hidden="true" />;
}

/** A number that counts up the first time it scrolls into view. */
function CountUp({ value }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      setShown(value);
      return undefined;
    }
    let raf = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min((now - start) / 1200, 1);
        setShown(Math.round(value * (1 - (1 - p) ** 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);

  return <span ref={ref}>{shown}</span>;
}

export function HomePage() {
  const rootRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Sections start hidden only once this has run, so if the script never ran the
  // page would still be readable instead of blank.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    root.classList.add('cm-js');
    const items = root.querySelectorAll('.cm-reveal');
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      items.forEach((el) => el.classList.add('in'));
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const spotlight = (event) => {
    const tile = event.currentTarget;
    const rect = tile.getBoundingClientRect();
    tile.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    tile.style.setProperty('--my', `${event.clientY - rect.top}px`);
  };

  const logo = `${import.meta.env.BASE_URL}icons/curatamed-wordmark-light.png`;

  return (
    <div className="cm" ref={rootRef}>
      <div className="cm-bg" aria-hidden="true" />
      <div className="cm-blob cm-b1" aria-hidden="true" />
      <div className="cm-blob cm-b2" aria-hidden="true" />
      <div className="cm-blob cm-b3" aria-hidden="true" />
      <div className="cm-grid" aria-hidden="true" />
      <HeartbeatCanvas />
      <div className="cm-noise" aria-hidden="true" />

      <header className={`cm-nav${scrolled ? ' scrolled' : ''}`}>
        <div className="cm-nav-inner">
          <a className="cm-logo" href="#/home" aria-label="CurataMed home">
            <img src={logo} alt="CurataMed — Hospital Management System" />
          </a>
          <nav className="cm-links" aria-label="Website">
            {NAV_LINKS.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
          </nav>
          <div className="cm-cta">
            <a className="cm-signin" href="#/login">Sign in</a>
            <a className="cm-btn cm-btn-primary cm-btn-sm" href="#/pricing">Start free trial</a>
            <button
              type="button"
              className={`cm-burger${menuOpen ? ' open' : ''}`}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>
      <nav className={`cm-mobile${menuOpen ? ' open' : ''}`} aria-label="Website menu" aria-hidden={!menuOpen}>
        {NAV_LINKS.map((l) => <a key={l.href} href={l.href} tabIndex={menuOpen ? 0 : -1} onClick={() => setMenuOpen(false)}>{l.label}</a>)}
        <a href="#/login" tabIndex={menuOpen ? 0 : -1} onClick={() => setMenuOpen(false)}>Sign in</a>
      </nav>

      <main id="main-content">
        {/* HERO */}
        <section className="cm-hero">
          <div className="cm-wrap cm-hero-grid">
            <div>
              <span className="cm-eyebrow cm-reveal"><span className="cm-dot" />Hospital management system</span>
              <h1 className="cm-reveal d1">Run your whole hospital on <span className="cm-grad">one system.</span></h1>
              <p className="cm-lede cm-reveal d2">From the front desk to the ward, the lab and the cashier. Pay only for the departments you use, and add more as you grow.</p>
              <div className="cm-ctas cm-reveal d3">
                <a className="cm-btn cm-btn-primary" href="#/pricing">
                  Build your plan and start free
                  <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
                </a>
                <a className="cm-btn cm-btn-ghost" href="#/demo">Request a demo</a>
              </div>
              <p className="cm-note cm-reveal d3">
                <Check size={14} strokeWidth={2.2} color="#2dd4bf" aria-hidden="true" />
                Free trial &nbsp;·&nbsp; No card needed to start &nbsp;·&nbsp; Cancel any time
              </p>
              <div className="cm-stats cm-reveal d3">
                {STATS.map((s) => (
                  <div key={s.label}>
                    <div className="cm-num"><CountUp value={s.value} /><em>{s.suffix.replace(' ', ' ')}</em></div>
                    <div className="cm-lbl">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="cm-depts cm-reveal d2">
              {DEPARTMENTS.map(({ icon: Icon, title, text }) => (
                <a key={title} className="cm-tile" href="#/features" onPointerMove={spotlight}>
                  <span className="cm-icon"><Icon size={19} strokeWidth={1.8} aria-hidden="true" /></span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  <ArrowUpRight className="cm-arrow" size={15} strokeWidth={2} aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* MARQUEE: the list twice so the loop has no seam */}
        <div className="cm-marquee" aria-hidden="true">
          <div className="cm-track">
            {[...MARQUEE, ...MARQUEE].map((item, i) => <span key={`${item}-${i}`}><i />{item}</span>)}
          </div>
        </div>

        {/* FEATURES */}
        <section className="cm-sec" id="why">
          <div className="cm-wrap">
            <div className="cm-head cm-reveal">
              <span className="cm-eyebrow"><span className="cm-dot" />Why CurataMed</span>
              <h2>Everything a hospital needs.<br />Nothing it doesn’t.</h2>
              <p>Modular by design — start with the departments you need today and switch the rest on when you’re ready.</p>
            </div>
            <div className="cm-bento">
              <div className="cm-card big cm-reveal">
                <span className="cm-glow" />
                <span className="cm-icon"><Database size={21} strokeWidth={1.8} aria-hidden="true" /></span>
                <h3>Every department, one record</h3>
                <p>Outpatients, wards, theatre, maternity, laboratory, imaging, pharmacy and more share one patient chart. Every note, result and prescription lives in a single timeline — so nothing gets lost between departments and clinicians always see the full picture.</p>
              </div>
              <div className="cm-card cm-reveal d1">
                <span className="cm-glow" />
                <span className="cm-icon"><Receipt size={21} strokeWidth={1.8} aria-hidden="true" /></span>
                <h3>Billing &amp; NHIS claims</h3>
                <p>Bills follow care automatically. Prepare NHIS and private claims from completed visits.</p>
              </div>
              <div className="cm-card cm-reveal d1">
                <span className="cm-glow" />
                <span className="cm-icon"><Lock size={21} strokeWidth={1.8} aria-hidden="true" /></span>
                <h3>Your data stays yours</h3>
                <p>Each hospital’s records are kept separate, every chart is logged, and nothing is deleted.</p>
              </div>
              <div className="cm-card wide cm-reveal d2">
                <span className="cm-glow" />
                <span className="cm-icon"><Smartphone size={21} strokeWidth={1.8} aria-hidden="true" /></span>
                <div>
                  <h3>Pay by mobile money</h3>
                  <p>Subscribe monthly or yearly with MTN MoMo, Vodafone Cash or AirtelTigo Money — priced in Ghana cedis, no forex surprises. Add departments whenever you need them and your bill grows only when you do.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STEPS */}
        <section className="cm-sec" style={{ paddingTop: 20 }}>
          <div className="cm-wrap">
            <div className="cm-head cm-reveal">
              <span className="cm-eyebrow"><span className="cm-dot" />Getting started</span>
              <h2>From sign-up to your first patient</h2>
            </div>
            <ol className="cm-steps">
              {STEPS.map((step, i) => (
                <li key={step.title} className={`cm-step cm-reveal${i ? ` d${i}` : ''}`}>
                  <div className="cm-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CTA */}
        <section className="cm-sec" style={{ paddingTop: 20 }}>
          <div className="cm-wrap">
            <div className="cm-panel cm-reveal">
              <h2>Ready when you are</h2>
              <p>Start a free trial today, or talk to us first about moving your hospital over.</p>
              <div className="cm-row">
                <a className="cm-btn cm-btn-primary" href="#/pricing">See pricing</a>
                <a className="cm-btn cm-btn-ghost" href="#/demo">Talk to us</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="cm-footer">
        <div className="cm-wrap cm-foot">
          <small>© {new Date().getFullYear()} CurataMed. Hospital management for Ghana and beyond. Prices in Ghana cedis (GH₵).</small>
          <div className="cm-foot-links">
            <a href="#/features">Departments</a>
            <a href="#/pricing">Pricing</a>
            <a href="#/demo">Contact</a>
            <button type="button" onClick={() => goTo('login')}>Staff sign in</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
