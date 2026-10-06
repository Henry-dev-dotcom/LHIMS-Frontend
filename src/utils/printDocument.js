/*
  Printing a clinical document.

  Printouts carry patient names, test names and free-text comments typed by
  staff, so every value is escaped on the way in. A name containing an angle
  bracket is rare; a comment containing one is not, and a printout that silently
  swallows half a comment is worse than an ugly one.

  The document opens in its own window so the workspace keeps its own layout and
  the browser's print dialog has something clean to work with. If the browser
  blocks the popup there is nothing to print to, so the caller is told.
*/

/** Escapes a value for use in HTML text or an attribute. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const STYLES = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 28px; color: #0f172a; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px;
           border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
  h1 { font-size: 18px; margin: 0; }
  .sub { font-size: 13px; color: #475569; margin-top: 2px; }
  .meta { text-align: right; font-size: 12px; color: #475569; line-height: 1.5; }
  dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 24px; margin: 0 0 18px; }
  dl > div { font-size: 13px; }
  dt { display: inline; font-weight: 700; }
  dd { display: inline; margin: 0 0 0 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { padding: 8px 10px; border-bottom: 1px solid #cbd5e1; text-align: left;
           font-size: 13px; vertical-align: top; }
  th { background: #f1f5f9; text-transform: uppercase; font-size: 11px;
       letter-spacing: .04em; color: #475569; }
  .sign { width: 150px; }
  pre { white-space: pre-wrap; font: inherit; margin: 0; }
  footer { margin-top: 22px; font-size: 11px; color: #64748b; }
  @media print { .no-print { display: none; } body { margin: 12mm; } }
  .no-print { margin-bottom: 18px; }
  button { padding: 9px 16px; border: 0; border-radius: 9px; background: #0284c7;
           color: #fff; font-weight: 700; cursor: pointer; }
`;

/**
 * Opens a printable document. `title` names the window, `body` is already-escaped
 * HTML. Returns false when the browser refused the popup.
 */
export function printDocument(title, body) {
  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) return false;
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>`
    + `<style>${STYLES}</style></head><body>`
    + '<div class="no-print"><button onclick="window.print()">Print</button></div>'
    + `${body}</body></html>`
  );
  win.document.close();
  win.focus();
  return true;
}
