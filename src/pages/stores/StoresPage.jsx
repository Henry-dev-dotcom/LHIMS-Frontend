import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, PackagePlus, Plus, RefreshCw, Trash2, Truck } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { listItems } from '../../api/normalizers';
import { formatDateTime } from '../../utils/formatters';
import { CATEGORIES, PO_STATUS, REQ_STATUS, storesService } from '../../services/storesService';
import { can } from '../opd/opdUtils';

export function Pill({ map, status }) {
  const [label, className] = map[status] || [status, 'bg-slate-100'];
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${className}`}>{label}</span>;
}

const TABS = [['items', 'Stock'], ['requisitions', 'Requisitions'], ['orders', 'Purchase orders'], ['suppliers', 'Suppliers']];
const money = (v) => Number(v ?? 0).toFixed(2);

/** The store office: stock on hand, ward requisitions, purchase orders and deliveries. */
export function StoresPage() {
  const { state, dispatch } = useAppStore();
  const auth = state.auth;
  const [tab, setTab] = useState('items');
  const [summary, setSummary] = useState(null);
  // Rows are kept with the tab they were loaded for, so a tab never renders another tab's rows.
  const [data, setData] = useState({ tab: null, rows: [] });
  const rows = data.tab === tab ? data.rows : [];
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (can(auth, 'stores:read')) setSummary(await storesService.summary(apiClient));
      const loaders = {
        items: () => storesService.items(apiClient),
        requisitions: () => storesService.requisitions(apiClient, { status: 'PENDING' }),
        orders: () => storesService.purchaseOrders(apiClient),
        suppliers: () => storesService.suppliers(apiClient)
      };
      setData({ tab, rows: listItems(await loaders[tab]()) });
    } catch (e) {
      toast('error', e?.message || 'Stores could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [tab, auth, toast]);

  useEffect(() => { load(); }, [load]);

  const done = (message) => { setModal(null); toast('success', message); load(); };
  const fail = (e) => toast('error', e?.message || 'That did not work.');

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Stores" title="Stores & procurement" description="Stock on hand, requisitions from wards and departments, and purchase orders from order to delivery." />
      {summary && (
        <div className="grid gap-3 sm:grid-cols-4">
          {[['Below reorder level', summary.lowStock, summary.lowStock ? 'text-red-700' : 'text-slate-900'], ['Requisitions waiting', summary.pendingRequisitions, 'text-slate-900'], ['Orders to approve', summary.awaitingApproval, 'text-slate-900'], ['Deliveries due', summary.awaitingDelivery, 'text-slate-900']].map(([label, value, cls]) => (
            <Card key={label}><p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${cls}`}>{value}</p></Card>
          ))}
        </div>
      )}
      <Card
        title={TABS.find(([k]) => k === tab)[1]}
        subtitle={loading ? 'Loading…' : `${rows.length} shown`}
        actions={(
          <>
            <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>
            {tab === 'items' && can(auth, 'stores:manage') && <Button onClick={() => setModal({ type: 'item' })}><Plus className="h-4 w-4" /> New item</Button>}
            {tab === 'orders' && can(auth, 'stores:order') && <Button onClick={() => setModal({ type: 'po' })}><Plus className="h-4 w-4" /> New order</Button>}
            {tab === 'suppliers' && can(auth, 'stores:manage') && <Button onClick={() => setModal({ type: 'supplier' })}><Plus className="h-4 w-4" /> New supplier</Button>}
          </>
        )}
      >
        <div role="tablist" aria-label="Stores" className="mb-4 flex flex-wrap gap-2">
          {TABS.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === key ? 'bg-clinical-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{label}</button>
          ))}
        </div>

        {tab === 'items' && (
          <DataTable caption="Store items" rowBadge={(r) => r.code} rows={rows} emptyMessage={loading ? 'Loading…' : 'No store items yet.'}
            columns={[
              { key: 'name', label: 'Item', mobilePrimary: true, render: (r) => <span><span className="font-semibold">{r.name}</span><span className="block text-xs text-slate-500">{r.code} · {CATEGORIES[r.category]}</span></span> },
              { key: 'stock', label: 'On hand', render: (r) => <span className={r.lowStock ? 'font-bold text-red-700' : 'font-semibold'}>{r.quantityOnHand} {r.unit}{r.lowStock ? ' · reorder' : ''}</span> },
              { key: 'reorder', label: 'Reorder at', render: (r) => r.reorderLevel },
              { key: 'cost', label: 'Last cost', render: (r) => (r.lastUnitCost ? money(r.lastUnitCost) : '—') },
              { key: 'actions', label: 'Actions', render: (r) => can(auth, 'stores:manage') && <Button size="sm" variant="secondary" onClick={() => setModal({ type: 'adjust', item: r })}>Adjust</Button> }
            ]} />
        )}

        {tab === 'requisitions' && (
          <DataTable caption="Pending requisitions" rowBadge={(r) => r.reqCode} rows={rows} emptyMessage={loading ? 'Loading…' : 'No requisitions waiting.'}
            columns={[
              { key: 'unit', label: 'From', mobilePrimary: true, render: (r) => <span><span className="font-semibold">{r.requestingUnit}</span><span className="block text-xs text-slate-500">{r.reqCode} · {r.requestedBy?.name}</span></span> },
              { key: 'items', label: 'Items', render: (r) => r.lines.map((l) => `${l.storeItem.name} × ${l.quantityRequested}`).join(', ') },
              { key: 'when', label: 'Asked', render: (r) => formatDateTime(r.createdAt) },
              { key: 'actions', label: 'Actions', render: (r) => can(auth, 'stores:issue') && <Button size="sm" onClick={() => setModal({ type: 'issue', requisition: r })}>Issue</Button> }
            ]} />
        )}

        {tab === 'orders' && (
          <DataTable caption="Purchase orders" rowBadge={(r) => r.poCode} rows={rows} emptyMessage={loading ? 'Loading…' : 'No purchase orders yet.'}
            columns={[
              { key: 'supplier', label: 'Supplier', mobilePrimary: true, render: (r) => <span><span className="font-semibold">{r.supplier.name}</span><span className="block text-xs text-slate-500">{r.poCode} · raised by {r.raisedBy?.name || '—'}</span></span> },
              { key: 'lines', label: 'Items', render: (r) => r.lines.map((l) => `${l.storeItem.name} ${l.quantityReceived}/${l.quantityOrdered}`).join(', ') },
              { key: 'total', label: 'Value', render: (r) => money(r.total) },
              { key: 'status', label: 'Status', render: (r) => <Pill map={PO_STATUS} status={r.status} /> },
              { key: 'actions', label: 'Actions', render: (r) => (
                <div className="flex flex-wrap gap-1">
                  {r.status === 'DRAFT' && can(auth, 'stores:approve') && (
                    <Button size="sm" onClick={() => storesService.approve(apiClient, r.id).then(() => done(`${r.poCode} approved.`)).catch(fail)}><CheckCircle2 className="h-3.5 w-3.5" /> Approve</Button>
                  )}
                  {['APPROVED', 'PARTIALLY_RECEIVED'].includes(r.status) && can(auth, 'stores:receive') && (
                    <Button size="sm" onClick={() => setModal({ type: 'receive', po: r })}><Truck className="h-3.5 w-3.5" /> Receive</Button>
                  )}
                  {['DRAFT', 'APPROVED'].includes(r.status) && (can(auth, 'stores:order') || can(auth, 'stores:approve')) && (
                    <Button size="sm" variant="ghost" onClick={() => { const reason = window.prompt('Why is this order being cancelled?'); if (reason && reason.trim().length >= 3) storesService.cancelPo(apiClient, r.id, reason.trim()).then(() => done(`${r.poCode} cancelled.`)).catch(fail); }}>Cancel</Button>
                  )}
                </div>
              ) }
            ]} />
        )}

        {tab === 'suppliers' && (
          <DataTable caption="Suppliers" rowBadge={(r) => r.code} rows={rows} emptyMessage={loading ? 'Loading…' : 'No suppliers yet.'}
            columns={[
              { key: 'name', label: 'Supplier', mobilePrimary: true, render: (r) => <span className="font-semibold">{r.name}</span> },
              { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
              { key: 'email', label: 'Email', render: (r) => r.email || '—' },
              { key: 'status', label: 'Status', render: (r) => (r.isActive ? 'Active' : 'Inactive') }
            ]} />
        )}
      </Card>

      <ItemModal open={modal?.type === 'item'} onClose={() => setModal(null)} onDone={done} fail={fail} />
      <SupplierModal open={modal?.type === 'supplier'} onClose={() => setModal(null)} onDone={done} fail={fail} />
      <AdjustModal item={modal?.type === 'adjust' ? modal.item : null} onClose={() => setModal(null)} onDone={done} fail={fail} />
      <PurchaseOrderModal open={modal?.type === 'po'} onClose={() => setModal(null)} onDone={done} fail={fail} />
      <ReceiveModal po={modal?.type === 'receive' ? modal.po : null} onClose={() => setModal(null)} onDone={done} fail={fail} />
      <IssueModal requisition={modal?.type === 'issue' ? modal.requisition : null} onClose={() => setModal(null)} onDone={done} fail={fail} />
    </div>
  );
}

