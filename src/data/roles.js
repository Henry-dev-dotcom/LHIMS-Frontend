import {
  MessagesSquare,
  Wallet,
  ClipboardCheck,
  Monitor,
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
  Stethoscope,
  Siren,
  Pill,
  Package,
  BedDouble,
  Scissors,
  Smile,
  Eye,
  Activity,
  Cpu,
  Link2,
  Apple,
  Baby,
  HeartHandshake,
  BookHeart,
  Syringe,
  ListChecks,
  Warehouse,
  PackageOpen,
  Droplets,
  Archive,
  CalendarCheck,
  IdCard,
  FolderLock
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
    id: 'pharmacist',
    label: 'Pharmacist',
    subtitle: 'Dispensing and drug stock',
    landing: 'pharmacy-dispensing',
    accessSummary: 'Dispenses prescriptions, manages the drug list, receives and adjusts stock, and tracks expiry.'
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
  subtitle: 'Runs the CurataMed service',
  landing: 'platform-dashboard',
  accessSummary: 'Creates and manages subscribing facilities. Has no access to any facility\'s patient or business data.'
};

export const ALL_ROLES = [PLATFORM_ROLE, ...ROLES];

export const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, roles: ['doctor','receptionist','lab','scan','billing','admin'], section: 'Overview' },

  { id: 'opd-queue', label: 'OPD Visits', icon: Stethoscope, roles: ['nurse','doctor','receptionist','admin'], section: 'Outpatient' },
  { id: 'emergency-board', label: 'Emergency Board', icon: Siren, roles: ['nurse','doctor','receptionist','admin'], section: 'Emergency' },
  { id: 'ward-board', label: 'Ward Board', icon: BedDouble, roles: ['nurse','doctor','admin'], section: 'Wards' },
  { id: 'theatre-list', label: 'Theatre List', icon: Scissors, roles: ['nurse','doctor','admin'], section: 'Theatre' },
  /* The records desk. CurataMed's receptionist is its front-office role, which is
     where registration and check-in already lived, so this belongs to them. */
  /* Every department talks to the others, so this belongs to all of them. */
  { id: 'messages', label: 'Messages', icon: MessagesSquare, roles: ['doctor','nurse','receptionist','lab','scan','billing','pharmacist','admin'], section: 'Messages' },
  { id: 'records-desk', label: 'Registration & Check-in', icon: ClipboardCheck, roles: ['receptionist','admin'], section: 'Records' },
  { id: 'medical-records', label: 'Medical Records', icon: FolderLock, roles: ['doctor','nurse','receptionist','admin'], section: 'Medical Records' },
  { id: 'my-hr', label: 'My Rota & Leave', icon: CalendarCheck, roles: ['doctor','nurse','pharmacist','receptionist','lab','scan','billing','admin'], section: 'HR' },
  { id: 'duty-rota', label: 'Duty Rota', icon: CalendarDays, roles: ['doctor','nurse','pharmacist','receptionist','lab','scan','billing','admin'], section: 'HR' },
  { id: 'hr-admin', label: 'HR Admin', icon: IdCard, roles: ['admin'], section: 'HR' },
  { id: 'mortuary', label: 'Mortuary', icon: Archive, roles: ['nurse','doctor','admin'], section: 'Mortuary' },
  { id: 'blood-bank', label: 'Blood Bank', icon: Droplets, roles: ['lab','doctor','nurse','admin'], section: 'Blood Bank' },
  { id: 'stores', label: 'Stores & Procurement', icon: Warehouse, roles: ['billing','admin'], section: 'Stores' },
  { id: 'store-requests', label: 'Request Supplies', icon: PackageOpen, roles: ['nurse','doctor','pharmacist','receptionist','lab','scan','billing','admin'], section: 'Stores' },
  { id: 'insurance-claims', label: 'Insurance Claims', icon: ShieldCheck, roles: ['billing','admin'], section: 'Claims' },
  { id: 'clinic-antenatal', label: 'Antenatal Clinic', icon: HeartHandshake, roles: ['nurse','doctor','receptionist','admin'], section: 'Maternity' },
  { id: 'clinic-postnatal', label: 'Postnatal Clinic', icon: Baby, roles: ['nurse','doctor','receptionist','admin'], section: 'Maternity' },
  { id: 'maternity-register', label: 'Maternity Register', icon: BookHeart, roles: ['nurse','doctor','admin'], section: 'Maternity' },
  { id: 'clinic-child-welfare', label: 'Child Welfare Clinic', icon: Syringe, roles: ['nurse','doctor','receptionist','admin'], section: 'Child Health' },
  { id: 'immunisation-due', label: 'Immunisation Due List', icon: ListChecks, roles: ['nurse','doctor','admin'], section: 'Child Health' },
  { id: 'clinic-dental', label: 'Dental Clinic', icon: Smile, roles: ['nurse','doctor','receptionist','admin'], section: 'Clinics' },
  { id: 'clinic-eye', label: 'Eye Clinic', icon: Eye, roles: ['nurse','doctor','receptionist','admin'], section: 'Clinics' },
  { id: 'clinic-physiotherapy', label: 'Physiotherapy', icon: Activity, roles: ['nurse','doctor','receptionist','admin'], section: 'Clinics' },
  { id: 'clinic-dietetics', label: 'Dietetics', icon: Apple, roles: ['nurse','doctor','receptionist','admin'], section: 'Clinics' },
  { id: 'pharmacy-dispensing', label: 'Dispensing', icon: Pill, roles: ['pharmacist','admin'], section: 'Pharmacy' },
  { id: 'pharmacy-stock', label: 'Drugs & Stock', icon: Package, roles: ['pharmacist','admin'], section: 'Pharmacy' },

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
  /*
    Three tabs, and the analyzers.

    Incoming -> Accepted -> Results is the whole of the laboratory's day, and
    each is one answer to one question: whose samples are waiting, what owes a
    result, and what has been sent. Accept Sample is the second half of Incoming
    rather than a destination of its own, so it stays reachable but unlisted.

    Review & Sign-off, Sample Log and Rejected / Retest are gone from the menu.
    Sign-off now happens as part of submitting, which is what a lab with one
    person on the bench actually does; the sample log duplicated Incoming; and a
    rejection is made where the sample is handled, on the acceptance screen.
  */
  { id: 'lab-queue', label: 'Incoming Labs', icon: ClipboardList, roles: ['lab','admin'], section: 'Laboratory' },
  { id: 'accepted-samples', label: 'Accepted Samples', icon: CheckCircle2, roles: ['lab','admin'], section: 'Laboratory' },
  { id: 'lab-results', label: 'Results', icon: FileText, roles: ['lab','admin'], section: 'Laboratory' },
  { id: 'lab-accept', label: 'Accept Sample', icon: CheckCircle2, roles: ['lab','admin'], section: 'Laboratory', hidden: true },
  { id: 'sample-log', label: 'Sample Log', icon: Database, roles: ['admin'], section: 'Laboratory', hidden: true },
  { id: 'lab-review', label: 'Review & Sign-off', icon: ShieldCheck, roles: ['admin'], section: 'Laboratory', hidden: true },
  { id: 'lab-rejections', label: 'Rejected / Retest', icon: History, roles: ['lab','admin'], section: 'Laboratory', hidden: true },
  { id: 'lab-analyzers', label: 'Analyzers', icon: Cpu, roles: ['lab','admin'], section: 'Laboratory' },
  { id: 'lab-analyzer-mapping', label: 'Test Mapping', icon: Link2, roles: ['lab','admin'], section: 'Laboratory' },
  { id: 'lab-analyzer-log', label: 'Analyzer Log', icon: Activity, roles: ['lab','admin'], section: 'Laboratory' },

  { id: 'scan-dashboard', label: 'Scan / Imaging', icon: ScanLine, roles: ['scan','admin'], section: 'Imaging' },
  /*
    The imaging unit runs the laboratory's three tabs, plus the viewer.

    Incoming Scans -> Accepted Scans -> Results, and a DICOM viewer that opens
    either an attached study or a disc the modality wrote. Accept Scan is the
    second half of Incoming, so it stays reachable but unlisted. Review &
    Sign-off, Rejected / Retake and Equipment Booking have left the menu for the
    same reasons they left the laboratory's: signing off happens as part of
    submitting, and a retake is asked for where the study is handled.
  */
  { id: 'scan-queue', label: 'Incoming Scans', icon: ClipboardList, roles: ['scan','admin'], section: 'Imaging' },
  { id: 'accepted-scans', label: 'Accepted Scans', icon: CheckCircle2, roles: ['scan','admin'], section: 'Imaging' },
  { id: 'scan-results', label: 'Results', icon: FileText, roles: ['scan','admin'], section: 'Imaging' },
  { id: 'scan-viewer', label: 'DICOM Viewer', icon: Monitor, roles: ['scan','admin','doctor'], section: 'Imaging' },
  { id: 'scan-accept', label: 'Accept Scan', icon: CheckCircle2, roles: ['scan','admin'], section: 'Imaging', hidden: true },
  { id: 'scan-review', label: 'Review & Sign-off', icon: ShieldCheck, roles: ['scan','admin'], section: 'Imaging', hidden: true },
  { id: 'scan-rejections', label: 'Rejected / Retake', icon: History, roles: ['scan','admin'], section: 'Imaging', hidden: true },
  { id: 'equipment-booking', label: 'Equipment Booking', icon: CalendarDays, roles: ['scan','admin'], section: 'Imaging', hidden: true },

  { id: 'billing-dashboard', label: 'Billing / Finance', icon: CreditCard, roles: ['billing','admin'], section: 'Finance' },
  /*
    Cashiering first, accounting second.

    Finance had seven entries of equal weight, and the one a cashier needs all
    day - take this patient's money and give them a receipt - was no more
    prominent than the float tracker. The window is now its own section;
    expenses, float, shift reconciliation, the ledger and the analytics are
    accounting, and are grouped as such rather than removed, because a facility
    that does its books in here still needs them.
  */
  { id: 'finance-desk', label: 'Cashier', icon: Wallet, roles: ['billing','admin'], section: 'Finance' },
  { id: 'invoices', label: 'Invoices', icon: CreditCard, roles: ['billing','admin'], section: 'Finance' },
  { id: 'price-catalog', label: 'Price Catalog', icon: ClipboardList, roles: ['billing','receptionist','admin'], section: 'Finance' },
  { id: 'finance-shift', label: 'Shift Start / Close', icon: Clock, roles: ['billing','admin'], section: 'Accounting' },
  { id: 'float-tracker', label: 'Float Tracker', icon: CreditCard, roles: ['billing','admin'], section: 'Accounting' },
  { id: 'expenses', label: 'Expenses', icon: ClipboardList, roles: ['billing','admin'], section: 'Accounting' },
  { id: 'account-ledger', label: 'Account Ledger', icon: FileBarChart2, roles: ['billing','admin'], section: 'Accounting' },
  { id: 'billing-analytics', label: 'Billing Analytics', icon: LineChart, roles: ['billing','admin'], section: 'Accounting' },

  { id: 'admin-dashboard', label: 'Admin', icon: ShieldCheck, roles: ['admin'], section: 'Admin' },
  { id: 'users', label: 'User Management', icon: UserCog, roles: ['admin'], section: 'Admin' },
  { id: 'roles', label: 'Roles & Permissions', icon: KeyRound, roles: ['admin'], section: 'Admin' },
  { id: 'setup', label: 'Facility Setup', icon: ListChecks, roles: ['admin'], section: 'Admin' },
  { id: 'subscription', label: 'Subscription & Billing', icon: CreditCard, roles: ['admin'], section: 'Admin' },
  { id: 'hospitals', label: 'Partner Hospitals', icon: Building2, roles: ['admin'], section: 'Admin' },
  { id: 'audit-log', label: 'Audit Log', icon: History, roles: ['admin'], section: 'Admin' },
  { id: 'security', label: 'Security & Reliability', icon: ShieldCheck, roles: ['admin'], section: 'Admin' },
  { id: 'notification-settings', label: 'Notification Settings', icon: Bell, roles: ['admin'], section: 'Admin' },
  { id: 'result-delivery', label: 'Results Inbox / Delivery', icon: Send, roles: ['admin','billing','receptionist'], section: 'Results' },

  { id: 'reports', label: 'Reports', icon: FileBarChart2, roles: ['billing','admin','scan'], section: 'Reporting' },
  { id: 'settings', label: 'Settings', icon: Settings, roles: ['admin'], section: 'System' },
  { id: 'api-readiness', label: 'API Readiness', icon: ServerCog, roles: ['admin'], section: 'System' },

  { id: 'platform-dashboard', label: 'Overview', icon: LineChart, roles: ['platform'], section: 'Platform' },
  { id: 'platform-facilities', label: 'Facilities', icon: Building2, roles: ['platform'], section: 'Platform' },
  { id: 'platform-billing', label: 'Plans & Billing', icon: CreditCard, roles: ['platform'], section: 'Platform' }
];

