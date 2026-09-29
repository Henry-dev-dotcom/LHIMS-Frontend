export function Pill({ map, value }) {
  const [label, tone] = map[value] || [value, 'bg-slate-100 text-slate-700'];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${tone}`}>{label}</span>;
}
