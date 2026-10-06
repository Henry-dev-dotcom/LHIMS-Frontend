import { useMemo, useState } from 'react';
import { ScanLine, Search } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime } from '../../utils/formatters';
import { incomingQueue, pendingTests, queueMatches, requestedBy } from '../../utils/diagnosticWorkflow';

/*
  Incoming Scans - the first of the imaging unit's three tabs.

  The same shape as the laboratory's incoming queue, because it is the same job:
  a clinician has asked for studies and the unit takes in the ones it is about to
  do. One row per patient; open it to tick the studies and accept them.
*/
export function ScanQueuePage() {
  const { state, dispatch } = useAppStore();
  const [query, setQuery] = useState('');

  const rows = useMemo(() => incomingQueue(state.data, 'Imaging'), [state.data]);
  const visible = rows.filter((order) => queueMatches(order, query));

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Imaging · Incoming"
        title="Incoming Scans"
        description="Requests sent by clinicians. Open a patient to accept the studies you are about to do."
      />

      <Card
        title={`${rows.length} request${rows.length === 1 ? '' : 's'} waiting`}
        subtitle="Anything you do not accept stays here until the patient is ready for it."
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
            <ScanLine className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
            <p className="mt-2 font-bold text-slate-900">{rows.length ? 'No patient matches your search.' : 'No scans in the queue.'}</p>
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
                  <th className="py-2 pr-3">Requested Scans</th>
                  <th className="py-2 pr-3">Time Requested</th>
                  <th className="py-2 pr-3">Requested By</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {visible.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100 align-top last:border-b-0">
                    <td className="py-3 pr-3">
                      <p className="font-bold text-slate-900">{order.patient?.fullName || 'Unknown patient'}</p>
                      <p className="text-xs font-semibold text-slate-500">{order.patient?.id || '—'}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {pendingTests(order, 'Imaging').map((row) => (
                          <span key={row.orderItemId} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                            {row.name}{row.item?.modality ? ` · ${row.item.modality}` : ''}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-slate-600">{order.createdAt ? formatDateTime(order.createdAt) : '—'}</td>
                    <td className="py-3 pr-3 text-slate-600">{requestedBy(order)}</td>
                    <td className="py-3">
                      <Button size="sm" onClick={() => dispatch({ type: 'OPEN_SCAN_ACCEPT', orderId: order.id })}>Open</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
