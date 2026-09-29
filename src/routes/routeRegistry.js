export const PAGE_META = {
  'my-hr': {
    title: 'My Rota & Leave', section: 'HR',
    description: 'Your shifts, leave balance and leave requests.',
    requirements: ['My shifts', 'Leave balance', 'Leave requests']
  },
  'duty-rota': {
    title: 'Duty Rota', section: 'HR',
    description: 'Who is on duty each day, by ward or unit; HR adds and removes shifts.',
    requirements: ['Week view', 'Assign shifts', 'Rest and leave rules']
  },
  'hr-admin': {
    title: 'HR Admin', section: 'HR',
    description: 'Leave approvals, staff profiles with professional registration, and shift types.',
    requirements: ['Leave approvals', 'Staff profiles', 'Shift types']
  },
  mortuary: {
    title: 'Mortuary', section: 'Mortuary',
    description: 'Cold-room slots, the deceased register, death certification, police cases and release to family.',
    requirements: ['Slot board', 'Deceased register', 'Certification', 'Police clearance', 'Release']
  },
  'blood-bank': {
    title: 'Blood Bank', section: 'Blood Bank',
    description: 'Blood requests, crossmatch and issue, screened stock by group, donors and donations, and transfusion records.',
    requirements: ['Requests', 'Crossmatch', 'Issue', 'Emergency release', 'Stock', 'Donations', 'Transfusions']
  },
  stores: {
    title: 'Stores & Procurement', section: 'Stores',
    description: 'Stock on hand, requisitions from wards and departments, purchase orders, approvals and deliveries.',
    requirements: ['Stock levels', 'Requisitions', 'Purchase orders', 'Goods received', 'Suppliers']
  },
  'store-requests': {
    title: 'Request Supplies', section: 'Stores',
    description: 'Ask the store for supplies for your ward or unit and follow what was issued.',
    requirements: ['Requisition', 'Issue status']
  },
  'insurance-claims': {
    title: 'Insurance Claims', section: 'Claims',
    description: 'Claim completed visits from NHIS and other schemes, submit monthly batches, and record decisions and scheme payments.',
    requirements: ['Claimable visits', 'Claim preparation', 'Monthly batches', 'Adjudication', 'Scheme payments']
  },
  'clinic-child-welfare': {
    title: 'Child Welfare Clinic', section: 'Child Health',
    description: 'Child welfare visits: growth monitoring and immunisations against the EPI schedule.',
    requirements: ['Clinic queue', 'Growth monitoring', 'Immunisation schedule']
  },
  'immunisation-due': {
    title: 'Immunisation Due List', section: 'Child Health',
    description: 'Children under five with vaccines due or overdue, for defaulter tracing.',
    requirements: ['Due list', 'Defaulter tracing']
  },
  'clinic-antenatal': {
    title: 'Antenatal Clinic', section: 'Maternity',
    description: 'Antenatal visits: book the pregnancy, record each visit with gestation and warning signs, and record the delivery.',
    requirements: ['Clinic queue', 'Pregnancy booking', 'Antenatal visit', 'Delivery']
  },
  'clinic-postnatal': {
    title: 'Postnatal Clinic', section: 'Maternity',
    description: 'Postnatal checks for mother and baby, with warning signs and family planning.',
    requirements: ['Clinic queue', 'Postnatal check']
  },
  'maternity-register': {
    title: 'Maternity Register', section: 'Maternity',
    description: 'Every booked pregnancy with gestation today, due date, risks, antenatal record, delivery and babies.',
    requirements: ['Pregnancy register', 'Antenatal record', 'Delivery record', 'Postnatal care']
  },
  'clinic-dental': {
    title: 'Dental Clinic', section: 'Clinics',
    description: 'Dental visits with a tooth-by-tooth chart (FDI numbering) and treatment record.',
    requirements: ['Clinic queue', 'Dental chart', 'Earlier charts']
  },
  'clinic-eye': {
    title: 'Eye Clinic', section: 'Clinics',
    description: 'Eye clinic visits: visual acuity, eye pressure, examination findings and refraction.',
    requirements: ['Clinic queue', 'Eye examination']
  },
  'clinic-physiotherapy': {
    title: 'Physiotherapy', section: 'Clinics',
    description: 'Physiotherapy assessments with goals, and treatment sessions.',
    requirements: ['Clinic queue', 'Assessment', 'Session record']
  },
  'clinic-dietetics': {
    title: 'Dietetics', section: 'Clinics',
    description: 'Nutrition assessments with BMI and MUAC, diet plans and follow-up.',
    requirements: ['Clinic queue', 'Nutrition assessment']
  },
  'theatre-list': {
    title: 'Theatre List', section: 'Theatre',
    description: 'The day\'s operations by theatre, the WHO surgical safety checklist and the operation note.',
    requirements: ['Operating list', 'Sign in', 'Time out', 'Sign out', 'Operation note', 'Theatre setup']
  },
  'ward-board': {
    title: 'Ward Board', section: 'Wards',
    description: 'Wards and beds at a glance; admissions, bed moves, the medication chart and discharge.',
    requirements: ['Bed board', 'Admission', 'Medication chart', 'Transfer', 'Discharge', 'Ward setup']
  },
  'emergency-board': {
    title: 'Emergency Board', section: 'Emergency',
    description: 'Emergency arrivals ordered by triage colour, with quick registration of unidentified patients.',
    requirements: ['Triage-first board', 'Unidentified patient registration', 'Encounter workspace']
  },
  'pharmacy-dispensing': {
    title: 'Dispensing', section: 'Pharmacy',
    description: 'Prescriptions awaiting dispensing, allergy checks, first-expiry-first-out stock and partial dispensing.',
    requirements: ['Prescription queue', 'Allergy alerts', 'Match lines to stock', 'Partial dispensing']
  },
  'pharmacy-stock': {
    title: 'Drugs & Stock', section: 'Pharmacy',
    description: 'Drug list, stock by batch and expiry, receiving, adjustments and the stock ledger.',
    requirements: ['Drug list', 'Receive batches', 'Adjust and write off', 'Stock history', 'Reorder and expiry alerts']
  },
  'opd-queue': {
    title: 'OPD Visits', section: 'Outpatient',
    description: 'Outpatient visit queue and encounter workspace: triage, vitals, notes, diagnoses, investigations, prescriptions and charges.',
    requirements: ['Visit queue by stage', 'Triage and vitals', 'SOAP notes', 'ICD-10 diagnoses', 'Investigations', 'Prescriptions', 'Visit charges']
  },
  'doctor-new-order': {
    title: 'New Order', section: 'Doctor Portal',
    description: 'Doctor order form for existing or new patients, tests/scans, clinical notes and urgency.',
    requirements: ['Select existing patient', 'Create new patient', 'Select test(s)/scan(s)', 'Clinical notes', 'Routine/Urgent flag']
  },
  'doctor-results': {
    title: 'Results Viewer', section: 'Doctor Portal',
    description: 'Doctor-side result review with structured values, reference ranges, abnormal flags and PDF download.',
    requirements: ['Completed orders archive', 'Reference ranges', 'Abnormal flags', 'Download PDF', 'Email/SMS preferences']
  },

  'doctor-active-orders': {
    title: 'Active Orders', section: 'Doctor Portal',
    description: 'Focused doctor workspace for submitted, confirmed, in-progress, and pending-review orders without congesting the dashboard.',
    requirements: ['Active order table', 'Patient status', 'Expected completion', 'Result availability']
  },
  'doctor-completed-orders': {
    title: 'Completed Orders', section: 'Doctor Portal',
    description: 'Archive of finalized doctor orders with report viewing and PDF download actions.',
    requirements: ['Completed order archive', 'Released results', 'PDF report download', 'Result viewer']
  },
  'doctor-patient-trends': {
    title: 'Patient Trends', section: 'Doctor Portal',
    description: 'Line chart progress tracking for patients who have repeated the same test across multiple visits.',
    requirements: ['Search patient', 'Select repeated test', 'Select parameter', 'Line chart', 'Historical values']
  },
  'incoming-orders': {
    title: 'Incoming Orders Queue', section: 'Reception',
    description: 'New doctor-submitted orders waiting for receptionist confirmation and routing.',
    requirements: ['Urgency sorting', 'Order confirmation panel', 'Route to Lab/Scan', 'Cancellation/reschedule reason']
  },
  'patient-checkin': {
    title: 'Patient Check-In', section: 'Reception',
    description: 'Front-desk search, identity verification, standalone check-in, direct walk-in test request handoff and duplicate resolution.',
    requirements: ['Search patient', 'Register walk-in', 'Verify identity', 'Check In & Request Tests', 'Duplicate patient warning', 'Daily visit log']
  },
  'reception-walkins': {
    title: 'Walk-In Registration', section: 'Reception',
    description: 'Dedicated walk-in intake page for new patient registration, direct test requests, invoice creation, visit tracking and duplicate review.',
    requirements: ['Walk-in registration', 'Patient demographics', 'Request Tests', 'Direct walk-in order creation', 'Invoice creation', 'Visit creation', 'Duplicate review', 'Reception intake']
  },
  appointments: {
    title: 'Appointment Scheduler', section: 'Reception',
    description: 'Calendar and slot management for visit scheduling and scan equipment booking coordination.',
    requirements: ['Calendar view', 'Slot availability', 'Scan booking integration', 'Reschedule action']
  },
  'daily-visits': {
    title: 'Daily Visit Log', section: 'Reception',
    description: 'Reception shift register for checked-in patients, walk-ins, linked orders, identity verification and visit completion.',
    requirements: ['Daily visit log', 'Identity verification', 'Check-in status', 'Reception handover', 'Visit completion']
  },
  'reception-results': {
    title: 'Reception Results Inbox', section: 'Reception',
    description: 'Reception-facing released results queue for view, print, email and WhatsApp-safe patient notices.',
    requirements: ['Released results', 'Print report', 'Email patient', 'WhatsApp safe message', 'Reception result inbox']
  },
  patients: {
    title: 'Patient Records', section: 'Core Records',
    description: 'Master patient records referenced by every order, result, invoice and history view.',
    requirements: ['Patient ID', 'Demographics', 'Referring doctor/hospital', 'Insurance fields', 'Order history', 'Clinical flags']
  },
  orders: {
    title: 'Order Registry', section: 'Core Records',
    description: 'Live order lifecycle registry implementing Submitted, Confirmed, In Progress, Pending Review, Final / Released, Cancelled, plus parallel billing status.',
    requirements: ['Submitted', 'Confirmed', 'Payment status', 'In Progress', 'Pending Review', 'Final / Released', 'Cancelled']
  },
  'lab-accept': {
    title: 'Accept Lab Sample', section: 'Laboratory',
    description: 'Review requested lab tests for one patient and accept or reject the sample before result entry.',
    requirements: ['Patient details', 'Requested lab tests', 'Accept sample', 'Reject sample with reason']
  },
  'accepted-samples': {
    title: 'Accepted Samples', section: 'Laboratory',
    description: 'Search accepted lab samples, save draft values, and submit per-test results for review.',
    requirements: ['Search accepted samples', 'Patient sample list', 'Per-test result entry', 'Draft result entry', 'Reference ranges', 'Forward to review']
  },
  'lab-review': {
    title: 'Lab Review & Sign-off', section: 'Laboratory',
    description: 'Senior review queue for structured lab results before final release.',
    requirements: ['Pending review queue', 'Result parameter review', 'Reference ranges', 'Sign-off', 'Release results']
  },
  'lab-results': {
    title: 'Lab Results', section: 'Laboratory',
    description: 'Stored laboratory result archive for review, printing, corrections and future reference.',
    requirements: ['Result archive', 'Print report', 'Edit corrections', 'Amendment history', 'Reference ranges']
  },
  'lab-rejections': {
    title: 'Rejected / Retest Samples', section: 'Laboratory',
    description: 'Track rejected samples, recollection requests and retest notes.',
    requirements: ['Rejected sample log', 'Retest reason', 'Recollection tracking', 'Audit log']
  },
  'finance-shift': {
    title: 'Shift Start / Close', section: 'Billing / Finance',
    description: 'Start and close finance shifts, link payments to active shift, and reconcile opening/closing float.',
    requirements: ['Start shift', 'Opening float', 'Close shift', 'Cash variance', 'Audit log']
  },
  'lab-queue': {
    title: 'Lab Order Queue', section: 'Laboratory',
    description: 'Laboratory queue filterable by status, urgency and test type.',
    requirements: ['Filter by status', 'Sample log', 'Test panel checklist', 'Result entry', 'Review/sign-off']
  },
  'sample-log': {
    title: 'Sample Collection Log', section: 'Laboratory',
    description: 'Sample ID, collection time, collector and sample type tracking.',
    requirements: ['Sample ID', 'Collection time', 'Collected by', 'Sample type', 'Reject/retest action']
  },
  'scan-queue': {
    title: 'Scan Order Queue', section: 'Imaging',
    description: 'Imaging order queue filterable by modality and urgency.',
    requirements: ['Modality filter', 'Equipment booking', 'Image upload', 'Radiologist report', 'Review/sign-off']
  },

  'scan-accept': {
    title: 'Accept Scan', section: 'Imaging',
    description: 'Review patient imaging requests, accept scans, assign provisional equipment and avoid congesting the main scan queue.',
    requirements: ['Patient scan search', 'Scan request review', 'Accept scan', 'Clinical notes', 'Equipment context']
  },
  'accepted-scans': {
    title: 'Accepted Scans', section: 'Imaging',
    description: 'Search accepted imaging cases, compare prior scans, attach images/DICOM files, save drafts and submit reports for review.',
    requirements: ['Accepted scan search', 'Image upload', 'DICOM metadata preview', 'Radiologist report draft', 'Prior scan comparison']
  },
  'scan-review': {
    title: 'Scan Review & Sign-off', section: 'Imaging',
    description: 'Dedicated radiologist review queue for submitted imaging reports before final release.',
    requirements: ['Pending review queue', 'Radiologist review', 'DICOM metadata', 'Sign-off', 'Final release']
  },
  'scan-rejections': {
    title: 'Rejected / Retake Scans', section: 'Imaging',
    description: 'Track rejected imaging cases and retake requests with reason, patient and order linkage.',
    requirements: ['Rejected scan log', 'Retake reason', 'Patient linkage', 'Audit log']
  },
  'equipment-booking': {
    title: 'Equipment / Room Booking', section: 'Imaging',
    description: 'Machine, room and time-slot assignment for imaging orders.',
    requirements: ['Room assignment', 'Machine assignment', 'Time slot', 'Technician notes']
  },

  'float-tracker': {
    title: 'Float Tracker', section: 'Billing / Finance',
    description: 'Cashier float ledger for every payment and manual adjustment, linked to active shifts, staff and payment method.',
    requirements: ['Active shift required', 'Cashier float', 'Payment method totals', 'Transaction log', 'Staff traceability']
  },
  expenses: {
    title: 'Expenses', section: 'Billing / Finance',
    description: 'Centralised expense register for paid, partial, unpaid and written-off outgoing facility costs.',
    requirements: ['Purchase cost', 'Courier fees', 'Subscription', 'Rent', 'Paid/unpaid/write-off', 'Expense payments']
  },
  'account-ledger': {
    title: 'Account Ledger', section: 'Billing / Finance',
    description: 'Attributed account ledger combining billing credits and expense debits into a complete cash-flow balance.',
    requirements: ['Total credit', 'Total debit', 'Current balance', 'Cash flow', 'Reference tracking']
  },
  'billing-analytics': {
    title: 'Billing Analytics', section: 'Billing / Finance',
    description: 'Period-end analytics for patient visits, collections, outstanding balances, paid invoices, write-offs and ageing.',
    requirements: ['Patient visits', 'Collections', 'Net outstanding', 'Paid invoices', 'Write-offs', 'Accounts receivable ageing']
  },
  invoices: {
    title: 'Invoices', section: 'Billing / Finance',
    description: 'Invoice generation and payment tracking tied to order line items.',
    requirements: ['Auto invoice from order', 'Tax/discount', 'Payment status', 'Payment method', 'Insurance reference']
  },
  'price-catalog': {
    title: 'Price Catalog', section: 'Billing / Finance',
    description: 'Billable test and scan catalog with current prices.',
    requirements: ['Test prices', 'Scan prices', 'Editable catalog', 'Department grouping']
  },
  users: {
    title: 'User Management', section: 'Admin',
    description: 'Create, edit, deactivate and assign user permissions.',
    requirements: ['Create users', 'Assign roles', 'Deactivate users', 'Permission groups']
  },
  hospitals: {
    title: 'Hospital / Partner Management', section: 'Admin',
    description: 'Registered hospitals and affiliated doctors.',
    requirements: ['Hospital profile', 'Billing contact', 'Account status', 'Affiliated doctors']
  },
  'audit-log': {
    title: 'Audit Log', section: 'Admin',
    description: 'Who changed what and when across all modules.',
    requirements: ['View events', 'Edit events', 'Approval events', 'Export audit log']
  },
  'notification-settings': {
    title: 'Notification Settings', section: 'Admin',
    description: 'Email/SMS provider and template configuration.',
    requirements: ['Email provider', 'SMS provider', 'Templates', 'Delivery log']
  },

  security: {
    title: 'Security & Reliability', section: 'Security',
    description: 'Control surface for role access, audit coverage, PHI-safe SMS, delivery retries, integrity checks and security exports.',
    requirements: ['Role-based access controls', 'Audit trail coverage', 'PHI-safe SMS scanner', 'Delivery retry visibility', 'Data integrity checks', 'Security dataset export']
  },
  'result-delivery': {
    title: 'Results Delivery System', section: 'Results Delivery',
    description: 'Release finalized results through in-platform delivery, PDF report generation, email notifications and privacy-safe SMS alerts.',
    requirements: ['Doctor dashboard delivery', 'PDF report generation', 'Email notification', 'SMS notification without clinical data', 'Retry log']
  },
  reports: {
    title: 'Reports', section: 'Reporting',
    description: 'Reporting system for turnaround time, volume, revenue, outstanding balances, abnormal rates, productivity, filters, and exports.',
    requirements: ['TAT reports', 'Order volume by hospital/doctor/department', 'Revenue and outstanding balances', 'Abnormal result rates', 'Staff productivity', 'CSV/JSON export']
  },

  roles: {
    title: 'Roles & Permissions', section: 'Admin',
    description: 'Facility-defined staff roles built on a standard workspace with a chosen permission list.',
    requirements: ['Custom roles', 'Permission picker', 'Standard roles reference']
  },

  'platform-facilities': {
    title: 'Facilities', section: 'Platform',
    description: 'Platform operator console for creating, suspending and reactivating subscribing facilities.',
    requirements: ['Facility list', 'Create facility with first administrator', 'Suspend / reactivate']
  },

  'api-readiness': {
    title: 'API Readiness', section: 'System',
    description: 'API integration boundary with service files, endpoint contracts, API mode and model mappers.',
    requirements: ['apiClient', 'service files', 'endpoint map', 'mock API mode', 'live API mode', 'model mappers']
  },
  settings: {
    title: 'Settings', section: 'System',
    description: 'System configuration for catalog, departments, notification templates and exports.',
    requirements: ['Departments', 'Equipment list', 'Catalog defaults', 'Templates']
  }
};