/** Form state that resets to its starting values each time the modal opens. */
function useForm(initial, open) {
  const start = useRef(initial);
  const [form, setForm] = useState(initial);
  useEffect(() => { if (open) setForm(start.current); }, [open]);
  const set = (key) => (e) => setForm((c) => ({ ...c, [key]: e.target.value }));
  return [form, setForm, set];
}

function ItemModal({ open, onClose, onDone, fail }) {
  const [form, , set] = useForm({ code: '', name: '', unit: '', category: 'CONSUMABLE', reorderLevel: '0' }, open);
  if (!open) return null;
  const save = () => storesService.createItem(apiClient, { ...form, reorderLevel: Number(form.reorderLevel) }).then(() => onDone('Item added.')).catch(fail);
  return (
    <Modal open title="New store item" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={form.code.trim().length < 2 || form.name.trim().length < 2 || !form.unit.trim()} onClick={save}>Add item</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Code" required><input className={`${inputClass} uppercase`} value={form.code} onChange={set('code')} maxLength={30} /></FormField>
        <FormField label="Name" required><input className={inputClass} value={form.name} onChange={set('name')} maxLength={160} /></FormField>
        <FormField label="Unit" required><input className={inputClass} value={form.unit} onChange={set('unit')} maxLength={30} placeholder="box of 100" /></FormField>
        <FormField label="Category"><select className={inputClass} value={form.category} onChange={set('category')}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></FormField>
        <FormField label="Reorder at" help="Flag the item when stock falls to this level."><input type="number" min="0" className={inputClass} value={form.reorderLevel} onChange={set('reorderLevel')} /></FormField>
      </div>
    </Modal>
  );
}

