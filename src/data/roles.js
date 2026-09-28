import {
  LayoutDashboard,
  UserRound,
  UsersRound,
  UserPlus,
  ClipboardList,
  CalendarDays,
  FlaskConical,
  ScanLine,
  CreditCard,
  Settings,
  Building2,
  FileBarChart2,
  LineChart,
  ShieldCheck,
  Bell,
  UserCog,
  Database,
  History,
  FileText,
  Send,
  ServerCog,
  Clock,
  CheckCircle2,
  KeyRound,
  Stethoscope
} from 'lucide-react';

export const ROLES = [
  {
    id: 'doctor',
    label: 'Clinician',
    subtitle: 'External hospital-side clinician',
    landing: 'doctor-dashboard',
    linkedDoctorId: 'DOC-001',
    hospitalId: 'HOSP-001',
    accessSummary: 'Places orders, tracks active work, views released results and notification preferences.'
  },
  {
    id: 'receptionist',
    label: 'Receptionist',
    subtitle: 'Front-desk and check-in operations',
    landing: 'reception-dashboard',
    accessSummary: 'Confirms incoming clinician orders, handles patient check-in, appointments and daily visits.'
  },
  {
    id: 'nurse',
    label: 'Nurse',
    subtitle: 'Triage, vitals and patient care',
    landing: 'opd-queue',
    accessSummary: 'Triages outpatients, records vital signs and allergies, and hands patients to the doctor queue.'
  },
  {
    id: 'lab',
    label: 'Lab Staff',
    subtitle: 'Laboratory test processing',
    landing: 'lab-queue',
    accessSummary: 'Manages lab queue acceptance, accepted sample result entry, and sent result storage.'
  },
  {
    id: 'scan',
    label: 'Scan / Imaging Staff',
    subtitle: 'Imaging orders and reports',
    landing: 'scan-dashboard',
    accessSummary: 'Processes imaging orders, equipment booking, report drafting and radiologist sign-off.'
  },
  {
    id: 'billing',
    label: 'Billing / Finance Staff',
    subtitle: 'Invoices, payments, reports',
    landing: 'billing-dashboard',
    accessSummary: 'Manages invoices, price catalog, payment status, outstanding balances and revenue reports.'
  },
  {
    id: 'admin',
    label: 'Admin',
    subtitle: 'System oversight and configuration',
    landing: 'admin-dashboard',
    accessSummary: 'Full system oversight across users, hospitals, catalog, audit logs, notifications and reports.'
  }
];

// The SaaS operator. Not a facility staff role, so it is kept out of ROLES (which
// feeds staff role pickers and the access matrix); use ALL_ROLES for lookups.
export const PLATFORM_ROLE = {
  id: 'platform',
  label: 'Platform Operator',
  subtitle: 'Runs the LHIMS service',
  landing: 'platform-facilities',
  accessSummary: 'Creates and manages subscribing facilities. Has no access to any facility\'s patient or business data.'
};

export const ALL_ROLES = [PLATFORM_ROLE, ...ROLES];

