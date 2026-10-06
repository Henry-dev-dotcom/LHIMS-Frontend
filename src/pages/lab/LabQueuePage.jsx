import { useMemo, useState } from 'react';
import { FlaskConical, Search } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime } from '../../utils/formatters';
import { incomingQueue, pendingTests, queueMatches, requestedBy } from '../../utils/diagnosticWorkflow';

/*
  Incoming Labs - the first of the laboratory's three tabs.

  Everything a clinician has requested that the bench has not yet taken in. One
  row per patient, because that is how samples arrive: a rack of tubes with a
  name on them. Open a row to tick the tests whose samples are actually there.

  The columns are the ones the bench reads off - who the patient is, what was
  asked for, when, and by whom. This page used to carry status filters, urgency
  filters, metric cards and a stepper, none of which answer the only question
  being asked here, which is whose samples are waiting.
*/
export function LabQueuePage() {
  const { state, dispatch } = useAppStore();
  const [query, setQuery] = useState('');

  const rows = useMemo(() => incomingQueue(state.data, 'Laboratory'), [state.data]);
  const visible = rows.filter((order) => queueMatches(order, query));

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Laboratory · Incoming"
        title="Incoming Labs"
        description="Requests sent by clinicians. Open a patient to accept the samples that are available now."
      />

      <Card
        title={`${rows.length} request${rows.length === 1 ? '' : 's'} waiting`}
        subtitle="Anything you do not accept stays here until its sample arrives."
        actions={(
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" aria-hidden="true" />
            <input
              className={`${inputClass} pl-9`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search patient name or Hospital ID..."
              aria-label="Search patient name or Hospital ID"
            />
          </div>
        )}
      >
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <FlaskConical className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
            <p className="mt-2 font-bold text-slate-900">{rows.length ? 'No patient matches your search.' : 'No tests in the queue.'}</p>
            <p className="mt-1 text-sm text-slate-500">
              {rows.length ? 'Clear the search to see everything waiting.' : 'Requests appear here as soon as a clinician sends them.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <th className="py-2 pr-3">Patient</th>
                  <th className="py-2 pr-3">Requested Labs</th>
                  <th className="py-2 pr-3">Time Requested</th>
                  <th className="py-2 pr-3">Requested By</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {visible.map((order) => {
                  const pending = pendingTests(order, 'Laboratory');
                  return (
                    <tr key={order.id} className="border-b border-slate-100 align-top last:border-b-0">
                      <td className="py-3 pr-3">
                        <p className="font-bold text-slate-900">{order.patient?.fullName || 'Unknown patient'}</p>
                        <p className="text-xs font-semibold text-slate-500">{order.patient?.id || '—'}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {pending.map((row) => (
                            <span key={row.orderItemId} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{row.name}</span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-slate-600">{order.createdAt ? formatDateTime(order.createdAt) : '—'}</td>
                      <td className="py-3 pr-3 text-slate-600">{requestedBy(order)}</td>
                      <td className="py-3">
                        <Button size="sm" onClick={() => dispatch({ type: 'OPEN_LAB_ACCEPT', orderId: order.id })}>Open</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