function SupplierModal({ open, onClose, onDone, fail }) {
  const [form, , set] = useForm({ code: '', name: '', phone: '', email: '', address: '' }, open);
  if (!open) return null;
  const save = () => storesService.createSupplier(apiClient, { code: form.code, name: form.name, phone: form.phone || undefined, email: form.email || undefined, address: form.address || undefined }).then(() => onDone('Supplier added.')).catch(fail);
  return (
    <Modal open title="New supplier" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={form.code.trim().length < 2 || form.name.trim().length < 2} onClick={save}>Add supplier</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Code" required><input className={`${inputClass} uppercase`} value={form.code} onChange={set('code')} maxLength={30} /></FormField>
        <FormField label="Name" required><input className={inputClass} value={form.name} onChange={set('name')} maxLength={160} /></FormField>
        <FormField label="Phone"><input className={inputClass} value={form.phone} onChange={set('phone')} maxLength={40} /></FormField>
        <FormField label="Email"><input type="email" className={inputClass} value={form.email} onChange={set('email')} maxLength={160} /></FormField>
        <FormField label="Address" className="sm:col-span-2"><input className={inputClass} value={form.address} onChange={set('address')} maxLength={300} /></FormField>
      </div>
    </Modal>
  );
}

function AdjustModal({ item, onClose, onDone, fail }) {
  const [form, , set] = useForm({ quantity: '', reason: '' }, Boolean(item));
  if (!item) return null;
  const q = Number(form.quantity);
  const save = () => storesService.adjust(apiClient, item.id, { quantity: q, reason: form.reason.trim() }).then(() => onDone(`${item.name} adjusted.`)).catch(fail);
  return (
    <Modal open title={`Adjust ${item.name}`} description={`On hand: ${item.quantityOnHand} ${item.unit}. Use a minus sign to take stock off (count shortfall, damage, expiry).`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!Number.isInteger(q) || q === 0 || form.reason.trim().length < 3} onClick={save}>Save adjustment</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Change" required help={Number.isInteger(q) && q !== 0 ? `New balance ${item.quantityOnHand + q}` : undefined}><input type="number" step="1" className={inputClass} value={form.quantity} onChange={set('quantity')} placeholder="-3" /></FormField>
        <FormField label="Reason" required><input className={inputClass} value={form.reason} onChange={set('reason')} maxLength={300} placeholder="Stock count 29 Sept" /></FormField>
      </div>
    </Modal>
  );
}

