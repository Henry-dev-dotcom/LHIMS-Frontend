import { BedDouble, Building2, CreditCard, FlaskConical, Lock, ShieldCheck, Smartphone, Stethoscope, Users } from 'lucide-react';
import { SiteLayout } from './SiteLayout';

const HIGHLIGHTS = [
  { icon: Stethoscope, title: 'Every department, one record', text: 'Outpatients, wards, theatre, maternity, laboratory, imaging, pharmacy and more share one patient chart.' },
  { icon: CreditCard, title: 'Billing and NHIS claims', text: 'Bills follow care automatically. Prepare NHIS and private insurance claims from completed visits.' },
  { icon: Lock, title: 'Your data stays yours', text: 'Each hospital’s records are kept separate. Every chart opening is logged, and nothing is deleted if a payment is late.' },
  { icon: Smartphone, title: 'Pay by mobile money', text: 'Subscribe monthly or yearly with card or mobile money. Add departments whenever you need them.' }
];

const STEPS = [
  { title: 'Choose your departments', text: 'Pick a plan and any extra departments on the pricing page. You see the price as you go.' },
  { title: 'Sign up in two minutes', text: 'Create your hospital and your administrator account. Your free trial starts at once — no card needed.' },
  { title: 'Set up and start', text: 'Add your details, staff and price list with the setup checklist, then register your first patient.' }
];

export function HomePage() {
  return (
    <SiteLayout active="home">
      <section className="bg-gradient-to-b from-white to-slate-50">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:py-20">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-clinical-700">Hospital management system</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl">Run your whole hospital on one system.</h1>
            <p className="mt-4 max-w-xl text-lg leading-8 text-slate-600">From the front desk to the ward, the lab and the cashier. Pay only for the departments you use, and add more as you grow.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#/pricing" className="rounded-2xl bg-clinical-500 px-5 py-3 text-sm font-semibold text-white shadow-lift hover:bg-clinical-600">Build your plan and start free</a>
              <a href="#/demo" className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-clinical-300">Request a demo</a>
            </div>
            <p className="mt-3 text-sm text-slate-500">Free trial · No card needed to start · Cancel any time</p>
          </div>
          <div className="grid grid-cols-2 gap-3" aria-hidden="true">
            {[
              [Users, 'Reception & OPD'],
              [BedDouble, 'Wards & theatre'],
              [FlaskConical, 'Lab & imaging'],
              [ShieldCheck, 'NHIS claims'],
              [CreditCard, 'Billing & finance'],
              [Building2, 'Stores & HR']
            ].map(([Icon, label]) => (
              <div key={label} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <Icon className="h-6 w-6 text-clinical-600" />
                <p className="mt-3 text-sm font-semibold text-slate-800">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-3xl border border-slate-200 bg-white p-5">
              <Icon className="h-6 w-6 text-clinical-600" aria-hidden="true" />
              <h2 className="mt-3 text-base font-bold text-slate-900">{title}</h2>
              <p className="mt-1.5 text-sm leading-6 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6">
        <h2 className="text-2xl font-bold tracking-tight">From sign-up to your first patient</h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-clinical-500 text-sm font-bold text-white">{i + 1}</span>
              <h3 className="mt-3 font-bold">{step.title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">{step.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 rounded-3xl bg-clinical-500 p-6 text-white sm:flex sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Ready when you are</h2>
            <p className="mt-1 text-sm text-white/85">Start a free trial today, or talk to us first about moving your hospital over.</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 sm:mt-0">
            <a href="#/pricing" className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-clinical-800">See pricing</a>
            <a href="#/demo" className="rounded-2xl border border-white/60 px-4 py-2.5 text-sm font-semibold text-white">Talk to us</a>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
