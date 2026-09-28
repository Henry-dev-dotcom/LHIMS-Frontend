import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { listItems } from '../../api/normalizers';
import { DOSE_STATUS, childHealthService } from '../../services/childHealthService';
import { ageLabel, patientName } from '../opd/opdUtils';

const formatDay = (value) => (value ? new Date(value).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/** Children under five with doses due or overdue, for the defaulter-tracing list. */
export function ImmunizationDueListPage() {
  const { dispatch } = useAppStore();
  const [include, setInclude] = useState('OVERDUE');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(listItems(await childHealthService.dueList(apiClient, { include })));
    } catch (error) {
      toast('error', error?.message || 'The due list could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [include, toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Child health" title="Immunisation due list" description="Children under five with vaccines due or overdue. Overdue means more than four weeks past the due date: trace these families." />
      <Card
        title={include === 'OVERDUE' ? 'Defaulters' : 'Due and overdue'}
        subtitle={loading ? 'Loading…' : `${rows.length} child${rows.length === 1 ? '' : 'ren'}`}
        actions={(
          <>
            <label className="sr-only" htmlFor="due-include">Show</label>
            <select id="due-include" className="rounded-2xl border border-slate-200 px-3 py-2 text-sm" value={include} onChange={(e) => setInclude(e.target.value)}>
              <option value="OVERDUE">Overdue only</option>
              <option value="ALL">Due and overdue</option>
            </select>
            <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>
          </>
        )}
      >
        <DataTable
          caption="Children with vaccines due"
          rowBadge={() => null}
          emptyMessage={loading ? 'Loading…' : 'No children on this list.'}
          rows={rows.map((row) => ({ ...row, id: row.patient.id }))}
          columns={[
            { key: 'patient', label: 'Child', mobilePrimary: true, render: (row) => (
              <span><span className="font-semibold text-slate-900">{patientName(row.patient)}</span><span className="block text-xs text-slate-500">{row.patient.patientCode} · {ageLabel(row.patient.dateOfBirth)}</span></span>
            ) },
            { key: 'phone', label: 'Phone', render: (row) => row.patient.phone || '—' },
            { key: 'pending', label: 'Vaccines', render: (row) => (
              <ul className="flex flex-wrap gap-1">
                {row.pending.map((p) => <li key={p.code} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${DOSE_STATUS[p.status].className}`} title={`Due ${formatDay(p.dueDate)}`}>{p.name}</li>)}
              </ul>
            ) },
            { key: 'since', label: 'Due since', render: (row) => formatDay(row.pending[0]?.dueDate) }
          ]}
        />
      </Card>
    </div>
  );
}
