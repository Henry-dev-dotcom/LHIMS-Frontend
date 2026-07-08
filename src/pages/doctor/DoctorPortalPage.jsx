import { useState } from 'react';
import { Bell, Building2, CheckCircle2, Clock, Download, Edit3, FileText, LineChart, Send, UserRound } from 'lucide-react';
import { useAppStore } from '../../store/AppStore';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { FormField, inputClass } from '../../components/ui/FormField';
import { formatDateTime } from '../../utils/formatters';
import { openReportPrintWindow } from '../../utils/reporting';
import { getDoctorContextFromState, getReportForOrder, orderItemsText } from './doctorUtils';

function DashboardMetric({ label, value, Icon }) {
  return (
    <div className="flex min-h-[70px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-clinical-50 text-clinical-700">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none text-slate-900">{value}</p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, title, description, onClick, active = false }) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[82px] w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
        active
          ? 'border-clinical-200 bg-clinical-50 hover:border-clinical-300 hover:bg-white'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${active ? 'bg-white text-clinical-700' : 'bg-slate-50 text-slate-600'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="font-bold leading-tight text-slate-900">{title}</p>
        <p className="mt-1 text-sm leading-snug text-slate-500">{description}</p>
      </div>
    </button>
  );
}

function CompactClinicianProfile({ doctor, hospital, dispatch }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(doctor);

  return (
    <Card
      title="Clinician Profile"
      subtitle="Details used on requests and reports."
      actions={<Button variant="secondary" onClick={() => { setDraft(doctor); setEditing(true); }}><Edit3 className="h-4 w-4" /> Edit</Button>}
      compact
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl bg-clinical-50 p-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-clinical-700 shadow-sm">
            <UserRound className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-clinical-700">Clinician</p>
            <p className="mt-1 break-words font-bold leading-tight text-slate-900">{doctor?.name}</p>
            <p className="break-words text-sm text-slate-500">{doctor?.specialty}</p>
          </div>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Hospital</p>
            <p className="mt-1 break-words font-bold text-slate-900">{hospital?.name}</p>
            <div className="mt-2"><StatusBadge status={hospital?.accountStatus || 'Unknown'} /></div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Contact</p>
            <p className="mt-1 break-words font-bold text-slate-900">{doctor?.phone}</p>
            <p className="break-words text-sm text-slate-500">{doctor?.email}</p>
          </div>
        </div>
      </div>

      <Modal
        open={editing}
        title="Edit Clinician Profile"
        description="Update clinician profile data used by the clinician portal and report letterhead."
        onClose={() => setEditing(false)}
        footer={<><Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button><Button onClick={() => { dispatch({ type: 'UPDATE_DOCTOR_PROFILE', doctorId: doctor.id, payload: draft }); setEditing(false); }}>Save Profile</Button></>}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {['name','specialty','licenseNumber','email','phone'].map((field) => (
            <FormField key={field} label={field.replace(/([A-Z])/g, ' $1')}>
              <input className={inputClass} value={draft?.[field] || ''} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} />
            </FormField>
          ))}
        </div>
      </Modal>
    </Card>
  );
}

