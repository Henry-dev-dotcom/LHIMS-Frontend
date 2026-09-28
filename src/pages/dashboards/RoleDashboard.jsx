import {
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FlaskConical,
  ScanLine,
  ShieldCheck,
  UserRound,
  UsersRound
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { MetricCard } from '../../components/ui/MetricCard';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { WorkflowTimeline } from '../../components/ui/WorkflowTimeline';
import { ALL_ROLES } from '../../data/roles';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime, getById, money } from '../../utils/formatters';
import { getNavForRole } from '../../utils/permissions';

const roleHeaders = {
  doctor: {
    eyebrow: 'Doctor Portal',
    title: 'Hospital-side doctor workspace',
    description: 'Places patient orders, follows active work, receives released results, and manages result notification preferences.'
  },
  receptionist: {
    eyebrow: 'Reception Desk',
    title: 'Incoming order and check-in command center',
    description: 'Confirms doctor orders, handles walk-ins, manages patient check-in, and routes work to billing, lab and scan units.'
  },
  lab: {
    eyebrow: 'Laboratory Unit',
    title: 'Lab processing dashboard',
    description: 'Tracks routed lab orders, sample collection, structured result entry, abnormal flags and review handoff.'
  },
  scan: {
    eyebrow: 'Scan / Imaging Unit',
    title: 'Imaging processing dashboard',
    description: 'Manages scan queues, room/equipment booking, uploads, reports and radiologist sign-off.'
  },
  billing: {
    eyebrow: 'Billing / Finance',
    title: 'Finance control dashboard',
    description: 'Generates invoices, tracks payment status, follows outstanding balances and prepares financial reports.'
  },
  admin: {
    eyebrow: 'Administration',
    title: 'System oversight dashboard',
    description: 'Manages users, hospitals, catalog configuration, department settings, audit logs and system reports.'
  }
};

/* Each role gets ONE primary queue plus two or three quick actions.
   Everything else lives behind the collapsed details section. */
const roleQueueMeta = {
  doctor: { title: 'Your active orders', subtitle: 'Latest orders you placed, newest first.' },
  receptionist: { title: 'Orders waiting on reception', subtitle: 'Submitted and confirmed orders that need check-in or routing.' },
  lab: { title: 'Lab work queue', subtitle: 'Orders routed to the laboratory.' },
  scan: { title: 'Imaging work queue', subtitle: 'Orders routed to scan / imaging.' },
  billing: { title: 'Recent invoices', subtitle: 'Latest invoice activity and payment status.' },
  admin: { title: 'Recent audit events', subtitle: 'Latest system activity across all roles.' }
};

const roleQuickActions = {
  doctor: [
    ['doctor-new-order', 'New Order', ClipboardList],
    ['doctor-results', 'Results', ShieldCheck]
  ],
  receptionist: [
    ['incoming-orders', 'Incoming Orders', ClipboardList],
    ['patient-checkin', 'Check-In', UsersRound],
    ['reception-walkins', 'Walk-Ins', CalendarDays]
  ],
  lab: [
    ['lab-queue', 'Open Queue', FlaskConical],
    ['lab-review', 'Review & Sign-off', ShieldCheck]
  ],
  scan: [
    ['scan-queue', 'Open Queue', ScanLine],
    ['scan-review', 'Review Reports', ShieldCheck]
  ],
  billing: [
    ['invoices', 'Invoices', CreditCard],
    ['billing-analytics', 'Analytics', ClipboardCheck]
  ],
  admin: [
    ['users', 'User Management', UserRound],
    ['audit-log', 'Audit Log', ShieldCheck]
  ]
};

function itemType(order, catalog, type) {
  return order.itemIds.some((id) => getById(catalog, id)?.type === type);
}

function getDoctorOrders(data, auth) {
  if (!auth?.linkedDoctorId) return data.orders;
  return data.orders.filter((order) => order.doctorId === auth.linkedDoctorId);
}

function getRoleRows(role, data, auth) {
  const { orders, catalog, invoices, auditLogs } = data;
  if (role === 'doctor') return getDoctorOrders(data, auth).slice(0, 6);
  if (role === 'receptionist') return orders.filter((order) => ['Submitted', 'Confirmed'].includes(order.status)).slice(0, 6);
  if (role === 'lab') return orders.filter((order) => itemType(order, catalog, 'Lab')).slice(0, 6);
  if (role === 'scan') return orders.filter((order) => itemType(order, catalog, 'Scan')).slice(0, 6);
  if (role === 'billing') return invoices.slice(0, 6);
  if (role === 'admin') return auditLogs.slice(0, 6);
  return orders.slice(0, 6);
}

