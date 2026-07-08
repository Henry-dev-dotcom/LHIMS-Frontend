import { useMemo, useState } from 'react';
import { Activity, ArrowLeft, Download, Eye, Search } from 'lucide-react';
import { Card } from './Card';
import { DataTable } from './DataTable';
import { StatusBadge } from './StatusBadge';
import { Button } from './Button';
import { Modal } from './Modal';
import { inputClass } from './FormField';
import { formatDateTime } from '../../utils/formatters';
import { patientMatchesSearch } from '../../utils/patientUtils';

function calcAge(dateOfBirth) {
  if (!dateOfBirth) return '—';
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return '—';
  return Math.floor((Date.now() - dob.getTime()) / 31557600000);
}

function isFinalOrder(order) {
  return ['Final / Released', 'Completed'].includes(order?.status);
}

function isFinalResult(result) {
  return ['Final / Released', 'Completed'].includes(result?.status);
}

function getCatalogItem(data, itemId) {
  return (data.catalog || []).find((item) => item.id === itemId);
}

function getPatientOrders(data, patientId) {
  return (data.orders || [])
    .filter((order) => order.patientId === patientId && isFinalOrder(order))
    .sort((a, b) => new Date(a.updatedAt || a.createdAt) - new Date(b.updatedAt || b.createdAt));
}

function getPatientFinalResults(data, patientId) {
  const orderIds = new Set(getPatientOrders(data, patientId).map((order) => order.id));
  return (data.results || [])
    .filter((result) => orderIds.has(result.orderId) && isFinalResult(result))
    .sort((a, b) => new Date(a.approvedAt || a.updatedAt || a.createdAt) - new Date(b.approvedAt || b.updatedAt || b.createdAt));
}

