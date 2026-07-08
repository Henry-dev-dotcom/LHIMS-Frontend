import { useMemo, useState } from 'react';
import { ClipboardCheck, Clock, RotateCcw, Search, UsersRound } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { inputClass } from '../../components/ui/FormField';
import { MetricCard } from '../../components/ui/MetricCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAppStore } from '../../store/AppStore';
import { ReceptionPageTabs } from './ReceptionPageTabs';
import { formatDateTime, getById } from '../../utils/formatters';

function isSameDate(iso, dateValue) {
  if (!dateValue) return true;
  if (!iso) return false;
  return new Date(iso).toISOString().slice(0, 10) === dateValue;
}

export function ReceptionDailyVisitsPage() {
  const { state, dispatch } = useAppStore();
  const today = new Date().toISOString().slice(0, 10);
  const [section, setSection] = useState('register');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [date, setDate] = useState(today);

  const visits = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (state.data.dailyVisits || [])
      .map((visit) => {
        const patient = getById(state.data.patients, visit.patientId);
        const order = getById(state.data.orders, visit.orderId);
        return { ...visit, patient, order };
      })
      .filter((visit) => !date || isSameDate(visit.checkedInAt, date))
      .filter((visit) => !status || visit.status === status)
      .filter((visit) => !q || [visit.id, visit.patient?.fullName, visit.patient?.phone, visit.patient?.id, visit.orderId, visit.status, visit.checkedInBy].filter(Boolean).join(' ').toLowerCase().includes(q))
      .sort((a, b) => new Date(b.checkedInAt) - new Date(a.checkedInAt));
  }, [state.data, query, status, date]);

  const checkedIn = visits.filter((visit) => visit.status === 'Checked In').length;
  const completed = visits.filter((visit) => visit.status === 'Visit Completed').length;
  const walkins = visits.filter((visit) => visit.status === 'Walk-in Registered' || !visit.orderId).length;
  const unverified = visits.filter((visit) => !visit.identityVerified).length;

  const pageSections = [
    { id: 'summary', label: 'Summary', helper: 'Shift counts', icon: UsersRound, tone: 'blue', count: visits.length },
    { id: 'register', label: 'Visit Register', helper: 'Daily table', icon: ClipboardCheck, tone: 'emerald', count: visits.length },
    { id: 'exceptions', label: 'Exceptions', helper: 'No-show/unverified', icon: Search, tone: 'amber', count: unverified }
  ];

  function updateVisit(visit, nextStatus) {
    const note = nextStatus === 'Visit Completed' ? 'Visit completed at reception.' : 'Visit status updated by reception.';
    dispatch({ type: 'UPDATE_DAILY_VISIT_STATUS', payload: { visitId: visit.id, status: nextStatus, note } });
  }

  const visitTableRows = section === 'exceptions' ? visits.filter((visit) => !visit.identityVerified || visit.status === 'No Show') : visits;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Reception"
        title="Daily Visit Log"
        description="Track checked-in patients, walk-ins, linked orders, identity status, and visit completion."
      />
      <ReceptionPageTabs
        label="Daily visit sections"
        sections={pageSections}
        active={section}
        onChange={setSection}
        actions={(
          <div className="grid gap-2 sm:grid-cols-[minmax(10rem,1fr)_9rem_10rem_auto]">
            <input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter visits..." aria-label="Filter daily visits" />
            <input type="date" className={inputClass} value={date} onChange={(event) => setDate(event.target.value)} aria-label="Filter by visit date" />
            <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by visit status">
              <option value="">All statuses</option>
              <option>Checked In</option>
              <option>Walk-in Registered</option>
              <option>Visit Completed</option>
              <option>No Show</option>
            </select>
            <Button variant="secondary" className="px-3 py-2 text-xs" onClick={() => { setDate(today); setStatus(''); setQuery(''); }}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>
        )}
      />

      {section === 'summary' && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Visible Visits" value={visits.length} icon={UsersRound} tone="blue" />
        <MetricCard label="Checked In" value={checkedIn} icon={ClipboardCheck} tone="green" />
        <MetricCard label="Completed" value={completed} icon={Clock} tone="purple" />
        <MetricCard label="Needs Verification" value={unverified} icon={Search} tone="yellow" />
      </div>}


      {['register', 'exceptions'].includes(section) && <Card title={section === 'exceptions' ? 'Exceptions register' : 'Reception daily visit register'} subtitle="Mark completed visits after patient handoff, sample collection, imaging attendance, or billing resolution." compact>
        <DataTable
          columns={[
            { key: 'id', label: 'Visit ID', render: (row) => <span className="font-bold text-slate-900">{row.id}</span> },
            { key: 'patient', label: 'Patient', render: (row) => <div><p className="font-bold text-slate-900">{row.patient?.fullName || '—'}</p><p className="text-xs text-slate-500">{row.patient?.id} · {row.patient?.phone || 'No phone'}</p></div> },
            { key: 'order', label: 'Linked Order', render: (row) => row.orderId ? <div><p className="font-bold">{row.orderId}</p><p className="text-xs text-slate-500">{row.order?.status || '—'}</p></div> : <span className="text-slate-500">Walk-in / no order</span> },
            { key: 'identityVerified', label: 'Identity', render: (row) => <StatusBadge status={row.identityVerified ? 'Verified' : 'Not verified'} /> },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
            { key: 'checkedInBy', label: 'Checked In By' },
            { key: 'checkedInAt', label: 'Time', render: (row) => formatDateTime(row.checkedInAt) },
            { key: 'actions', label: 'Actions', render: (row) => <div className="flex flex-wrap gap-2"><Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => updateVisit(row, 'Visit Completed')}>Complete</Button><Button variant="subtle" className="px-3 py-1.5 text-xs" onClick={() => updateVisit(row, 'No Show')}>No Show</Button></div> }
          ]}
          rows={visitTableRows}
          emptyMessage="No visits match this filter."
        />
      </Card>}
    </div>
  );
}