function getMetrics(role, data, auth) {
  const { orders, patients, catalog, invoices, hospitals, auditLogs, results, users, notifications } = data;
  const doctorOrders = getDoctorOrders(data, auth);
  const labOrders = orders.filter((order) => itemType(order, catalog, 'Lab'));
  const scanOrders = orders.filter((order) => itemType(order, catalog, 'Scan'));
  const outstanding = invoices.filter((invoice) => invoice.status !== 'Paid').reduce((sum, invoice) => sum + invoice.amount, 0);
  const paid = invoices.filter((invoice) => invoice.status === 'Paid').reduce((sum, invoice) => sum + invoice.amount, 0);

  const map = {
    doctor: [
      ['Active Orders', doctorOrders.filter((order) => order.status !== 'Final / Released' && order.status !== 'Cancelled').length, ClipboardList, 'blue'],
      ['Completed Results', doctorOrders.filter((order) => order.status === 'Final / Released').length, ClipboardCheck, 'green'],
      ['Referred Patients', new Set(doctorOrders.map((order) => order.patientId)).size, UsersRound, 'purple'],
      ['Alerts', notifications.filter((note) => note.audience === 'doctor' && !note.read).length, Bell, 'yellow']
    ],
    receptionist: [
      ['Submitted Orders', orders.filter((order) => order.status === 'Submitted').length, ClipboardList, 'yellow'],
      ['Confirmed Today', orders.filter((order) => order.status === 'Confirmed').length, ClipboardCheck, 'green'],
      ['Patient Records', patients.length, UsersRound, 'blue'],
      ['Urgent Queue', orders.filter((order) => order.urgency === 'Urgent').length, Bell, 'red']
    ],
    lab: [
      ['Lab Routed', labOrders.length, FlaskConical, 'green'],
      ['In Progress', labOrders.filter((order) => order.status === 'In Progress').length, ClipboardList, 'blue'],
      ['Pending Review', results.filter((result) => result.department === 'Laboratory' && result.status === 'Pending Review').length, ShieldCheck, 'yellow'],
      ['Released', results.filter((result) => result.department === 'Laboratory' && result.status === 'Final / Released').length, ClipboardCheck, 'green']
    ],
    scan: [
      ['Scan Routed', scanOrders.length, ScanLine, 'purple'],
      ['In Progress', scanOrders.filter((order) => order.status === 'In Progress').length, ClipboardList, 'blue'],
      ['Pending Reports', results.filter((result) => result.department === 'Imaging' && result.status === 'Pending Review').length, ShieldCheck, 'yellow'],
      ['Released', results.filter((result) => result.department === 'Imaging' && result.status === 'Final / Released').length, ClipboardCheck, 'green']
    ],
    billing: [
      ['Invoices', invoices.length, CreditCard, 'blue'],
      ['Outstanding', money(outstanding), CreditCard, 'red'],
      ['Collected', money(paid), CreditCard, 'green'],
      ['Insurance Pending', invoices.filter((invoice) => invoice.status === 'Insurance Pending').length, ShieldCheck, 'yellow']
    ],
    admin: [
      ['Users', users.length, UserRound, 'blue'],
      ['Hospitals', hospitals.length, Building2, 'purple'],
      ['Orders', orders.length, ClipboardList, 'green'],
      ['Audit Events', auditLogs.length, ShieldCheck, 'yellow']
    ]
  };
  return map[role] || map.admin;
}

