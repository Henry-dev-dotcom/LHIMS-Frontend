import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, CheckSquare, FlaskConical, Search, Square } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { MetricCard } from '../../components/ui/MetricCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime } from '../../utils/formatters';
import { describeOrderItems, getLabOrders } from '../../utils/orderViews';

function labQueueMatches(row, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [row.id, row.patient?.fullName, row.patient?.id, row.doctor?.name, row.hospital?.name, describeOrderItems(row.items), row.urgency, row.status]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

function sampleStateForOrder(data, orderId) {
  const samples = (data.sampleLogs || []).filter((sample) => sample.orderId === orderId);
  if (samples.some((sample) => sample.status === 'Accepted')) return 'Accepted';
  if (samples.some((sample) => sample.status === 'Rejected')) return 'Rejected';
  if (samples.some((sample) => sample.status === 'Recollection Requested')) return 'Recollection Requested';
  return 'Not Accepted';
}

function acceptedSampleForOrder(data, orderId) {
  return (data.sampleLogs || []).find((sample) => sample.orderId === orderId && sample.status === 'Accepted');
}

function labItemsForOrder(order) {
  return (order?.items || []).filter(Boolean);
}

function LabQueueStepper({ currentStep }) {
  const steps = [
    { number: 1, label: 'Search patient' },
    { number: 2, label: 'Add tests' },
    { number: 3, label: 'Accept sample' }
  ];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="grid gap-2 md:grid-cols-3">
        {steps.map((step) => {
          const active = step.number === currentStep;
          const complete = step.number < currentStep;
          return (
            <div key={step.number} className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${active ? 'bg-clinical-50 text-clinical-800' : complete ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-500'}`}>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${active ? 'bg-clinical-600 text-white' : complete ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500'}`}>
                {complete ? <CheckCircle2 className="h-4 w-4" /> : step.number}
              </span>
              <span className="text-sm font-bold">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PatientRequestCard({ order, data, onAddTest }) {
  const sampleState = sampleStateForOrder(data, order.id);
  const isAccepted = sampleState === 'Accepted';

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-clinical-200 hover:bg-slate-50/70">
      <div className="grid gap-3 xl:grid-cols-[minmax(230px,1fr)_minmax(190px,0.62fr)_minmax(150px,0.45fr)_minmax(250px,0.8fr)]">
        <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-3">
          <p className="truncate text-base font-bold text-slate-900">{order.patient?.fullName}</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-500">{order.patient?.id} · {order.patient?.phone || 'No phone'}</p>
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Order ID</p>
          <p className="mt-0.5 break-words text-sm font-bold text-slate-900">{order.id}</p>
        </div>

        <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Time</p>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-900">{formatDateTime(order.createdAt)}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Request created</p>
        </div>

        <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Priority</p>
          <div className="mt-3"><StatusBadge status={order.urgency} /></div>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Clinician / Hospital</p>
            <p className="mt-1 truncate font-bold text-slate-900">{order.doctor?.name}</p>
            <p className="truncate text-sm text-slate-500">{order.hospital?.name}</p>
          </div>
          <Button onClick={() => onAddTest(order)} className="w-full justify-center">
            <FlaskConical className="h-4 w-4" /> {isAccepted ? 'Open Tests' : 'Add Test'}
          </Button>
        </div>
      </div>
    </article>
  );
}

export function LabQueuePage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [sampleFilter, setSampleFilter] = useState('');
  const [workspace, setWorkspace] = useState(state.ui.activeLabAcceptOrderId ? 'tests' : 'queue');
  const [activeOrderId, setActiveOrderId] = useState(state.ui.activeLabAcceptOrderId || '');
  const [selectedTestIds, setSelectedTestIds] = useState([]);
  const [flowError, setFlowError] = useState('');

  const labOrders = useMemo(() => getLabOrders(data), [data]);
  const baseRows = useMemo(() => labOrders
    .filter((order) => !status || order.status === status)
    .filter((order) => labQueueMatches(order, query))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [labOrders, query, status]);
  const rows = baseRows.filter((order) => !sampleFilter || sampleStateForOrder(data, order.id) === sampleFilter);
  const activeOrder = labOrders.find((order) => order.id === activeOrderId) || null;
  const activeLabItems = labItemsForOrder(activeOrder);
  const acceptedSample = activeOrder ? acceptedSampleForOrder(data, activeOrder.id) : null;
  const acceptedOrderIds = new Set((data.sampleLogs || []).filter((sample) => sample.status === 'Accepted').map((sample) => sample.orderId));
  const awaitingSample = baseRows.filter((order) => !acceptedOrderIds.has(order.id)).length;
  const urgent = baseRows.filter((order) => order.urgency === 'Urgent').length;
  const acceptedCount = baseRows.filter((order) => acceptedOrderIds.has(order.id)).length;
  const selectedLabItems = activeLabItems.filter((item) => selectedTestIds.includes(item.id));

  const openAddTestsWindow = (order) => {
    const sample = acceptedSampleForOrder(data, order.id);
    const labItems = labItemsForOrder(order);
    setActiveOrderId(order.id);
    setSelectedTestIds(sample?.labItemIds?.length ? sample.labItemIds : labItems.map((item) => item.id));
    setFlowError('');
    setWorkspace('tests');
  };

  const goBackToQueue = () => {
    setWorkspace('queue');
    setActiveOrderId('');
    setSelectedTestIds([]);
    setFlowError('');
  };

  const toggleTest = (testId) => {
    setFlowError('');
    setSelectedTestIds((current) => current.includes(testId) ? current.filter((id) => id !== testId) : [...current, testId]);
  };

  const selectAllTests = () => {
    setFlowError('');
    setSelectedTestIds(activeLabItems.map((item) => item.id));
  };

  const clearAllTests = () => {
    setFlowError('');
    setSelectedTestIds([]);
  };

  const continueToAccept = () => {
    if (!activeOrder) {
      setFlowError('Select a patient request before continuing.');
      return;
    }
    if (!selectedTestIds.length) {
      setFlowError('Select at least one laboratory test before continuing.');
      return;
    }
    setFlowError('');
    setWorkspace('accept');
  };

  const acceptAndFinish = () => {
    if (!activeOrder) {
      setFlowError('Select a patient request before accepting.');
      return;
    }
    if (!selectedTestIds.length) {
      setFlowError('Select at least one laboratory test before accepting.');
      return;
    }
    if (acceptedSample) {
      dispatch({ type: 'OPEN_ACCEPTED_SAMPLE', orderId: activeOrder.id });
      return;
    }
    dispatch({
      type: 'ACCEPT_LAB_SAMPLE',
      orderId: activeOrder.id,
      payload: { labItemIds: selectedTestIds }
    });
  };

  return (
    <div className="getlabs-page space-y-6">
      <PageHeader
        eyebrow="Laboratory · Queue Workflow"
        title="Queue"
        description="Search patient requests, add the requested laboratory tests, then accept the sample in a clean step-by-step flow."
      />

      {workspace !== 'queue' && <LabQueueStepper currentStep={workspace === 'tests' ? 2 : 3} />}

      {workspace === 'queue' && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Requests" value={baseRows.length} icon={Search} tone="blue" />
          <MetricCard label="Awaiting Sample" value={awaitingSample} icon={CheckCircle2} tone="yellow" />
          <MetricCard label="Accepted" value={acceptedCount} icon={CheckCircle2} tone="green" />
          <MetricCard label="Urgent" value={urgent} icon={CheckCircle2} tone="red" />
        </div>
      )}

      {workspace === 'queue' && (
        <Card>
          <div className="space-y-4">
            <div className="grid gap-3 xl:grid-cols-[1fr_200px_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient name, patient ID, order ID, test name..." />
              </div>
              <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All order statuses</option>
                <option>Submitted</option>
                <option>Confirmed</option>
                <option>In Progress</option>
                <option>Pending Review</option>
                <option>Final / Released</option>
              </select>
              <select className={inputClass} value={sampleFilter} onChange={(event) => setSampleFilter(event.target.value)}>
                <option value="">All sample states</option>
                <option>Not Accepted</option>
                <option>Accepted</option>
                <option>Rejected</option>
                <option>Recollection Requested</option>
              </select>
            </div>

            <div className="space-y-3">
              {rows.length ? rows.map((row) => (
                <PatientRequestCard key={row.id} order={row} data={data} onAddTest={openAddTestsWindow} />
              )) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <p className="font-bold text-slate-900">No lab-routed patients match your search.</p>
                  <p className="mt-2 text-sm text-slate-500">Adjust the search term, order status, or sample state filter.</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {workspace === 'tests' && (
        <Card title="Add laboratory tests" subtitle="Review all laboratory tests requested for this patient and add the tests that should be accepted with the sample.">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <Button variant="secondary" onClick={goBackToQueue}><ArrowLeft className="h-4 w-4" /> Back to Search</Button>
              {activeOrder && <div className="flex flex-wrap items-center gap-2"><StatusBadge status={activeOrder.urgency} /><StatusBadge status={sampleStateForOrder(data, activeOrder.id)} /></div>}
            </div>

            {!activeOrder ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <p className="font-bold text-slate-900">No patient request selected.</p>
                <p className="mt-2 text-sm text-slate-500">Go back to search and choose a patient request.</p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 lg:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Patient</p>
                    <p className="mt-1 font-bold text-slate-900">{activeOrder.patient?.fullName}</p>
                    <p className="text-sm text-slate-500">{activeOrder.patient?.id} · {activeOrder.patient?.phone || 'No phone'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Order ID</p>
                    <p className="mt-1 font-bold text-slate-900">{activeOrder.id}</p>
                    <p className="text-sm text-slate-500">{formatDateTime(activeOrder.createdAt)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Clinician / Hospital</p>
                    <p className="mt-1 font-bold text-slate-900">{activeOrder.doctor?.name}</p>
                    <p className="text-sm text-slate-500">{activeOrder.hospital?.name}</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Requested lab tests</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{selectedTestIds.length} of {activeLabItems.length} test(s) added</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={selectAllTests}>Add All</Button>
                      <Button variant="secondary" onClick={clearAllTests}>Clear</Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {activeLabItems.map((item) => {
                      const checked = selectedTestIds.includes(item.id);
                      return (
                        <button
                          type="button"
                          key={item.id || item.name}
                          onClick={() => toggleTest(item.id)}
                          className={`flex min-h-[76px] items-start justify-between gap-3 rounded-2xl border p-4 text-left transition ${checked ? 'border-clinical-300 bg-clinical-50 shadow-sm' : 'border-slate-200 bg-slate-50 hover:border-clinical-200'}`}
                        >
                          <span className="flex min-w-0 gap-3">
                            <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${checked ? 'bg-clinical-600 text-white' : 'bg-white text-slate-500'}`}>
                              {checked ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-bold text-slate-900"><FlaskConical className="mr-2 inline h-4 w-4 text-clinical-600" />{item.name}</span>
                              <span className="mt-1 block text-sm font-semibold text-slate-500">{item.department || 'Laboratory'} {item.price ? `· ${item.price}` : ''}</span>
                            </span>
                          </span>
                          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${checked ? 'bg-clinical-600 text-white' : 'bg-white text-slate-500'}`}>{checked ? 'Added' : 'Add'}</span>
                        </button>
                      );
                    })}
                  </div>

                  {flowError && <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{flowError}</p>}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-600">After adding the tests, continue to sample acceptance.</p>
                  <Button onClick={continueToAccept}>Continue to Accept Sample <CheckCircle2 className="h-4 w-4" /></Button>
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {workspace === 'accept' && (
        <Card title="Accept sample" subtitle="Confirm the added laboratory tests, then click Accept & Done to move the patient to Accepted Samples.">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <Button variant="secondary" onClick={() => setWorkspace('tests')}><ArrowLeft className="h-4 w-4" /> Back to Add Tests</Button>
              {activeOrder && <div className="flex flex-wrap items-center gap-2"><StatusBadge status={activeOrder.urgency} /><StatusBadge status={sampleStateForOrder(data, activeOrder.id)} /></div>}
            </div>

            {!activeOrder ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <p className="font-bold text-slate-900">No patient request selected.</p>
                <p className="mt-2 text-sm text-slate-500">Go back to search and choose a patient request.</p>
              </div>
            ) : (
              <>
                <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Tests to accept</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedLabItems.map((item) => (
                        <span key={item.id || item.name} className="rounded-full border border-clinical-200 bg-clinical-50 px-3 py-1.5 text-xs font-bold text-clinical-800">{item.name}</span>
                      ))}
                    </div>
                    <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Clinical notes</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{activeOrder.clinicalNotes || 'No clinical notes provided.'}</p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    {acceptedSample ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="font-bold text-emerald-800">Sample already accepted: {acceptedSample.id}</p>
                        <p className="mt-1 text-sm text-emerald-700">Accepted by {acceptedSample.acceptedBy || acceptedSample.collectedBy} at {formatDateTime(acceptedSample.acceptedAt || acceptedSample.collectedAt)}</p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="font-bold text-slate-900">Ready to accept</p>
                        <p className="mt-1 text-sm text-slate-500">This will move the patient to Accepted Samples for laboratory result entry.</p>
                      </div>
                    )}

                    {flowError && <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{flowError}</p>}

                    <Button onClick={acceptAndFinish} className="mt-4 w-full justify-center">
                      <CheckCircle2 className="h-4 w-4" /> {acceptedSample ? 'Open Accepted Sample' : 'Accept & Done'}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