function ItemLines({ lines, setLines, items, withCost }) {
  const update = (i, key, value) => setLines(lines.map((l, j) => (j === i ? { ...l, [key]: value } : l)));
  return (
    <div className="space-y-2">
      {lines.map((l, i) => (
        <div key={i} className={`grid items-end gap-2 ${withCost ? 'sm:grid-cols-[1fr_7rem_7rem_auto]' : 'sm:grid-cols-[1fr_7rem_auto]'}`}>
          <FormField label={i === 0 ? 'Item' : ''}><select className={inputClass} value={l.storeItemId} onChange={(e) => update(i, 'storeItemId', e.target.value)}><option value="">Choose…</option>{items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.unit})</option>)}</select></FormField>
          <FormField label={i === 0 ? 'Quantity' : ''}><input type="number" min="1" className={inputClass} value={l.quantity} onChange={(e) => update(i, 'quantity', e.target.value)} /></FormField>
          {withCost && <FormField label={i === 0 ? 'Unit cost' : ''}><input type="number" min="0" step="0.01" className={inputClass} value={l.unitCost} onChange={(e) => update(i, 'unitCost', e.target.value)} /></FormField>}
          <Button size="sm" variant="ghost" aria-label="Remove line" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={() => setLines([...lines, { storeItemId: '', quantity: '', unitCost: '' }])}><Plus className="h-3.5 w-3.5" /> Another item</Button>
    </div>
  );
}

const linesReady = (lines, withCost) => lines.every((l) => l.storeItemId && Number(l.quantity) >= 1 && (!withCost || l.unitCost !== '')) && new Set(lines.map((l) => l.storeItemId)).size === lines.length;