export const ROLE_DASHBOARD_REQUIREMENTS = {
  doctor: ['Clinician Profile', 'New Order Form', 'My Orders Active', 'My Orders Completed', 'Result Viewer', 'PDF Report Download', 'Notification Preferences', 'Patient Search'],
  receptionist: ['Incoming Orders Queue', 'Patient Check-In', 'Order Confirmation Panel', 'Appointment Scheduler', 'Walk-in Registration', 'Walk-in Test Requests', 'Direct Walk-in Invoice Creation', 'Daily Visit Log', 'Duplicate Patient Resolution', 'Reception Results Inbox'],
  lab: ['Queue', 'Accepted Samples', 'Results'],
  scan: ['Scan Order Queue', 'Equipment/Room Booking', 'Image Upload', 'Radiologist Report Field', 'Comparison to Prior Scans', 'Review & Sign-off', 'Internal Technician Notes'],
  billing: ['Test/Scan Price Catalog', 'Invoice Generator', 'Payment Status Tracker', 'Payment Method Log', 'Outstanding Balances Report', 'Insurance Claim Reference', 'Cashier Float', 'Expenses', 'Account Ledger', 'Billing Analytics', 'Revenue Summary', 'Refund/Adjustment Tool'],
  admin: ['User Management', 'Diagnostic Facility Management', 'Hospital/Partner Management', 'Facility Feature Customization', 'Catalog Management', 'Department Management', 'System-Wide Reporting Dashboard', 'Audit Log', 'Notification Settings', 'Data Export']
};