function getTableConfig(role, data) {
  if (role === 'billing') {
    return {
      columns: [
        { key: 'id', label: 'Invoice' },
        { key: 'orderId', label: 'Order' },
        { key: 'amount', label: 'Amount', render: (row) => money(row.amount) },
        { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
        { key: 'updatedAt', label: 'Updated', render: (row) => formatDateTime(row.updatedAt) }
      ]
    };
  }
  if (role === 'admin') {
    return {
      columns: [
        { key: 'id', label: 'Audit ID' },
        { key: 'actor', label: 'Actor' },
        { key: 'role', label: 'Role', render: (row) => <StatusBadge status={row.role} /> },
        { key: 'action', label: 'Action' },
        { key: 'timestamp', label: 'Time', render: (row) => formatDateTime(row.timestamp) }
      ]
    };
  }
  return {
    columns: [
      { key: 'id', label: 'Order ID' },
      { key: 'patient', label: 'Patient', render: (row) => getById(data.patients, row.patientId)?.fullName || '—' },
      { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
      { key: 'urgency', label: 'Urgency', render: (row) => <StatusBadge status={row.urgency} /> },
      { key: 'expectedCompletionAt', label: 'Expected', render: (row) => formatDateTime(row.expectedCompletionAt) }
    ]
  };
}

function getIdentityCard(role, data, auth) {
  if (role === 'doctor') {
    const doctor = data.doctors.find((item) => item.id === auth?.linkedDoctorId) || data.doctors[0];
    const hospital = data.hospitals.find((item) => item.id === doctor?.hospitalId);
    return [
      ['Doctor', doctor?.name],
      ['Specialty', doctor?.specialty],
      ['Hospital', hospital?.name],
      ['License', doctor?.licenseNumber],
      ['Email/SMS', `${doctor?.notificationPreferences?.email ? 'Email on' : 'Email off'} / ${doctor?.notificationPreferences?.sms ? 'SMS on' : 'SMS off'}`]
    ];
  }
  const roleInfo = ALL_ROLES.find((item) => item.id === role);
  return [
    ['Signed in as', auth?.userName || '—'],
    ['Role', roleInfo?.label],
    ['Landing page', roleInfo?.landing],
    ['Allowed pages', getNavForRole(role, auth?.modules).length],
    ['Session started', formatDateTime(auth?.loginAt)]
  ];
}

export function RoleDashboard({ role }) {
  const { state, dispatch } = useAppStore();
  const config = roleHeaders[role] || roleHeaders.admin;
  const queueMeta = roleQueueMeta[role] || roleQueueMeta.admin;
  const rows = getRoleRows(role, state.data, state.auth);
  const table = getTableConfig(role, state.data);
  const identity = getIdentityCard(role, state.data, state.auth);
  const quickActions = (roleQuickActions[role] || []).filter(([pageId]) => getNavForRole(role, state.auth?.modules).some((item) => item.id === pageId));
  const firstOrder = rows.find((row) => row.status && row.timeline);

  return (
    <div>
      <PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description} />

      <div className="dashboard-metric-row grid grid-cols-4 gap-2 md:grid-cols-2 md:gap-3 xl:grid-cols-4">
        {getMetrics(role, state.data, state.auth).map(([label, value, Icon, tone]) => (
          <MetricCard key={label} label={label} value={value} icon={Icon} tone={tone} />
        ))}
      </div>

      <div className="mt-4">
        <Card
          title={queueMeta.title}
          subtitle={queueMeta.subtitle}
          actions={quickActions.map(([pageId, label, Icon]) => (
            <Button key={pageId} variant="secondary" onClick={() => dispatch({ type: 'NAVIGATE', pageId })}>
              <Icon className="h-4 w-4" /> {label}
            </Button>
          ))}
        >
          <DataTable columns={table.columns} rows={rows} />
        </Card>
      </div>

      <details className="group mt-4">
        <summary className="clinical-panel flex cursor-pointer list-none items-center justify-between gap-3 rounded-[1.2rem] px-4 py-3 text-sm font-semibold text-slate-600 transition hover:text-clinical-700 sm:rounded-[1.75rem]">
          More details — session, permissions and order workflow
          <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
        </summary>
        <div className="mt-3 space-y-4">
          {firstOrder ? (
            <WorkflowTimeline status={firstOrder.status} timeline={firstOrder.timeline} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-[1.2rem] bg-slate-50 px-4 py-10 text-center sm:rounded-[1.75rem]">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-500"><ClipboardList className="h-5 w-5" /></span>
              <span className="text-sm font-semibold text-slate-500">No workflow activity yet.</span>
            </div>
          )}
          <Card title="Role identity & permissions" subtitle="The session role, accessible modules and active clinical responsibilities are explicit.">
            <div className="space-y-2">
              {identity.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</span>
                  <span className="text-right text-sm font-semibold text-slate-800">{value || '—'}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => dispatch({ type: 'NAVIGATE', pageId: 'orders' })}>Open Order Registry</Button>
              <Button variant="subtle" onClick={() => dispatch({ type: 'NAVIGATE', pageId: 'overview' })}>System Overview</Button>
            </div>
          </Card>
        </div>
      </details>
    </div>
  );
}
