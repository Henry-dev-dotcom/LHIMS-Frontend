import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FileText,
  FlaskConical,
  ListChecks,
  Loader2,
  Search,
  Send,
  UploadCloud,
  UserRound,
  X
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { MetricCard } from '../../components/ui/MetricCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime } from '../../utils/formatters';
import { describeOrderItems, getLabOrders } from '../../utils/orderViews';


function formatFileSize(size = 0) {
  const bytes = Number(size) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file || typeof FileReader === 'undefined') {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

function resultForOrder(data, orderId) {
  return (data.results || []).find((result) => result.orderId === orderId && result.department === 'Laboratory');
}

function labItemsForOrder(data, order, sample) {
  const orderedItems = order?.items || [];
  const orderItemIds = new Set([...(order?.itemIds || []), ...orderedItems.map((item) => item.id)].filter(Boolean));
  const acceptedItemIds = new Set((sample?.labItemIds || []).filter(Boolean));
  const hasAcceptedItemFilter = acceptedItemIds.size > 0;
  const isAcceptedItem = (item) => !hasAcceptedItemFilter || acceptedItemIds.has(item.id);

  const catalogItems = (data.catalog || []).filter((item) => orderItemIds.has(item.id) && item.department === 'Laboratory' && isAcceptedItem(item));
  const fallbackItems = orderedItems.filter((item) => (item.department === 'Laboratory' || !item.department) && isAcceptedItem(item));
  const merged = catalogItems.length ? catalogItems : fallbackItems;

  return merged.map((item) => ({
    ...item,
    ...(orderedItems.find((ordered) => ordered.id === item.id) || {})
  }));
}

function normalizeParameter(parameter, index) {
  return {
    id: parameter.id || parameter.key || parameter.name || `parameter-${index}`,
    name: parameter.name || parameter.label || parameter.parameter || `Parameter ${index + 1}`,
    unit: parameter.unit || parameter.units || '',
    referenceRange: parameter.referenceRange || parameter.range || parameter.normalRange || '',
    low: parameter.low ?? parameter.min ?? '',
    high: parameter.high ?? parameter.max ?? '',
    criticalLow: parameter.criticalLow ?? parameter.criticalMin ?? '',
    criticalHigh: parameter.criticalHigh ?? parameter.criticalMax ?? ''
  };
}

function parametersForItem(item) {
  const raw = item.parameters || item.resultParameters || item.referenceParameters || item.panel || [];
  if (Array.isArray(raw) && raw.length) return raw.map(normalizeParameter);
  return [normalizeParameter({ name: 'Result', unit: item.unit || '', referenceRange: item.referenceRange || item.normalRange || '' }, 0)];
}

function valueKey(testId, parameter) {
  return `${testId}::${parameter.id || parameter.name}`;
}

function getExistingValue(result, testId, parameter) {
  const existing = (result?.parameters || []).find((item) => item.testId === testId && (item.name === parameter.name || item.id === parameter.id));
  return existing?.value || '';
}

function isTestComplete(testId, item, values) {
  const parameters = parametersForItem(item);
  return parameters.length > 0 && parameters.every((parameter) => String(values[valueKey(testId, parameter)] || '').trim());
}

function matchesSample(row, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    row.sample?.id,
    row.order?.id,
    row.order?.patient?.fullName,
    row.order?.patient?.id,
    row.order?.patient?.phone,
    row.order?.doctor?.name,
    row.order?.hospital?.name,
    describeOrderItems(row.labItems || row.order?.items || []),
    row.order?.urgency,
    row.result?.status
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

function LabResultWorkflow({ currentStep }) {
  const steps = [
    { number: 1, label: 'Accepted patients' },
    { number: 2, label: 'Open tests' },
    { number: 3, label: 'Enter results' },
    { number: 4, label: 'Push to clinician' }
  ];

  return (
    <div className="getlabs-lab-card rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="grid gap-2 md:grid-cols-4">
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

function AcceptedPatientCard({ row, onOpen }) {
  const finalised = row.result?.status === 'Final / Released';
  const acceptedTime = row.sample?.acceptedAt || row.sample?.collectedAt || row.order?.createdAt;
  const resultStatus = row.result?.status || 'Awaiting Result';

  return (
    <article className="getlabs-lab-card rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-clinical-200 hover:bg-slate-50/70">
      <div className="grid gap-3 xl:grid-cols-[minmax(230px,1fr)_minmax(190px,0.62fr)_minmax(150px,0.45fr)_minmax(160px,0.48fr)_minmax(250px,0.8fr)]">
        <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-clinical-50 text-clinical-700">
              <UserRound className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-slate-900">{row.order?.patient?.fullName}</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-500">{row.order?.patient?.id} · {row.order?.patient?.phone || 'No phone'}</p>
            </div>
          </div>
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Order ID</p>
          <p className="mt-0.5 break-words text-sm font-bold text-slate-900">{row.order?.id}</p>
        </div>

        <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Time</p>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-900">{formatDateTime(acceptedTime)}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Accepted for result entry</p>
        </div>

        <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Priority</p>
          <div className="mt-3"><StatusBadge status={row.order?.urgency || 'Routine'} /></div>
        </div>

        <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Result</p>
          <div className="mt-3"><StatusBadge status={resultStatus} /></div>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Clinician / Hospital</p>
            <p className="mt-1 truncate font-bold text-slate-900">{row.order?.doctor?.name}</p>
            <p className="truncate text-sm text-slate-500">{row.order?.hospital?.name}</p>
          </div>
          <Button disabled={finalised} onClick={() => onOpen(row)} className="w-full justify-center whitespace-nowrap">
            <FileText className="h-4 w-4" /> {finalised ? 'Sent' : 'Enter Results'}
          </Button>
        </div>
      </div>
    </article>
  );
}

function TestResultModal({ test, values, files, onChange, onFileSelection, onRemoveFile, onClose, onSave }) {
  if (!test) return null;
  const parameters = parametersForItem(test);
  const testFiles = files.filter((file) => file.testId === test.id);
  const canSave = parameters.every((parameter) => String(values[valueKey(test.id, parameter)] || '').trim());

  return (
    <div className="getlabs-modal-overlay fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
      <div className="getlabs-modal-panel max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-2xl" role="dialog" aria-modal="true">
        <div className="getlabs-modal-header flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-clinical-700">Enter test result</p>
            <h3 className="mt-1 text-2xl font-bold text-slate-900">{test.name}</h3>
            <p className="mt-1 text-sm text-slate-500">Fill the result fields for this test only. When saved, this test will be marked as completed.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50" aria-label="Close result entry popup">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-170px)] overflow-y-auto p-5">
          <div className="space-y-3">
            {parameters.map((parameter) => (
              <label key={valueKey(test.id, parameter)} className="block rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{parameter.name}</span>
                <input
                  className={`${inputClass} mt-2 bg-white`}
                  value={values[valueKey(test.id, parameter)] || ''}
                  onChange={(event) => onChange(test.id, parameter, event.target.value)}
                  placeholder="Enter value"
                />
                <span className="mt-2 block text-xs font-semibold text-slate-500">
                  {parameter.unit ? `Unit: ${parameter.unit}` : 'No unit'}{parameter.referenceRange ? ` · Ref: ${parameter.referenceRange}` : ''}
                </span>
              </label>
            ))}
          </div>

          <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Add result document</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">Attach a PDF, Word document, spreadsheet, or image for this specific test.</p>
              </div>
              <label htmlFor={`test-file-upload-${test.id}`} className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800">
                <UploadCloud className="h-4 w-4" /> Add Document
              </label>
              <input
                id={`test-file-upload-${test.id}`}
                className="sr-only"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                onChange={(event) => onFileSelection(event, test)}
              />
            </div>

            {testFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                {testFiles.map((file) => (
                  <div key={file.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-clinical-600" />
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-800">{file.name || file.fileName}</p>
                        <p className="text-xs font-semibold text-slate-500">{formatFileSize(file.size || file.fileSize)} · Attached to {test.name}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => onRemoveFile(file.id)} className="self-start rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-500 hover:border-rose-200 hover:text-rose-600 sm:self-auto" aria-label="Remove attached document">Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="getlabs-modal-footer flex flex-col gap-3 border-t border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-500">All fields in this popup must be completed before the test is marked completed.</p>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="secondary" className="justify-center" onClick={onClose}>Cancel</Button>
            <Button disabled={!canSave} className="justify-center" onClick={() => onSave(test)}><CheckCircle2 className="h-4 w-4" /> Done with Test</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AcceptedSamplesPage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const labOrders = useMemo(() => getLabOrders(data), [data]);
  const [query, setQuery] = useState('');
  const [workspace, setWorkspace] = useState(state.ui.activeAcceptedSampleOrderId ? 'patient' : 'list');
  const [activeOrderId, setActiveOrderId] = useState(state.ui.activeAcceptedSampleOrderId || '');
  const [values, setValues] = useState({});
  const [completedTests, setCompletedTests] = useState({});
  const [activeTestId, setActiveTestId] = useState('');
  const [equipment, setEquipment] = useState('');
  const [technicianNotes, setTechnicianNotes] = useState('');
  const [reportText, setReportText] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [sentSummary, setSentSummary] = useState(null);
  // Snapshot of the toast present when a push starts, so we can tell when the
  // async command has finished (a brand-new toast object replaces it).
  const submitToastRef = useRef(null);

  const rows = useMemo(() => (data.sampleLogs || [])
    .filter((sample) => sample.status === 'Accepted')
    .map((sample) => {
      const order = labOrders.find((item) => item.id === sample.orderId);
      return { sample, order, result: resultForOrder(data, sample.orderId), catalog: data.catalog || [], labItems: order ? labItemsForOrder(data, order, sample) : [] };
    })
    .filter((row) => row.order)
    .sort((a, b) => new Date(b.sample.acceptedAt || b.sample.collectedAt || 0) - new Date(a.sample.acceptedAt || a.sample.collectedAt || 0)), [data, labOrders]);

  const pendingRows = rows.filter((row) => row.result?.status !== 'Final / Released');
  const filteredRows = pendingRows.filter((row) => matchesSample(row, query));
  const activeRow = rows.find((row) => row.order?.id === activeOrderId) || null;
  const activeItems = activeRow ? activeRow.labItems : [];
  const activeTest = activeItems.find((item) => item.id === activeTestId) || null;
  const existingResult = activeRow?.result;
  const completedCount = activeItems.filter((item) => completedTests[item.id]).length;
  const allComplete = activeItems.length > 0 && completedCount === activeItems.length;
  const urgentRows = pendingRows.filter((row) => row.order?.urgency === 'Urgent').length;

  const openPatientWorkspace = (row) => {
    const nextValues = {};
    const nextCompleted = {};
    const items = row.labItems || labItemsForOrder(data, row.order, row.sample);
    items.forEach((item) => {
      parametersForItem(item).forEach((parameter) => {
        nextValues[valueKey(item.id, parameter)] = getExistingValue(row.result, item.id, parameter);
      });
      nextCompleted[item.id] = isTestComplete(item.id, item, nextValues);
    });
    setActiveOrderId(row.order.id);
    setValues(nextValues);
    setCompletedTests(nextCompleted);
    setEquipment(row.result?.equipment || '');
    setTechnicianNotes(row.result?.internalNotes || '');
    setReportText(row.result?.reportText || '');
    setFiles(row.result?.files || []);
    setActiveTestId('');
    setSubmitting(false);
    setSentSummary(null);
    setWorkspace('patient');
  };

  const backToList = () => {
    setWorkspace('list');
    setActiveOrderId('');
    setActiveTestId('');
    setSubmitting(false);
    setSentSummary(null);
  };

  const openTestPopup = (test) => {
    setActiveTestId(test.id);
  };

  const closeTestPopup = () => {
    setActiveTestId('');
  };

  const updateValue = (testId, parameter, value) => {
    setValues((current) => ({ ...current, [valueKey(testId, parameter)]: value }));
    setCompletedTests((current) => ({ ...current, [testId]: false }));
  };

  const saveTestResult = (test) => {
    setCompletedTests((current) => ({ ...current, [test.id]: true }));
    setActiveTestId('');
  };

  const handleFileSelection = async (event, test) => {
    const rawFiles = Array.from(event.target.files || []);
    const selectedFiles = await Promise.all(rawFiles.map(async (file, index) => ({
      id: `LAB-UPLOAD-${Date.now()}-${index}`,
      name: file.name,
      fileName: file.name,
      type: file.type || 'application/octet-stream',
      fileType: file.type || 'application/octet-stream',
      size: file.size,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: state.auth?.userName || 'Lab Staff',
      source: 'Accepted Samples per-test result document upload',
      testId: test.id,
      testName: test.name,
      dataUrl: await readFileAsDataUrl(file)
    })));
    if (selectedFiles.length) {
      setFiles((current) => [...current, ...selectedFiles]);
    }
    event.target.value = '';
  };

  const removeFile = (fileId) => {
    setFiles((current) => current.filter((file) => file.id !== fileId));
  };

  const buildParameters = () => activeItems.flatMap((item) => parametersForItem(item).map((parameter) => ({
    testId: item.id,
    testName: item.name,
    id: parameter.id,
    name: parameter.name,
    value: values[valueKey(item.id, parameter)] || '',
    unit: parameter.unit,
    referenceRange: parameter.referenceRange,
    low: parameter.low,
    high: parameter.high,
    criticalLow: parameter.criticalLow,
    criticalHigh: parameter.criticalHigh
  })));

  const pushToClinician = () => {
    if (!activeRow || !allComplete || submitting || sentSummary) return;
    // Remember the current toast so the completion effect can detect the fresh
    // success/error toast the async command dispatches when it finishes.
    submitToastRef.current = state.ui.toast;
    setSubmitting(true);
    dispatch({
      type: 'PUSH_LAB_RESULT_TO_CLINICIAN',
      payload: {
        orderId: activeRow.order.id,
        parameters: buildParameters(),
        equipment,
        technicianNotes,
        reportText,
        files
      }
    });
  };

  // The push command runs asynchronously against the backend. On success the
  // result flips to 'Final / Released' and a success toast appears; on failure
  // an error toast appears. Resolve the in-flight state from those signals so
  // the technician gets an unambiguous "sent" confirmation and Done action.
  const resultStatus = activeRow?.result?.status;
  const toast = state.ui.toast;
  useEffect(() => {
    if (!submitting) return;
    const freshToast = toast && toast !== submitToastRef.current;
    if (freshToast && toast.type === 'error') {
      // Let the technician correct the problem and try again.
      setSubmitting(false);
      return;
    }
    if (resultStatus === 'Final / Released' || (freshToast && toast.type === 'success')) {
      setSubmitting(false);
      setSentSummary({
        patientName: activeRow?.order?.patient?.fullName || 'the patient',
        orderId: activeRow?.order?.id || activeOrderId,
        clinician: activeRow?.order?.doctor?.name || '',
        testCount: activeItems.length
      });
    }
  }, [submitting, toast, resultStatus, activeRow, activeItems.length, activeOrderId]);

  const currentStep = sentSummary ? 4 : (activeTest ? 3 : (allComplete ? 4 : 2));

  return (
    <div className="getlabs-page space-y-6">
      <PageHeader
        eyebrow="Laboratory · Result Entry"
        title="Accepted Samples"
        description="Search accepted patients, open the patient's tests, enter each result, then push completed results directly to the clinician."
      />

      {workspace === 'list' && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Accepted Patients" value={pendingRows.length} icon={CheckCircle2} tone="blue" />
          <MetricCard label="Awaiting Entry" value={pendingRows.length} icon={ClipboardList} tone="yellow" />
          <MetricCard label="Urgent" value={urgentRows} icon={ClipboardList} tone="red" />
          <MetricCard label="Sent Results" value={rows.length - pendingRows.length} icon={Send} tone="green" />
        </div>
      )}

      {workspace !== 'list' && <LabResultWorkflow currentStep={currentStep} />}

      {workspace === 'list' && (
        <Card>
          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient name, patient ID, order ID, sample ID, or test..." />
            </div>
            <div className="space-y-3">
              {filteredRows.length ? filteredRows.map((row) => (
                <AcceptedPatientCard key={row.sample.id} row={row} onOpen={openPatientWorkspace} />
              )) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <p className="font-bold text-slate-900">No accepted patients are waiting for result entry.</p>
                  <p className="mt-2 text-sm text-slate-500">Accepted samples appear here after they are completed in the Lab Queue.</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {workspace === 'patient' && (
        <Card>
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <Button variant="secondary" onClick={backToList}><ArrowLeft className="h-4 w-4" /> Back to Accepted Patients</Button>
              {!sentSummary && <p className="text-sm font-bold text-slate-700">{completedCount} of {activeItems.length} test(s) completed</p>}
            </div>

            {sentSummary ? (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-8 text-center">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-9 w-9" />
                </span>
                <p className="mt-4 text-xl font-bold text-slate-900">Results sent to clinician</p>
                <p className="mt-2 text-sm font-semibold text-slate-600">
                  {sentSummary.testCount} test result{sentSummary.testCount === 1 ? '' : 's'} for <span className="font-bold text-slate-900">{sentSummary.patientName}</span> ({sentSummary.orderId}) {sentSummary.testCount === 1 ? 'has' : 'have'} been sent to {sentSummary.clinician ? <span className="font-bold text-slate-900">{sentSummary.clinician}</span> : 'the clinician'}.
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">The signed report is now stored under Laboratory · Results and is available to reception for delivery.</p>
                <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
                  <Button className="justify-center" onClick={backToList}><CheckCircle2 className="h-4 w-4" /> Done</Button>
                </div>
              </div>
            ) : !activeRow ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <p className="font-bold text-slate-900">No accepted patient selected.</p>
                <p className="mt-2 text-sm text-slate-500">Go back and choose a patient before entering results.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 lg:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Patient</p><p className="mt-1 font-bold text-slate-900">{activeRow.order.patient?.fullName}</p><p className="text-sm text-slate-500">{activeRow.order.patient?.id} · {activeRow.order.patient?.phone}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Order / Sample</p><p className="mt-1 font-bold text-slate-900">{activeRow.order.id}</p><p className="text-sm text-slate-500">{activeRow.sample.id}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Clinician</p><p className="mt-1 font-bold text-slate-900">{activeRow.order.doctor?.name}</p><p className="text-sm text-slate-500">{activeRow.order.hospital?.name}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Accepted Time</p><p className="mt-1 font-bold text-slate-900">{formatDateTime(activeRow.sample.acceptedAt || activeRow.sample.collectedAt)}</p><div className="mt-2"><StatusBadge status={activeRow.order.urgency || 'Routine'} /></div></div>
                </div>

                <div className="getlabs-lab-card rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900"><ListChecks className="mr-2 inline h-5 w-5 text-clinical-600" />Patient laboratory tests</p>
                      <p className="mt-1 text-sm text-slate-500">Click a test to enter its results. Completed tests are marked automatically.</p>
                    </div>
                    <StatusBadge status={allComplete ? 'All Tests Completed' : 'Result Entry In Progress'} />
                  </div>

                  <div className="mt-4 space-y-3">
                    {activeItems.map((item) => {
                      const complete = completedTests[item.id];
                      const fieldCount = parametersForItem(item).length;
                      return (
                        <div key={item.id} className="getlabs-lab-card grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto] md:items-center">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold text-slate-900"><FlaskConical className="mr-2 inline h-4 w-4 text-clinical-600" />{item.name}</p>
                              <StatusBadge status={complete ? 'Completed' : 'Not Completed'} />
                            </div>
                            <p className="mt-1 text-sm text-slate-500">{fieldCount} result field{fieldCount === 1 ? '' : 's'} to complete.</p>
                          </div>
                          <div className="flex justify-end">
                            <Button onClick={() => openTestPopup(item)} className="whitespace-nowrap">
                              <FileText className="h-4 w-4" /> {complete ? 'Edit Result' : 'Enter Result'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                  <label className="block rounded-3xl border border-slate-200 p-4">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Equipment / Analyzer</span>
                    <input className={`${inputClass} mt-3`} value={equipment} onChange={(event) => setEquipment(event.target.value)} placeholder="e.g. Sysmex XN-1000" />
                  </label>
                  <label className="block rounded-3xl border border-slate-200 p-4">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Report summary for clinician</span>
                    <textarea className={`${inputClass} mt-3 min-h-[92px]`} value={reportText} onChange={(event) => setReportText(event.target.value)} placeholder="Add result interpretation, summary, or lab comments..." />
                  </label>
                </div>

                <label className="block rounded-3xl border border-slate-200 p-4">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Internal laboratory notes</span>
                  <textarea className={`${inputClass} mt-3 min-h-[90px]`} value={technicianNotes} onChange={(event) => setTechnicianNotes(event.target.value)} placeholder="Internal notes, analyzer remarks, quality-control comments..." />
                </label>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <p className="font-bold text-slate-900">{completedCount} of {activeItems.length} test(s) completed</p>
                    <p className="text-sm text-slate-500">
                      {submitting ? 'Sending the results to the clinician…' : 'Complete every test before pushing the result to the clinician.'}
                    </p>
                  </div>
                  <Button disabled={!allComplete || submitting} onClick={pushToClinician}>
                    {submitting
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                      : <><Send className="h-4 w-4" /> Push Results to Clinician</>}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <TestResultModal
        test={activeTest}
        values={values}
        files={files}
        onChange={updateValue}
        onFileSelection={handleFileSelection}
        onRemoveFile={removeFile}
        onClose={closeTestPopup}
        onSave={saveTestResult}
      />
    </div>
  );
}
