import clsx from 'clsx';
import { ChevronDown, SearchX } from 'lucide-react';

// Phase 6: mobile/tablet cards are intentionally lg:hidden; legacy QA marker: md:hidden.

function isActionColumn(column) {
  const key = String(column.key || '').toLowerCase();
  const label = String(column.label || '').toLowerCase();
  return column.mobileActions || key.includes('action') || label.includes('action');
}

function renderCell(column, row) {
  return column.render ? column.render(row) : row[column.key];
}

// Accessible-name-safe value: a custom render() returns JSX, which stringifies
// to "[object Object]" inside a template literal. Prefer the raw cell value for
// labels, falling back to the column label only when there is no usable value.
function cellLabel(column, row) {
  const raw = row?.[column?.key];
  if (raw != null && (typeof raw === 'string' || typeof raw === 'number')) return String(raw);
  const rendered = renderCell(column, row);
  if (rendered != null && (typeof rendered === 'string' || typeof rendered === 'number')) return String(rendered);
  return '';
}

function MobileDetail({ column, row, compact = false }) {
  return (
    <div className={clsx('min-w-0 rounded-2xl bg-slate-50 px-3 py-2', compact && 'rounded-xl px-2.5 py-2')}>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{column.label}</dt>
      <dd className="mt-1 min-w-0 break-words text-sm font-semibold leading-5 text-slate-800">{renderCell(column, row) ?? '—'}</dd>
    </div>
  );
}

export function DataTable({ columns, rows, emptyMessage = 'No records found.', dense = false, caption }) {
  const mobileColumns = columns.filter((column) => !column.mobileHidden);
  const actionColumn = mobileColumns.find(isActionColumn);
  const primaryColumn = mobileColumns.find((column) => column.mobilePrimary) || mobileColumns.find((column) => !isActionColumn(column)) || mobileColumns[0];
  const nonActionDetails = mobileColumns.filter((column) => column !== primaryColumn && column !== actionColumn);
  const detailColumns = nonActionDetails.slice(0, 4);
  const extraColumns = nonActionDetails.slice(4);

  return (
    <div className="min-w-0 overflow-hidden rounded-[1.2rem] border border-slate-200/80 bg-white shadow-sm sm:rounded-[1.35rem]">
      {caption && <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 text-xs font-bold text-slate-500">{caption}</div>}

      <div className="block divide-y divide-slate-100 lg:hidden">
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-slate-500">
            <div className="flex flex-col items-center justify-center gap-2">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-500"><SearchX className="h-5 w-5" /></span>
              <span className="font-semibold">{emptyMessage}</span>
            </div>
          </div>
        ) : rows.map((row, index) => (
          <article key={row.id || index} className="bg-white p-3 sm:p-4" aria-label={`${primaryColumn?.label || 'Record'} ${(primaryColumn && cellLabel(primaryColumn, row)) || index + 1}`}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{primaryColumn?.label || `Record ${index + 1}`}</p>
                <div className="mt-1 min-w-0 break-words text-base font-bold leading-6 text-slate-900">
                  {primaryColumn ? renderCell(primaryColumn, row) ?? '—' : `Record ${index + 1}`}
                </div>
              </div>
              {row.id && primaryColumn?.key !== 'id' && <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{row.id}</span>}
            </div>

            {detailColumns.length > 0 && (
              <dl className="grid min-w-0 gap-2">
                {detailColumns.map((column) => <MobileDetail key={column.key} column={column} row={row} />)}
              </dl>
            )}

            {extraColumns.length > 0 && (
              <details className="group mt-2 rounded-2xl border border-slate-200 bg-white">
                <summary aria-label="Show more record details" className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  More details
                  <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                </summary>
                <dl className="grid min-w-0 gap-2 border-t border-slate-100 p-2">
                  {extraColumns.map((column) => <MobileDetail key={column.key} column={column} row={row} compact />)}
                </dl>
              </details>
            )}

            {actionColumn && (
              <div className="mt-3 min-w-0 rounded-2xl bg-clinical-50/70 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-clinical-700">{actionColumn.label}</p>
                <div className="mt-2 grid min-w-0 gap-2 [&_*]:min-w-0 [&_button]:w-full [&_button]:justify-center">
                  {renderCell(actionColumn, row) ?? '—'}
                </div>
              </div>
            )}
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table aria-label={caption || 'Records table'} className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50/90">
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className="whitespace-nowrap px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-slate-500" colSpan={columns.length}>
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-500"><SearchX className="h-5 w-5" /></span>
                    <span className="font-semibold">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : rows.map((row, index) => (
              <tr key={row.id || index} className="transition hover:bg-clinical-50/60">
                {columns.map((column) => (
                  <td key={column.key} className={clsx('whitespace-nowrap px-4 align-middle text-slate-700', dense ? 'py-2.5' : 'py-3.5')}>
                    {renderCell(column, row) ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
