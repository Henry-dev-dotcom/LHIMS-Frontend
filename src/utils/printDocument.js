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

import { getStoredSession } from '../api/config';

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

/*
  Making a popup's Print button work under a strict Content-Security-Policy.

  A button written into the popup's HTML as onclick="window.print()", or a
  <script> that calls it, is inline script - and a policy of script-src 'self'
  exists precisely to refuse that. Under it the popup opened normally and its
  Print button did nothing. So the markup carries a data-print attribute instead
  and the page that opened the popup attaches the handler through the DOM, which
  the policy has no objection to. Behaviour is identical; the handler just does
  not travel inside the document.
*/
export function armPrintButtons(win) {
  win.document.querySelectorAll('[data-print]').forEach((element) => {
    element.addEventListener('click', () => win.print());
  });
}

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
    + '<div class="no-print"><button data-print>Print</button></div>'
    + `${body}</body></html>`
  );
  win.document.close();
  armPrintButtons(win);
  win.focus();
  return true;
}

/*
  Printing on a receipt (thermal) printer.

  The slip the laboratory attaches to a sample is printed on the same narrow roll
  the cashier's receipts use, so it is laid out as one centred column: no tables,
  no side-by-side blocks, monospaced digits, and a page as wide as the paper and
  as long as its content. The width is a choice - 58 mm and 80 mm rolls are both
  common - remembered per browser.
*/
const WIDTH_KEY = 'lhims.thermalWidthMm';
export const THERMAL_WIDTHS = [58, 80];

export function getThermalWidth() {
  try {
    const stored = Number(window.localStorage.getItem(WIDTH_KEY));
    return THERMAL_WIDTHS.includes(stored) ? stored : 80;
  } catch {
    return 80;
  }
}

export function setThermalWidth(mm) {
  try { window.localStorage.setItem(WIDTH_KEY, String(mm)); } catch { /* the choice then lasts for this print only */ }
}

const thermalStyles = (mm) => `
  * { box-sizing: border-box; }
  @page { size: ${mm}mm auto; margin: 0; }
  html, body { width: ${mm}mm; margin: 0; padding: 0; }
  body { padding: 3mm 3mm 6mm; color: #000; background: #fff;
         font-family: "Courier New", ui-monospace, Menlo, Consolas, monospace; font-size: ${mm === 58 ? 10 : 11.5}px; line-height: 1.35; }
  .c { text-align: center; }
  .b { font-weight: 700; }
  .big { font-size: 1.25em; }
  .row { display: flex; justify-content: space-between; gap: 6px; }
  .row > span:last-child { text-align: right; word-break: break-word; }
  .rule { border: 0; border-top: 1px dashed #000; margin: 5px 0; }
  .item { margin: 4px 0; }
  .wrap { word-break: break-word; overflow-wrap: anywhere; }
  .no-print { margin: 0 0 8px; padding: 6px 3mm; background: #f1f5f9; font-family: system-ui, sans-serif; width: auto; }
  .no-print button { padding: 8px 14px; border: 0; border-radius: 8px; background: #0284c7; color: #fff; font-weight: 700; cursor: pointer; }
  @media print { .no-print { display: none; } }
`;

/** Opens a receipt-printer document. `body` is already-escaped HTML. Returns false when the popup was blocked. */
export function printThermalDocument(title, body, widthMm = getThermalWidth()) {
  const mm = THERMAL_WIDTHS.includes(widthMm) ? widthMm : 80;
  const win = window.open('', '_blank', `width=${Math.round(mm * 4.2) + 60},height=800`);
  if (!win) return false;
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title>`
    + `<style>${thermalStyles(mm)}</style></head><body>`
    + '<div class="no-print"><button data-print>Print</button></div>'
    + `${body}</body></html>`
  );
  win.document.close();
  armPrintButtons(win);
  win.focus();
  return true;
}

/*
  The facility's own letterhead at the top of an issued result.

  An administrator can upload a wide letterhead banner, which is printed as
  supplied (it normally carries the name and address, so the plain-text name is
  dropped). Without one, the small logo and contact line are used above the
  name. Styles are inline so the block works in any document template. Images
  are data URLs the server has already validated; they are still escaped here.
*/
export function facilityLetterhead(facility) {
  let source = facility;
  if (!source) {
    try { source = getStoredSession()?.user?.facility; } catch { source = null; }
  }
  if (!source) return { html: '', hideName: false };
  const safeImage = (value) => (typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(value) ? escapeHtml(value) : '');
  const banner = safeImage(source.letterheadDataUrl);
  if (banner) {
    return {
      html: `<div style="margin:0 0 14px"><img src="${banner}" alt="${escapeHtml(source.name || 'Letterhead')}" style="display:block;width:100%;max-height:34mm;object-fit:contain"></div>`,
      hideName: true
    };
  }
  const logo = safeImage(source.logoDataUrl);
  const contact = [source.address, source.phone, source.email].filter(Boolean).map(escapeHtml).join(' &middot; ');
  if (!logo && !contact) return { html: '', hideName: false };
  return {
    html: `<div style="display:flex;align-items:center;gap:12px;margin:0 0 10px">${logo ? `<img src="${logo}" alt="" style="height:52px;width:52px;object-fit:contain">` : ''}<div style="font-size:12px;color:#475569;line-height:1.5">${contact}</div></div>`,
    hideName: false
  };
}
