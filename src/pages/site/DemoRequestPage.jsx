import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { SiteLayout } from './SiteLayout';
import { fieldErrors, publicService } from '../../services/publicService';

const inputClass = 'mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-clinical-400 focus:ring-4 focus:ring-clinical-100';

export function DemoRequestPage() {
  const [form, setForm] = useState({ name: '', organisation: '', email: '', phone: '', facilityType: '', message: '', website: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setFormError('');
    try {
      await publicService.demoRequest({ ...form, phone: form.phone.trim(), facilityType: form.facilityType || undefined, message: form.message.trim() || undefined });
      setSent(true);
    } catch (error) {
      setErrors(fieldErrors(error));
      setFormError(error?.message === 'Validation failed' ? 'Some details need fixing — see below.' : error?.message || 'The request could not be sent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SiteLayout active="demo">
      <section className="mx-auto max-w-2xl px-4 py-12">
        {sent ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden="true" />
            <h1 className="mt-4 text-3xl font-bold tracking-tight">Thank you</h1>
            <p className="mt-3 text-slate-600">We have your request and will contact you within one working day to arrange a demo.</p>
            <a href="#/pricing" className="mt-6 inline-block rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold">Meanwhile, see pricing</a>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-white">Request a demo</h1>
            <p className="mt-2 text-slate-300">Tell us about your hospital and we will show you CurataMed with your departments, and help you plan the move from paper or your current system.</p>
            <form onSubmit={submit} noValidate className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                ['name', 'Your name', 'name'],
                ['organisation', 'Hospital or clinic', 'organization'],
                ['email', 'Email', 'email'],
                ['phone', 'Phone (optional)', 'tel']
              ].map(([key, label, auto]) => (
                <label key={key} className="block text-sm font-semibold text-slate-200">
                  {label}
                  <input className={inputClass} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} autoComplete={auto} value={form[key]} onChange={set(key)} />
                  {errors[key] && <span className="mt-1 block text-xs font-semibold text-red-600">{errors[key]}</span>}
                </label>
              ))}
              <label className="block text-sm font-semibold text-slate-200 sm:col-span-2">
                What would you like to see? (optional)
                <textarea className={`${inputClass} min-h-28`} value={form.message} onChange={set('message')} placeholder="For example: number of beds, departments, whether you claim from NHIS." />
              </label>
              <div className="hidden" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} /></label></div>
              {formError && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 sm:col-span-2">{formError}</p>}
              <div className="sm:col-span-2">
                <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-2xl bg-clinical-500 px-6 py-3 text-sm font-semibold text-white shadow-lift disabled:opacity-60">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Send request
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </SiteLayout>
  );
}
