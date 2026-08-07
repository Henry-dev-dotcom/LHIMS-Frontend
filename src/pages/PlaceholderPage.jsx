import { ClipboardList } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/StatusBadge';

export function PlaceholderPage({ title, description, section, requirements = [] }) {
  return (
    <div>
      <PageHeader eyebrow={section || 'Module'} title={title} description={description} />
      <Card title="Module overview" subtitle="This workspace is available in the navigation structure and will display the selected operational requirements.">
        <div className="mb-5"><StatusBadge status="Foundation Ready" /></div>
        {requirements.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {requirements.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-800">{item}</p>
                <p className="mt-1 text-xs text-slate-500">Will be implemented in its dedicated build section.</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-10 text-center text-slate-500">
            <div className="flex flex-col items-center justify-center gap-2">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-500"><ClipboardList className="h-5 w-5" /></span>
              <span className="font-semibold">No operational requirements listed yet.</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
