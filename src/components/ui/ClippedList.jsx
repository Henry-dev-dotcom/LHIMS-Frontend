/*
  A list of names that cannot take over its table column.

  An order can name one test or a dozen. Rendered in full, the longest list in the
  table decides the width of the column - so the columns beside it, urgency and
  status among them, get pushed off the edge and the table starts scrolling
  sideways, and no two screens agree on how wide the column is.

  So the column has one width. The first few names are shown, "..." says there
  are more, and the whole list stays one hover away (and in the accessible name)
  rather than being thrown out: clipping what somebody ordered is only acceptable
  while they can still get at all of it.
*/
export function ClippedList({ items = [], limit = 3, empty = '—' }) {
  const names = items.map((item) => (typeof item === 'string' ? item : item?.name)).filter(Boolean);
  if (names.length === 0) return <span className="text-slate-400">{empty}</span>;

  const shown = names.slice(0, limit);
  const more = names.length > limit;
  const full = names.join(', ');

  return (
    <span
      title={more ? full : undefined}
      aria-label={more ? `${names.length} items: ${full}` : undefined}
      // One fixed width, whatever is in it; two lines at most so a row cannot
      // grow tall either.
      className="line-clamp-2 block w-[22rem] max-w-full whitespace-normal break-words text-sm font-semibold leading-5 text-slate-700"
    >
      {shown.join(', ')}{more ? ', ...' : ''}
    </span>
  );
}