function PurchaseOrderModal({ open, onClose, onDone, fail }) {
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([{ storeItemId: '', quantity: '', unitCost: '' }]);
  useEffect(() => {
    if (!open) return;
    setNotes('');
    setLines([{ storeItemId: '', quantity: '', unitCost: '' }]);
    storesService.suppliers(apiClient).then((d) => { const s = listItems(d).filter((x) => x.isActive); setSuppliers(s); setSupplierId(s[0]?.id || ''); }).catch(() => setSuppliers([]));
    storesService.items(apiClient).then((d) => setItems(listItems(d))).catch(() => setItems([]));
  }, [open]);
  if (!open) return null;
  const total = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitCost || 0), 0);
  const save = () => storesService.createPurchaseOrder(apiClient, { supplierId, notes: notes.trim() || undefined, lines: lines.map((l) => ({ storeItemId: l.storeItemId, quantity: Number(l.quantity), unitCost: Number(l.unitCost) })) }).then(() => onDone('Order raised; it now needs approval.')).catch(fail);
  return (
    <Modal open title="New purchase order" description="Someone other than you must approve it before goods can be received." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!supplierId || !linesReady(lines, true)} onClick={save}><PackagePlus className="h-4 w-4" /> Raise order ({money(total)})</Button></>}>
      <div className="space-y-4">
        <FormField label="Supplier" required><select className={inputClass} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></FormField>
        <ItemLines lines={lines} setLines={setLines} items={items} withCost />
        <FormField label="Notes"><input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></FormField>
      </div>
    </Modal>
  );
}

