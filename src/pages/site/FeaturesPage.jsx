import { SiteLayout } from './SiteLayout';
import { useCatalogue } from './useCatalogue';
import { CATEGORY_LABEL } from '../../services/publicService';
import { money } from '../../utils/formatters';

export function FeaturesPage() {
  const { data, loading, error } = useCatalogue();
  const departments = data?.departments || [];
  const addOnPrice = Object.fromEntries((data?.addOns || []).map((a) => [a.moduleKey, a.monthlyPrice]));
  const cheapestPlanWith = (key) => (data?.plans || []).find((p) => p.modules.includes(key));

  return (
    <SiteLayout active="features">
      <section className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-clinical-700">Departments</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Switch on what your hospital needs</h1>
        <p className="mt-3 max-w-2xl text-slate-600">Each department can be switched on or off on its own. Plans bundle the common ones; anything else can be added for a monthly price.</p>
        {loading && <p className="mt-8 text-sm text-slate-500">Loading departments…</p>}
        {error && <p role="alert" className="mt-8 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        {Object.entries(CATEGORY_LABEL).map(([category, label]) => {
          const list = departments.filter((d) => d.category === category);
          if (!list.length) return null;
          return (
            <div key={category} className="mt-10">
              <h2 className="text-lg font-bold">{label}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((d) => {
                  const plan = cheapestPlanWith(d.key);
                  return (
                    <article key={d.key} className="rounded-3xl border border-slate-200 bg-white p-5">
                      <h3 className="font-bold text-slate-900">{d.name}</h3>
                      <p className="mt-1.5 text-sm leading-6 text-slate-600">{d.description}</p>
                      <p className="mt-3 text-xs font-semibold text-slate-500">
                        {plan ? `Included from the ${plan.name} plan` : 'Available as an add-on'}
                        {addOnPrice[d.key] !== undefined ? ` · or add it for ${money(addOnPrice[d.key])}/month` : ''}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="mt-12 flex flex-wrap gap-3">
          <a href="#/pricing" className="rounded-2xl bg-clinical-500 px-5 py-3 text-sm font-semibold text-white shadow-lift">Build your plan</a>
          <a href="#/demo" className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">Ask us a question</a>
        </div>
      </section>
    </SiteLayout>
  );
}