export const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, roles: ['doctor','receptionist','lab','scan','billing','admin'], section: 'Overview' },

  { id: 'opd-queue', label: 'OPD Visits', icon: Stethoscope, roles: ['nurse','doctor','receptionist','admin'], section: 'Outpatient' },

  { id: 'doctor-dashboard', label: 'Clinician Dashboard', icon: UserRound, roles: ['doctor','admin'], section: 'Clinician' },
  { id: 'doctor-new-order', label: 'New Order', icon: ClipboardList, roles: ['doctor','admin'], section: 'Clinician' },
  { id: 'doctor-active-orders', label: 'Active Orders', icon: Clock, roles: ['doctor','admin'], section: 'Clinician' },
  { id: 'doctor-completed-orders', label: 'Completed Orders', icon: CheckCircle2, roles: ['doctor','admin'], section: 'Clinician' },
  { id: 'doctor-results', label: 'Results Viewer', icon: ShieldCheck, roles: ['doctor','admin'], section: 'Clinician' },
  { id: 'doctor-patient-trends', label: 'Patient Trends', icon: LineChart, roles: ['doctor','admin'], section: 'Clinician' },

  { id: 'reception-dashboard', label: 'Reception', icon: LayoutDashboard, roles: ['receptionist','admin'], section: 'Reception' },
  { id: 'incoming-orders', label: 'Incoming Orders', icon: ClipboardList, roles: ['receptionist','admin'], section: 'Reception' },
  { id: 'patient-checkin', label: 'Patient Check-In', icon: UsersRound, roles: ['receptionist','admin'], section: 'Reception' },
  { id: 'reception-walkins', label: 'Walk-Ins', icon: UserPlus, roles: ['receptionist','admin'], section: 'Reception' },
  { id: 'appointments', label: 'Appointments', icon: CalendarDays, roles: ['receptionist','admin'], section: 'Reception' },
  { id: 'daily-visits', label: 'Daily Visit Log', icon: ClipboardList, roles: ['receptionist','admin'], section: 'Reception' },
  { id: 'reception-results', label: 'Results Inbox', icon: Send, roles: ['receptionist','admin'], section: 'Reception' },

  { id: 'patients', label: 'Patient Records', icon: UsersRound, roles: ['receptionist','doctor','lab','scan','billing','admin'], section: 'Core Records' },
  { id: 'orders', label: 'Order Registry', icon: ClipboardList, roles: ['receptionist','doctor','scan','billing','admin'], section: 'Core Records' },

  { id: 'lab-dashboard', label: 'Laboratory', icon: FlaskConical, roles: ['admin'], section: 'Laboratory' },
  { id: 'lab-queue', label: 'Queue', icon: ClipboardList, roles: ['lab','admin'], section: 'Laboratory' },
  { id: 'sample-log', label: 'Sample Log', icon: Database, roles: ['admin'], section: 'Laboratory' },
  { id: 'lab-accept', label: 'Accept Sample', icon: CheckCircle2, roles: ['admin'], section: 'Laboratory' },
  { id: 'accepted-samples', label: 'Accepted Samples', icon: CheckCircle2, roles: ['lab','admin'], section: 'Laboratory' },
  { id: 'lab-review', label: 'Review & Sign-off', icon: ShieldCheck, roles: ['admin'], section: 'Laboratory' },
  { id: 'lab-results', label: 'Results', icon: FileText, roles: ['lab','admin'], section: 'Laboratory' },
  { id: 'lab-rejections', label: 'Rejected / Retest', icon: History, roles: ['lab','admin'], section: 'Laboratory' },

  { id: 'scan-dashboard', label: 'Scan / Imaging', icon: ScanLine, roles: ['scan','admin'], section: 'Imaging' },
  { id: 'scan-queue', label: 'Scan Queue', icon: ClipboardList, roles: ['scan','admin'], section: 'Imaging' },
  { id: 'scan-accept', label: 'Accept Scan', icon: CheckCircle2, roles: ['scan','admin'], section: 'Imaging' },
  { id: 'accepted-scans', label: 'Accepted Scans', icon: CheckCircle2, roles: ['scan','admin'], section: 'Imaging' },
  { id: 'scan-review', label: 'Review & Sign-off', icon: ShieldCheck, roles: ['scan','admin'], section: 'Imaging' },
  { id: 'scan-rejections', label: 'Rejected / Retake', icon: History, roles: ['scan','admin'], section: 'Imaging' },
  { id: 'equipment-booking', label: 'Equipment Booking', icon: CalendarDays, roles: ['scan','admin'], section: 'Imaging' },

  { id: 'billing-dashboard', label: 'Billing / Finance', icon: CreditCard, roles: ['billing','admin'], section: 'Finance' },
  { id: 'invoices', label: 'Invoices', icon: CreditCard, roles: ['billing','admin'], section: 'Finance' },
  { id: 'finance-shift', label: 'Shift Start / Close', icon: Clock, roles: ['billing','admin'], section: 'Finance' },
  { id: 'float-tracker', label: 'Float Tracker', icon: CreditCard, roles: ['billing','admin'], section: 'Finance' },
  { id: 'expenses', label: 'Expenses', icon: ClipboardList, roles: ['billing','admin'], section: 'Finance' },
  { id: 'account-ledger', label: 'Account Ledger', icon: FileBarChart2, roles: ['billing','admin'], section: 'Finance' },
  { id: 'billing-analytics', label: 'Billing Analytics', icon: LineChart, roles: ['billing','admin'], section: 'Finance' },
  { id: 'price-catalog', label: 'Price Catalog', icon: ClipboardList, roles: ['billing','receptionist','admin'], section: 'Finance' },

  { id: 'admin-dashboard', label: 'Admin', icon: ShieldCheck, roles: ['admin'], section: 'Admin' },
  { id: 'users', label: 'User Management', icon: UserCog, roles: ['admin'], section: 'Admin' },
  { id: 'roles', label: 'Roles & Permissions', icon: KeyRound, roles: ['admin'], section: 'Admin' },
  { id: 'hospitals', label: 'Partner Hospitals', icon: Building2, roles: ['admin'], section: 'Admin' },
  { id: 'audit-log', label: 'Audit Log', icon: History, roles: ['admin'], section: 'Admin' },
  { id: 'security', label: 'Security & Reliability', icon: ShieldCheck, roles: ['admin'], section: 'Admin' },
  { id: 'notification-settings', label: 'Notification Settings', icon: Bell, roles: ['admin'], section: 'Admin' },
  { id: 'result-delivery', label: 'Results Inbox / Delivery', icon: Send, roles: ['admin','billing','receptionist'], section: 'Results' },

  { id: 'reports', label: 'Reports', icon: FileBarChart2, roles: ['billing','admin','scan'], section: 'Reporting' },
  { id: 'settings', label: 'Settings', icon: Settings, roles: ['admin'], section: 'System' },
  { id: 'api-readiness', label: 'API Readiness', icon: ServerCog, roles: ['admin'], section: 'System' },

  { id: 'platform-facilities', label: 'Facilities', icon: Building2, roles: ['platform'], section: 'Platform' }
];