function getCompletedTrendTests(data, patientId) {
  const orders = getPatientOrders(data, patientId);
  const resultOrderIds = new Set(getPatientFinalResults(data, patientId).map((result) => result.orderId));
  const map = new Map();

  orders.forEach((order) => {
    (order.itemIds || []).forEach((itemId) => {
      const item = getCatalogItem(data, itemId);
      if (!item || item.type !== 'Lab' || !(item.parameters || []).length) return;
      if (!resultOrderIds.has(order.id)) return;
      if (!map.has(item.id)) {
        map.set(item.id, {
          id: item.id,
          name: item.name,
          department: item.department || 'Laboratory',
          parameters: item.parameters || [],
          visitCount: 0,
          numericPointCount: 0
        });
      }
      map.get(item.id).visitCount += 1;
    });
  });

  getPatientFinalResults(data, patientId).forEach((result) => {
    (result.parameters || []).forEach((parameter) => {
      const item = parameter.testId ? getCatalogItem(data, parameter.testId) : null;
      if (!item || item.type !== 'Lab') return;
      if (!map.has(item.id)) {
        map.set(item.id, {
          id: item.id,
          name: item.name,
          department: item.department || 'Laboratory',
          parameters: item.parameters || [],
          visitCount: 0,
          numericPointCount: 0
        });
      }
      if (Number.isFinite(Number(parameter.value))) map.get(item.id).numericPointCount += 1;
    });
  });

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function parseRangeValue(row, key) {
  if (Number.isFinite(Number(row?.[key]))) return Number(row[key]);
  const range = String(row?.referenceRange || '');
  const values = range.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
  if (key === 'low') return values.length >= 2 ? values[0] : null;
  if (key === 'high') return values.length >= 2 ? values[1] : (values.length === 1 ? values[0] : null);
  return null;
}

function getTrendRows(data, patientId, testId, parameterName) {
  const orders = Object.fromEntries(getPatientOrders(data, patientId).map((order) => [order.id, order]));
  const catalogItem = getCatalogItem(data, testId);
  const catalogParam = (catalogItem?.parameters || []).find((parameter) => parameter.name === parameterName) || {};

  return (data.results || [])
    .filter((result) => orders[result.orderId] && isFinalResult(result))
    .flatMap((result) => {
      const order = orders[result.orderId];
      return (result.parameters || [])
        .filter((parameter) => parameter.testId === testId && parameter.name === parameterName)
        .map((parameter, index) => ({
          id: `${result.id}-${parameter.name}-${index}`,
          orderId: result.orderId,
          resultId: result.id,
          testId,
          testName: catalogItem?.name || parameter.testName || testId,
          parameter: parameter.name,
          value: parameter.value,
          unit: parameter.unit || catalogParam.unit || '',
          referenceRange: parameter.referenceRange || catalogParam.referenceRange || '',
          low: parameter.low ?? catalogParam.low ?? '',
          high: parameter.high ?? catalogParam.high ?? '',
          criticalLow: parameter.criticalLow ?? catalogParam.criticalLow ?? '',
          criticalHigh: parameter.criticalHigh ?? catalogParam.criticalHigh ?? '',
          flag: parameter.flag || 'Normal',
          department: result.department,
          approvedAt: result.approvedAt || result.updatedAt || result.createdAt || order.updatedAt || order.createdAt,
          createdAt: result.createdAt || order.createdAt,
          urgency: order.urgency || 'Routine'
        }));
    })
    .filter((row) => row.value !== '' && row.value !== null && row.value !== undefined)
    .sort((a, b) => new Date(a.approvedAt || a.createdAt) - new Date(b.approvedAt || b.createdAt));
}

function filterRowsByDate(rows, fromDate, toDate) {
  return rows.filter((row) => {
    const date = new Date(row.approvedAt || row.createdAt);
    if (fromDate && date < new Date(`${fromDate}T00:00:00`)) return false;
    if (toDate && date > new Date(`${toDate}T23:59:59`)) return false;
    return true;
  });
}

function getTrendSummary(rows) {
  const numericRows = rows
    .filter((row) => Number.isFinite(Number(row.value)))
    .sort((a, b) => new Date(a.approvedAt || a.createdAt) - new Date(b.approvedAt || b.createdAt));

  if (!numericRows.length) {
    return { numericRows, latest: null, first: null, change: null, unit: '', low: null, high: null };
  }

  const latest = numericRows[numericRows.length - 1];
  const first = numericRows[0];
  const change = Number(latest.value) - Number(first.value);
  const low = numericRows.map((row) => parseRangeValue(row, 'low')).find((value) => Number.isFinite(value));
  const high = numericRows.map((row) => parseRangeValue(row, 'high')).find((value) => Number.isFinite(value));

  return {
    numericRows,
    latest,
    first,
    change,
    unit: latest.unit || '',
    low,
    high
  };
}

function PatientProgressChart({ rows, parameterName, compact = false }) {
  const { numericRows, latest, first, change, unit, low, high } = getTrendSummary(rows);

  if (numericRows.length < 2) {
    return (
      <div className="flex min-h-[11rem] items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
        This parameter needs at least two finalized numeric results before a progress line can be generated.
      </div>
    );
  }

  const values = numericRows.map((row) => Number(row.value));
  const yValues = [...values, ...(Number.isFinite(low) ? [low] : []), ...(Number.isFinite(high) ? [high] : [])];
  const rawMin = Math.min(...yValues);
  const rawMax = Math.max(...yValues);
  const padding = Math.max((rawMax - rawMin) * 0.2, Math.abs(rawMax || 1) * 0.05, 1);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const span = max - min || 1;
  const left = 11;
  const right = 96;
  const top = 8;
  const bottom = 80;
  const width = right - left;
  const height = bottom - top;
  const yFor = (value) => bottom - ((value - min) / span) * height;
  const xFor = (index) => left + (index / Math.max(numericRows.length - 1, 1)) * width;
  const points = numericRows.map((row, index) => `${xFor(index)},${yFor(Number(row.value))}`).join(' ');

  return (
    <div className={`rounded-3xl border border-clinical-100 bg-gradient-to-br from-clinical-50 to-white ${compact ? 'p-4' : 'p-5'}`}>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-clinical-700">{parameterName || 'Patient progress line chart'}</p>
          <p className="mt-1 text-sm text-slate-500">Finalized values plotted in visit/release order.</p>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3 text-left shadow-sm md:text-right">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Change</p>
          <p className={`font-semibold ${change > 0 ? 'text-amber-700' : change < 0 ? 'text-clinical-700' : 'text-slate-900'}`}>{change > 0 ? '+' : ''}{change.toFixed(2)} {unit}</p>
        </div>
      </div>

      <svg viewBox="0 0 108 100" className={`${compact ? 'h-52 sm:h-56' : 'h-80'} w-full overflow-visible`} role="img" aria-label={`${parameterName || 'Patient test'} progress line chart`}>
        {[0, 1, 2, 3].map((tick) => {
          const y = top + (tick / 3) * height;
          const value = max - (tick / 3) * span;
          return (
            <g key={tick}>
              <line x1={left} x2={right} y1={y} y2={y} className="stroke-slate-200" strokeWidth="0.5" />
              <text x="2" y={y + 1.5} className="fill-slate-400 text-[3px] font-bold">{value.toFixed(1)}</text>
            </g>
          );
        })}
        {Number.isFinite(low) && (
          <g>
            <line x1={left} x2={right} y1={yFor(low)} y2={yFor(low)} className="stroke-emerald-500" strokeDasharray="2 2" strokeWidth="0.8" />
            <text x={right + 1} y={yFor(low) + 1.2} className="fill-emerald-700 text-[3px] font-semibold">Low</text>
          </g>
        )}
        {Number.isFinite(high) && (
          <g>
            <line x1={left} x2={right} y1={yFor(high)} y2={yFor(high)} className="stroke-rose-500" strokeDasharray="2 2" strokeWidth="0.8" />
            <text x={right + 1} y={yFor(high) + 1.2} className="fill-rose-700 text-[3px] font-semibold">High</text>
          </g>
        )}
        <polyline fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" points={points} className="text-clinical-600" />
        {numericRows.map((row, index) => {
          const value = Number(row.value);
          const x = xFor(index);
          const y = yFor(value);
          const abnormal = ['High', 'Low', 'Critical', 'Critical High', 'Critical Low'].includes(row.flag);
          return (
            <g key={row.id || `${row.orderId}-${index}`}>
              <circle cx={x} cy={y} r="2.5" className={abnormal ? 'fill-rose-600' : 'fill-clinical-700'} />
              <text x={x} y={y - 4} textAnchor="middle" className="fill-slate-700 text-[3.2px] font-semibold">{value}</text>
              <text x={x} y="94" textAnchor="middle" className="fill-slate-500 text-[2.8px] font-bold">{new Date(row.approvedAt || row.createdAt).toLocaleDateString('en-GB', { month: 'short', day: '2-digit' })}</text>
            </g>
          );
        })}
        <line x1={left} x2={right} y1={bottom} y2={bottom} className="stroke-slate-300" strokeWidth="0.8" />
        <line x1={left} x2={left} y1={top} y2={bottom} className="stroke-slate-300" strokeWidth="0.8" />
      </svg>

      <div className={`mt-4 grid gap-3 ${compact ? 'sm:grid-cols-3' : 'md:grid-cols-3'}`}>
        <div className="rounded-2xl bg-white p-3"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">First value</p><p className="mt-1 font-semibold text-slate-950">{first.value} {unit}</p><p className="text-xs text-slate-500">{formatDateTime(first.approvedAt || first.createdAt)}</p></div>
        <div className="rounded-2xl bg-white p-3"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Latest value</p><p className="mt-1 font-semibold text-slate-950">{latest.value} {unit}</p><p className="text-xs text-slate-500">{formatDateTime(latest.approvedAt || latest.createdAt)}</p></div>
        <div className="rounded-2xl bg-white p-3"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Reference range</p><p className="mt-1 font-semibold text-slate-950">{latest.referenceRange || '—'}</p><p className="text-xs text-slate-500">Dashed lines show low/high range when available.</p></div>
      </div>
    </div>
  );
}

function ParameterTrendCard({ chart, onView }) {
  const { latest } = getTrendSummary(chart.rows);
  return (
    <div className="flex min-w-0 flex-col rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="break-words font-semibold text-slate-950">{chart.parameter.name}</p>
          <p className="text-xs font-semibold text-slate-500">{chart.parameter.unit || 'No unit'} · Ref: {chart.parameter.referenceRange || '—'}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          {chart.rows.length} result{chart.rows.length === 1 ? '' : 's'}
        </div>
      </div>

      <div className="flex-1">
        <PatientProgressChart rows={chart.rows} parameterName={chart.parameter.name} compact />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="text-xs font-semibold text-slate-500">
          Latest: <span className="font-semibold text-slate-900">{latest ? `${latest.value} ${latest.unit || ''}` : 'No numeric value'}</span>
        </div>
        <Button variant="secondary" onClick={() => onView(chart)} aria-label={`Open large chart for ${chart.parameter.name}`}>
          <Eye className="h-4 w-4" /> View
        </Button>
      </div>
    </div>
  );
}

export function PatientTrendsPanel({ data, allowedPatientIds = null, title = 'Patient Trends', subtitle = 'Search a patient and select a repeated lab test to view all parameter charts at once.' }) {
  const [query, setQuery] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedTestId, setSelectedTestId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [focusedChart, setFocusedChart] = useState(null);

  const allowedSet = allowedPatientIds ? new Set(allowedPatientIds) : null;
  const patients = useMemo(() => (data.patients || []).filter((patient) => !allowedSet || allowedSet.has(patient.id)), [data.patients, allowedSet]);
  const matches = query.trim().length >= 2 ? patients.filter((patient) => patientMatchesSearch(patient, query)).slice(0, 8) : [];
  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId) || null;
  const completedTests = selectedPatient ? getCompletedTrendTests(data, selectedPatient.id) : [];
  const selectedTest = completedTests.find((test) => test.id === selectedTestId) || null;

  const parameterCharts = useMemo(() => {
    if (!selectedPatient || !selectedTest) return [];
    return (selectedTest.parameters || []).map((parameter) => ({
      parameter,
      rows: filterRowsByDate(getTrendRows(data, selectedPatient.id, selectedTest.id, parameter.name), fromDate, toDate)
    }));
  }, [data, selectedPatient, selectedTest, fromDate, toDate]);

  const allTrendRows = parameterCharts.flatMap((chart) => chart.rows);
  const focusedRows = focusedChart ? filterRowsByDate(getTrendRows(data, selectedPatient?.id, selectedTest?.id, focusedChart.parameter.name), fromDate, toDate) : [];
  const chartCount = parameterCharts.length;
  const trendReadyCount = parameterCharts.filter((chart) => getTrendSummary(chart.rows).numericRows.length >= 2).length;

  function selectPatient(patientId) {
    const patient = patients.find((item) => item.id === patientId);
    setSelectedPatientId(patientId);
    setSelectedTestId('');
    setFocusedChart(null);
    setFromDate('');
    setToDate('');
    if (patient) setQuery(patient.fullName || patient.id);
  }

  function resetPatientSearch() {
    setSelectedPatientId('');
    setSelectedTestId('');
    setFocusedChart(null);
    setFromDate('');
    setToDate('');
    setQuery('');
  }

  function backStep() {
    if (selectedTestId) {
      setSelectedTestId('');
      setFocusedChart(null);
      return;
    }
    resetPatientSearch();
  }

  function exportTrendCsv() {
    if (!allTrendRows.length) return;
    const headers = ['Date', 'Patient', 'Test', 'Parameter', 'Value', 'Unit', 'Reference Range', 'Flag', 'Order ID'];
    const lines = allTrendRows.map((row) => [
      formatDateTime(row.approvedAt || row.createdAt),
      selectedPatient?.fullName || '',
      row.testName || selectedTest?.name || '',
      row.parameter || '',
      row.value,
      row.unit || '',
      row.referenceRange || '',
      row.flag || '',
      row.orderId || ''
    ].map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','));
    const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedPatient?.id || 'patient'}-${selectedTest?.id || 'test'}-all-parameter-trends.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card title={title} subtitle={subtitle} actions={<Activity className="h-5 w-5 text-clinical-600" />}>
      <div className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-[0.8fr_1.4fr]">
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                className={`${inputClass} pl-9`}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedPatientId('');
                  setSelectedTestId('');
                  setFocusedChart(null);
                }}
                placeholder="Search patient name or ID..."
              />
            </div>
            {!selectedPatient && query.trim().length < 2 && (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Type at least 2 characters to search for a patient.</p>
            )}
            {!selectedPatient && query.trim().length >= 2 && (
              <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                {matches.map((patient) => (
                  <button key={patient.id} type="button" onClick={() => selectPatient(patient.id)} className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-clinical-50">
                    <span><span className="block font-semibold text-slate-950">{patient.fullName}</span><span className="text-xs text-slate-500">{patient.id} · {patient.phone || 'No phone'}</span></span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-clinical-700">Select</span>
                  </button>
                ))}
                {matches.length === 0 && <p className="p-4 text-sm font-semibold text-slate-500">No patients found.</p>}
              </div>
            )}

            {selectedPatient && (
              <div className="rounded-2xl border border-clinical-100 bg-clinical-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-clinical-700">Selected patient</p>
                <p className="mt-1 font-semibold text-slate-950">{selectedPatient.fullName}</p>
                <p className="text-sm text-slate-600">ID: {selectedPatient.id} · Age: {calcAge(selectedPatient.dateOfBirth)} · Gender: {selectedPatient.gender || '—'}</p>
                <button type="button" onClick={resetPatientSearch} className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-clinical-700">Change patient</button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Trend navigation</p>
                <p className="mt-1 font-semibold text-slate-950">
                  {!selectedPatient ? 'Search and select a patient' : !selectedTest ? 'Select a repeated lab test' : `${selectedTest.name} · ${chartCount} parameter chart${chartCount === 1 ? '' : 's'}`}
                </p>
                {selectedTest && <p className="mt-1 text-sm font-semibold text-slate-500">All parameters for this test are displayed together. Use View below any chart to open it in a large popup.</p>}
              </div>
              {(selectedPatient || selectedTest) && <Button variant="secondary" onClick={backStep}><ArrowLeft className="h-4 w-4" /> Back</Button>}
            </div>

            {selectedPatient && !selectedTest && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Select a completed lab test</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {completedTests.map((test) => (
                    <button key={test.id} onClick={() => { setSelectedTestId(test.id); setFocusedChart(null); }} className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-clinical-300 hover:bg-clinical-50">
                      <p className="font-semibold text-slate-950">{test.name}</p>
                      <p className="text-xs text-slate-500">{test.department} · {test.visitCount} completed visit(s) · {(test.parameters || []).length} parameter(s)</p>
                    </button>
                  ))}
                  {completedTests.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500 md:col-span-2">No completed lab tests with numerical/reference-range data found for this patient.</p>}
                </div>
              </div>
            )}

            {selectedPatient && selectedTest && (
              <div className="rounded-2xl border border-clinical-100 bg-clinical-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-clinical-700">Viewing all test parameters</p>
                    <p className="font-semibold text-slate-950">{selectedTest.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{trendReadyCount} of {chartCount} parameter chart{chartCount === 1 ? '' : 's'} have enough numeric history for a line trend.</p>
                  </div>
                  <Button variant="secondary" onClick={exportTrendCsv} disabled={!allTrendRows.length}><Download className="h-4 w-4" /> Export CSV</Button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">From date<input className={`${inputClass} mt-1`} type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">To date<input className={`${inputClass} mt-1`} type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedPatient && selectedTest && (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {parameterCharts.map((chart) => (
                <ParameterTrendCard key={chart.parameter.name} chart={chart} onView={setFocusedChart} />
              ))}
            </div>
            {parameterCharts.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">This test has no configured parameters to trend.</p>}
          </div>
        )}

        <DataTable
          columns={[
            { key: 'approvedAt', label: 'Date', render: (row) => formatDateTime(row.approvedAt || row.createdAt) },
            { key: 'testName', label: 'Test' },
            { key: 'parameter', label: 'Parameter' },
            { key: 'value', label: 'Value', render: (row) => <span className="font-semibold text-slate-950">{row.value} {row.unit}</span> },
            { key: 'referenceRange', label: 'Range' },
            { key: 'flag', label: 'Flag', render: (row) => <StatusBadge status={row.flag} /> }
          ]}
          rows={allTrendRows}
          emptyMessage="Select a patient and repeated lab test to view historical trend values for all parameters."
        />
      </div>

      <Modal
        open={Boolean(focusedChart)}
        title={focusedChart ? `${selectedTest?.name || 'Test'} · ${focusedChart.parameter.name}` : 'Patient trend chart'}
        description={focusedChart ? `Large view of ${focusedChart.parameter.name} progress for ${selectedPatient?.fullName || 'selected patient'}.` : ''}
        onClose={() => setFocusedChart(null)}
        footer={<Button variant="secondary" onClick={() => setFocusedChart(null)}>Close</Button>}
      >
        {focusedChart && (
          <div className="space-y-5">
            <PatientProgressChart rows={focusedRows} parameterName={focusedChart.parameter.name} />
            <DataTable
              columns={[
                { key: 'approvedAt', label: 'Date', render: (row) => formatDateTime(row.approvedAt || row.createdAt) },
                { key: 'value', label: 'Value', render: (row) => <span className="font-semibold text-slate-950">{row.value} {row.unit}</span> },
                { key: 'referenceRange', label: 'Range' },
                { key: 'flag', label: 'Flag', render: (row) => <StatusBadge status={row.flag} /> },
                { key: 'orderId', label: 'Order ID' }
              ]}
              rows={focusedRows}
              emptyMessage="No historical values found for this parameter in the selected date range."
            />
          </div>
        )}
      </Modal>
    </Card>
  );
}