function CompactPreferences({ doctor, hospital, dispatch }) {
  const prefs = doctor?.notificationPreferences || { email: false, sms: false };
  return (
    <Card title="Alerts & Account" subtitle="Notification channels and linked hospital account." compact>
      <div className="space-y-3">
        {[['email','Email alerts'], ['sms','SMS alerts']].map(([key, label]) => (
          <button key={key} onClick={() => dispatch({ type: 'UPDATE_NOTIFICATION_PREFS', doctorId: doctor.id, payload: { [key]: !prefs[key] } })} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3 text-left transition hover:bg-slate-50">
            <div className="min-w-0">
              <p className="font-bold text-slate-900">{label}</p>
              <p className="text-xs text-slate-500">Result-release notification</p>
            </div>
            <StatusBadge status={prefs[key] ? 'Active' : 'Inactive'} />
          </button>
        ))}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="flex items-start gap-2">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <div className="min-w-0">
              <p className="break-words font-bold text-slate-900">{hospital?.name}</p>
              <p className="break-words text-slate-500">Billing: {hospital?.billingContact}</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ActiveOrderCard({ order }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-slate-900">{order.id}</p>
          <p className="break-words text-sm font-bold text-slate-700">{order.patient?.fullName || 'Unknown patient'}</p>
          <p className="text-xs text-slate-500">{order.patient?.id || '—'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={order.urgency || 'Routine'} />
          <StatusBadge status={order.status} />
        </div>
      </div>
      <p className="mt-3 break-words text-sm leading-relaxed text-slate-600">{orderItemsText(order)}</p>
      <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Expected: {formatDateTime(order.expectedCompletionAt)}</p>
    </div>
  );
}

function CompletedOrderCard({ order, data, dispatch }) {
  const report = getReportForOrder(data, order.id);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-slate-900">{order.id}</p>
          <p className="break-words text-sm font-bold text-slate-700">{order.patient?.fullName || 'Unknown patient'}</p>
          <p className="mt-1 break-words text-sm text-slate-500">{orderItemsText(order)}</p>
        </div>
        <Button onClick={() => { if (report) dispatch({ type: 'MARK_REPORT_DOWNLOADED', reportId: report.id }); openReportPrintWindow({ ...order, resultReport: report }); }}>
          <Download className="h-4 w-4" /> PDF
        </Button>
      </div>
      <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Released: {formatDateTime(order.updatedAt)}</p>
    </div>
  );
}

export function DoctorPortalPage() {
  const { state, dispatch } = useAppStore();
  const { data, doctor, hospital, activeOrders, completedOrders, doctorPatients } = getDoctorContextFromState(state);
  const recentActive = activeOrders.slice(0, 3);
  const recentCompleted = completedOrders.slice(0, 3);
  const unreadAlerts = data.notifications.filter((notification) => notification.audience === 'doctor' && !notification.read).length;

  const metricCards = [
    ['Active', activeOrders.length, Clock],
    ['Completed', completedOrders.length, CheckCircle2],
    ['Patients', doctorPatients.length, UserRound],
    ['Alerts', unreadAlerts, Bell]
  ];

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        eyebrow="Clinician Portal"
        title="Clinician Dashboard"
        description="Focused overview of orders, results, alerts, and quick actions."
        actions={<Button onClick={() => dispatch({ type: 'NAVIGATE', pageId: 'doctor-new-order' })}><Send className="h-4 w-4" /> New Order</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map(([label, value, Icon]) => (
          <DashboardMetric key={label} label={label} value={value} Icon={Icon} />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5 min-w-0">
          <Card title="Quick Actions" subtitle="Common clinician tasks are grouped here to reduce page clutter." compact>
            <div className="grid gap-3 md:grid-cols-2">
              <QuickAction active icon={Send} title="Create New Order" description="Request tests or scans for a patient." onClick={() => dispatch({ type: 'NAVIGATE', pageId: 'doctor-new-order' })} />
              <QuickAction icon={Clock} title="Active Orders" description="Follow pending and in-progress work." onClick={() => dispatch({ type: 'NAVIGATE', pageId: 'doctor-active-orders' })} />
              <QuickAction icon={FileText} title="Completed Results" description="Open finalized reports and PDFs." onClick={() => dispatch({ type: 'NAVIGATE', pageId: 'doctor-completed-orders' })} />
              <QuickAction icon={LineChart} title="Patient Trends" description="Review repeated investigations over time." onClick={() => dispatch({ type: 'NAVIGATE', pageId: 'doctor-patient-trends' })} />
            </div>
          </Card>

          <Card title="Recent Active Orders" subtitle="Compact preview of current work. Use Active Orders for the full list." actions={<Button variant="secondary" onClick={() => dispatch({ type: 'NAVIGATE', pageId: 'doctor-active-orders' })}>View All</Button>} compact>
            <div className="grid gap-3">
              {recentActive.length ? recentActive.map((order) => <ActiveOrderCard key={order.id} order={order} />) : <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No active orders.</p>}
            </div>
          </Card>

          <Card title="Recently Completed" subtitle="Latest released results from the diagnostic department." actions={<Button variant="secondary" onClick={() => dispatch({ type: 'NAVIGATE', pageId: 'doctor-completed-orders' })}>View Completed</Button>} compact>
            <div className="grid gap-3">
              {recentCompleted.length ? recentCompleted.map((order) => <CompletedOrderCard key={order.id} order={order} data={data} dispatch={dispatch} />) : <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No completed results released yet.</p>}
            </div>
          </Card>
        </div>

        <aside className="space-y-5 min-w-0">
          <CompactClinicianProfile doctor={doctor} hospital={hospital} dispatch={dispatch} />
          <CompactPreferences doctor={doctor} hospital={hospital} dispatch={dispatch} />
        </aside>
      </div>
    </div>
  );
}