function ReceiveModal({ po, onClose, onDone, fail }) {
  const [deliveryNote, setDeliveryNote] = useState('');
  const [qty, setQty] = useState({});
  const [batch, setBatch] = useState({});
  useEffect(() => {
    if (!po) return;
    setDeliveryNote('');
    setQty(Object.fromEntries(po.lines.map((l) => [l.id, String(l.quantityOrdered - l.quantityReceived)])));
    setBatch({});
  }, [po]);
  if (!po) return null;
  const lines = po.lines.filter((l) => Number(qty[l.id]) > 0).map((l) => ({ poLineId: l.id, quantity: Number(qty[l.id]), batchNumber: batch[l.id] || undefined }));
  const save = () => storesService.receive(apiClient, po.id, { deliveryNote: deliveryNote.trim() || undefined, lines }).then(() => onDone(`Delivery received against ${po.poCode}.`)).catch(fail);
  return (
    <Modal open title={`Receive delivery: ${po.poCode}`} description={po.supplier.name} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!lines.length} onClick={save}><Truck className="h-4 w-4" /> Receive</Button></>}>
      <div className="space-y-3">
        <FormField label="Supplier’s delivery note"><input className={inputClass} value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} maxLength={80} /></FormField>
        {po.lines.map((l) => {
          const due = l.quantityOrdered - l.quantityReceived;
          return (
            <div key={l.id} className="grid items-end gap-2 rounded-2xl border border-slate-200 p-3 sm:grid-cols-3">
              <p className="text-sm font-semibold text-slate-800">{l.storeItem.name}<span className="block text-xs font-normal text-slate-500">{l.quantityReceived} of {l.quantityOrdered} received · {due} due</span></p>
              <FormField label="Received now"><input type="number" min="0" max={due} className={inputClass} value={qty[l.id] ?? ''} disabled={due === 0} onChange={(e) => setQty((c) => ({ ...c, [l.id]: e.target.value }))} /></FormField>
              <FormField label="Batch"><input className={inputClass} value={batch[l.id] ?? ''} disabled={due === 0} onChange={(e) => setBatch((c) => ({ ...c, [l.id]: e.target.value }))} maxLength={60} /></FormField>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function IssueModal({ requisition, onClose, onDone, fail }) {
  const [qty, setQty] = useState({});
  useEffect(() => {
    if (requisition) setQty(Object.fromEntries(requisition.lines.map((l) => [l.id, String(Math.min(l.quantityRequested, l.storeItem.quantityOnHand))])));
  }, [requisition]);
  if (!requisition) return null;
  const issue = () => storesService.issue(apiClient, requisition.id, requisition.lines.map((l) => ({ lineId: l.id, quantity: Number(qty[l.id] || 0) }))).then(() => onDone(`${requisition.reqCode} issued to ${requisition.requestingUnit}.`)).catch(fail);
  const reject = () => { const reason = window.prompt('Why is this requisition being rejected?'); if (reason && reason.trim().length >= 3) storesService.reject(apiClient, requisition.id, reason.trim()).then(() => onDone(`${requisition.reqCode} rejected.`)).catch(fail); };
  return (
    <Modal open title={`Issue ${requisition.reqCode}`} description={`To ${requisition.requestingUnit}, asked by ${requisition.requestedBy?.name || '—'}. Items are issued once; anything not issued now is not owed later.`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={reject}>Reject</Button><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!requisition.lines.some((l) => Number(qty[l.id]) > 0)} onClick={issue}>Issue</Button></>}>
      <div className="space-y-2">
        {requisition.lines.map((l) => (
          <div key={l.id} className="grid items-end gap-2 rounded-2xl border border-slate-200 p-3 sm:grid-cols-2">
            <p className="text-sm font-semibold text-slate-800">{l.storeItem.name}<span className="block text-xs font-normal text-slate-500">asked {l.quantityRequested} · {l.storeItem.quantityOnHand} {l.storeItem.unit} in stock</span></p>
            <FormField label="Issue"><input type="number" min="0" max={Math.min(l.quantityRequested, l.storeItem.quantityOnHand)} className={inputClass} value={qty[l.id] ?? ''} onChange={(e) => setQty((c) => ({ ...c, [l.id]: e.target.value }))} /></FormField>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/** Any member of staff: ask the store for supplies and follow their requisitions. */
export function StoreRequestsPage() {
  const { dispatch } = useAppStore();
  const [rows, setRows] = useState([]);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState('');
  const [lines, setLines] = useState([{ storeItemId: '', quantity: '' }]);
  const [loading, setLoading] = useState(true);
  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(listItems(await storesService.requisitions(apiClient)));
    } catch (e) {
      toast('error', e?.message || 'Requisitions could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (open) {
      setLines([{ storeItemId: '', quantity: '' }]);
      storesService.items(apiClient).then((d) => setItems(listItems(d))).catch(() => setItems([]));
    }
  }, [open]);
  const send = () => storesService.createRequisition(apiClient, { requestingUnit: unit.trim(), lines: lines.map((l) => ({ storeItemId: l.storeItemId, quantity: Number(l.quantity) })) })
    .then(() => { setOpen(false); toast('success', 'Requisition sent to the store.'); load(); })
    .catch((e) => toast('error', e?.message || 'The requisition could not be sent.'));

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Stores" title="Request supplies" description="Ask the store for consumables, linen and other supplies for your ward or unit, and see what was issued." />
      <Card title="My requisitions" subtitle={loading ? 'Loading…' : `${rows.length}`} actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New requisition</Button>}>
        <DataTable caption="My requisitions" rowBadge={(r) => r.reqCode} rows={rows} emptyMessage={loading ? 'Loading…' : 'You have not asked the store for anything yet.'}
          columns={[
            { key: 'unit', label: 'For', mobilePrimary: true, render: (r) => <span className="font-semibold">{r.requestingUnit}</span> },
            { key: 'items', label: 'Items', render: (r) => r.lines.map((l) => `${l.storeItem.name}: ${r.status === 'PENDING' ? `asked ${l.quantityRequested}` : `${l.quantityIssued} of ${l.quantityRequested}`}`).join(', ') },
            { key: 'status', label: 'Status', render: (r) => <span><Pill map={REQ_STATUS} status={r.status} />{r.rejectReason && <span className="block text-xs text-red-700">{r.rejectReason}</span>}</span> },
            { key: 'when', label: 'Asked', render: (r) => formatDateTime(r.createdAt) }
          ]} />
      </Card>
      <Modal open={open} title="New requisition" onClose={() => setOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={unit.trim().length < 2 || !linesReady(lines, false)} onClick={send}>Send to store</Button></>}>
        <div className="space-y-4">
          <FormField label="Ward or unit" required><input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={120} placeholder="Female Medical Ward" /></FormField>
          <ItemLines lines={lines} setLines={setLines} items={items} />
        </div>
      </Modal>
    </div>
  );
}