export const ROLE_DASHBOARD_REQUIREMENTS = {
  doctor: ['Clinician Profile', 'New Order Form', 'My Orders Active', 'My Orders Completed', 'Result Viewer', 'PDF Report Download', 'Notification Preferences', 'Patient Search'],
  receptionist: ['Incoming Orders Queue', 'Patient Check-In', 'Order Confirmation Panel', 'Appointment Scheduler', 'Walk-in Registration', 'Walk-in Test Requests', 'Direct Walk-in Invoice Creation', 'Daily Visit Log', 'Duplicate Patient Resolution', 'Reception Results Inbox'],
  lab: ['Queue', 'Accepted Samples', 'Results'],
  scan: ['Scan Order Queue', 'Equipment/Room Booking', 'Image Upload', 'Radiologist Report Field', 'Comparison to Prior Scans', 'Review & Sign-off', 'Internal Technician Notes'],
  billing: ['Test/Scan Price Catalog', 'Invoice Generator', 'Payment Status Tracker', 'Payment Method Log', 'Outstanding Balances Report', 'Insurance Claim Reference', 'Cashier Float', 'Expenses', 'Account Ledger', 'Billing Analytics', 'Revenue Summary', 'Refund/Adjustment Tool'],
  admin: ['User Management', 'Diagnostic Facility Management', 'Hospital/Partner Management', 'Facility Feature Customization', 'Catalog Management', 'Department Management', 'System-Wide Reporting Dashboard', 'Audit Log', 'Notification Settings', 'Data Export']
};
