import { ROLES } from '../data/roles';

/*
  Backend <-> frontend translation layer.
  The backend speaks Prisma enums (ADMIN, LAB_STAFF, SUBMITTED, ROUTINE, LAB...)
  and cuid ids paired with human codes (orderCode, invoiceCode, sampleCode).
  Pages compare against display strings ('admin', 'Submitted', 'Routine', 'Lab')
  and render the human codes as ids. Every translation lives here so the
  mapping exists in exactly one place. Normalized entities keep the backend id
  in `apiId` so command handlers can address the API while pages keep showing
  the human code as `id`.
*/

/* ---------------------------------------------------------------- roles */

export const ROLE_FROM_API = {
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  RECEPTIONIST: 'receptionist',
  LAB_STAFF: 'lab',
  SCAN_STAFF: 'scan',
  BILLING_STAFF: 'billing'
};

export const ROLE_TO_API = Object.fromEntries(Object.entries(ROLE_FROM_API).map(([api, local]) => [local, api]));

export function normalizeRole(apiRole) {
  return ROLE_FROM_API[apiRole] || String(apiRole || '').toLowerCase();
}

export function normalizeAuthUser(apiUser) {
  if (!apiUser) return null;
  const role = normalizeRole(apiUser.role);
  const roleInfo = ROLES.find((item) => item.id === role);
  return {
    role,
    userName: apiUser.name || apiUser.username || 'User',
    userId: apiUser.id,
    username: apiUser.username || '',
    email: apiUser.email || '',
    landing: roleInfo?.landing || 'overview',
    linkedDoctorId: apiUser.doctorProfileId || apiUser.doctorProfile?.id || '',
    hospitalId: apiUser.hospitalId || apiUser.doctorProfile?.hospitalId || '',
    permissions: apiUser.permissions || [],
    loginAt: apiUser.lastLoginAt || new Date().toISOString()
  };
}

/* ---------------------------------------------------------------- enums */

const SPECIAL_ENUM_LABELS = {
  FINAL_RELEASED: 'Final / Released',
  UNPAID: 'Payment Pending',
  NO_RANGE: 'No Range',
  IN_APP: 'In-platform',
  PDF_DOWNLOAD: 'PDF Download',
  RETEST_REQUESTED: 'Retest Requested',
  RECOLLECTION_REQUESTED: 'Recollection Requested'
};

/* Generic Prisma-enum -> display string: IN_PROGRESS -> 'In Progress'. */
export function enumLabel(value) {
  if (value == null || value === '') return value;
  const key = String(value);
  if (SPECIAL_ENUM_LABELS[key]) return SPECIAL_ENUM_LABELS[key];
  if (!/^[A-Z0-9_]+$/.test(key)) return key; // already a display string
  return key.split('_').map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(' ');
}

export function toApiEnum(label) {
  if (label == null || label === '') return label;
  const special = Object.entries(SPECIAL_ENUM_LABELS).find(([, display]) => display === label);
  if (special) return special[0];
  return String(label).trim().toUpperCase().replace(/[\s/-]+/g, '_').replace(/_+/g, '_');
}

const ITEM_TYPE_FROM_API = { LAB: 'Lab', SCAN: 'Scan' };
const DEPARTMENT_FROM_TYPE = { LAB: 'Laboratory', SCAN: 'Imaging' };

/* ------------------------------------------------------------- helpers */

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : '';
}

function personName(patient) {
  if (!patient) return '';
  return [patient.firstName, patient.lastName].filter(Boolean).join(' ') || patient.fullName || '';
}

/* Collections come back either as bare arrays or as { items, meta }. */
export function listItems(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.items || [];
}

/* ------------------------------------------------------------ entities */

export function normalizePatient(patient) {
  if (!patient) return null;
  return {
    id: patient.patientCode || patient.id,
    apiId: patient.id,
    fullName: personName(patient),
    dateOfBirth: dateOnly(patient.dateOfBirth),
    gender: patient.gender || '',
    phone: patient.phone || '',
    email: patient.email || '',
    address: patient.address || '',
    nationalId: patient.nationalId || '',
    insuranceProvider: patient.insuranceProvider || '',
    policyNumber: patient.policyNumber || '',
    emergencyContact: patient.emergencyContact || '',
    allergies: patient.allergiesAndConditions || patient.allergies || '',
    hospitalId: patient.hospitalId || '',
    referringDoctorId: patient.referringDoctorId || '',
    createdAt: patient.createdAt
  };
}

export function normalizeCatalogItem(item) {
  if (!item) return null;
  return {
    id: item.catalogCode || item.id,
    apiId: item.id,
    name: item.name,
    type: ITEM_TYPE_FROM_API[item.type] || item.type,
    department: item.department?.name || DEPARTMENT_FROM_TYPE[item.type] || '',
    modality: item.modality || '',
    price: num(item.price),
    expectedHours: num(item.expectedCompletionHours, 24),
    sampleType: item.sampleType || '',
    searchText: [item.name, ...(item.aliases || [])].join(' '),
    parameters: (item.parameters || []).map((parameter) => ({
      name: parameter.name,
      unit: parameter.unit || '',
      referenceRange: parameter.referenceRange || parameter.rangeLabel || '',
      low: parameter.low != null ? num(parameter.low) : undefined,
      high: parameter.high != null ? num(parameter.high) : undefined
    })),
    isActive: item.isActive !== false
  };
}

function synthesizeTimeline(order) {
  const steps = [
    ['Submitted', order.submittedAt, order.doctor?.user?.name, 'doctor'],
    ['Confirmed', order.confirmedAt, undefined, 'receptionist'],
    ['Final / Released', order.releasedAt, undefined, 'lab']
  ];
  const timeline = steps
    .filter(([, at]) => Boolean(at))
    .map(([status, at, actor, role]) => ({ status, actor: actor || 'System', role: role || 'system', timestamp: at }));
  const currentStatus = enumLabel(order.status);
  if (!timeline.some((entry) => entry.status === currentStatus) && order.updatedAt) {
    timeline.push({ status: currentStatus, actor: 'System', role: 'system', timestamp: order.updatedAt });
  }
  return timeline;
}

export function normalizeOrder(order) {
  if (!order) return null;
  const items = order.items || order.orderItems || [];
  const departments = Array.from(new Set(items.map((item) => DEPARTMENT_FROM_TYPE[item.type] || item.catalogItem?.department?.name).filter(Boolean)));
  return {
    id: order.orderCode || order.id,
    apiId: order.id,
    patientId: order.patient?.patientCode || order.patientId,
    doctorId: order.doctorId || order.doctor?.id || '',
    hospitalId: order.hospitalId || '',
    status: enumLabel(order.status),
    billingStatus: order.invoice ? enumLabel(order.invoice.status) : 'Payment Pending',
    urgency: enumLabel(order.urgency),
    clinicalNotes: order.clinicalNotes || '',
    diagnosis: order.diagnosis || '',
    itemIds: items.map((item) => item.catalogItem?.catalogCode || item.catalogItemId).filter(Boolean),
    orderItems: items.map((item) => ({
      id: item.id,
      catalogItemId: item.catalogItem?.catalogCode || item.catalogItemId,
      type: ITEM_TYPE_FROM_API[item.type] || item.type,
      status: enumLabel(item.status),
      acceptedAt: item.acceptedAt || '',
      completedAt: item.completedAt || ''
    })),
    routedDepartments: departments,
    walkInRequest: Boolean(order.walkInRequest),
    visitId: order.visitId || '',
    expectedCompletionAt: order.expectedCompletionAt || '',
    createdAt: order.createdAt || order.submittedAt || '',
    updatedAt: order.updatedAt || '',
    timeline: synthesizeTimeline(order)
  };
}

export function normalizeInvoice(invoice, orderCodeById = {}) {
  if (!invoice) return null;
  return {
    id: invoice.invoiceCode || invoice.id,
    apiId: invoice.id,
    orderId: invoice.order?.orderCode || orderCodeById[invoice.orderId] || invoice.orderId,
    patientId: invoice.patient?.patientCode || invoice.patientId,
    hospitalId: invoice.hospitalId || '',
    status: enumLabel(invoice.status),
    amount: num(invoice.total),
    subtotal: num(invoice.subtotal),
    discount: num(invoice.discount),
    tax: num(invoice.tax),
    paidAmount: num(invoice.amountPaid),
    balance: num(invoice.balance),
    insuranceClaimRef: invoice.insuranceClaimRef || '',
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt
  };
}

/* Lab results use the frontend's release convention: a signed-off result is
   what pages call 'Final / Released'. */
const LAB_RESULT_STATUS_FROM_API = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending Review',
  SIGNED_OFF: 'Final / Released',
  AMENDED: 'Amended'
};

export function normalizeLabResult(result, orderCodeById = {}) {
  if (!result) return null;
  const orderApiId = result.orderItem?.orderId || result.orderId;
  return {
    id: result.resultCode || result.id,
    apiId: result.id,
    orderId: orderCodeById[orderApiId] || result.orderItem?.order?.orderCode || orderApiId || '',
    sampleId: result.sample?.sampleCode || result.sampleId || '',
    patientId: result.patient?.patientCode || result.patientId || '',
    department: 'Laboratory',
    status: LAB_RESULT_STATUS_FROM_API[result.status] || enumLabel(result.status),
    reportText: result.interpretation || '',
    internalNotes: result.technicianNotes || '',
    analyzer: result.analyzerUsed || '',
    parameters: (result.parameters || []).map((parameter) => ({
      testId: result.orderItem?.catalogItem?.catalogCode || result.orderItem?.catalogItemId || '',
      testName: result.orderItem?.catalogItem?.name || parameter.testName || '',
      name: parameter.name,
      value: parameter.value ?? '',
      unit: parameter.unit || '',
      referenceRange: parameter.referenceRange || '',
      flag: enumLabel(parameter.flag) || 'Pending',
      notes: parameter.notes || ''
    })),
    abnormal: (result.parameters || []).some((parameter) => ['HIGH', 'LOW', 'CRITICAL'].includes(parameter.flag)),
    enteredBy: result.enteredBy?.name || '',
    submittedAt: result.submittedAt || '',
    signedBy: result.signedOffBy?.name || result.reviews?.[0]?.reviewer?.name || '',
    signedAt: result.signedOffAt || '',
    approvedAt: result.signedOffAt || '',
    approvedBy: result.signedOffBy?.name || '',
    versionHistory: (result.amendments || []).map((amendment) => ({
      id: amendment.id,
      version: amendment.version,
      versionBefore: Math.max(1, (amendment.version || 1) - 1),
      versionAfter: amendment.version,
      changedBy: amendment.changedBy?.name || amendment.changedById || '',
      changedAt: amendment.createdAt,
      reason: amendment.reason || '',
      previousValues: amendment.previousValues || [],
      updatedValues: amendment.updatedValues || [],
      previousHash: amendment.previousHash || '',
      updatedHash: amendment.updatedHash || ''
    })),
    updatedAt: result.updatedAt || ''
  };
}

/* The accepted-samples endpoint nests the newest result (with parameters and
   reviews) under each sample plus the full order context — the richest source
   for the state.data.results collection. */
export function normalizeLabResultFromSample(sample, orderCodeById = {}) {
  const result = (sample?.results || [])[0];
  if (!result) return null;
  return normalizeLabResult({
    ...result,
    sample,
    orderItem: sample.orderItem,
    patient: sample.patient
  }, orderCodeById);
}

export function normalizeVisit(visit, orderCodeById = {}) {
  if (!visit) return null;
  return {
    id: visit.visitCode || visit.id,
    apiId: visit.id,
    patientId: visit.patient?.patientCode || visit.patientId,
    orderId: visit.order?.orderCode || orderCodeById[visit.orderId] || visit.orderId || '',
    status: enumLabel(visit.status),
    visitType: visit.visitType || 'Order',
    walkIn: String(visit.visitType || '').toLowerCase().includes('walk'),
    identityVerified: Boolean(visit.identityVerified),
    checkedInAt: visit.checkedInAt || '',
    completedAt: visit.completedAt || '',
    notes: visit.notes || ''
  };
}

export function normalizeAppointment(appointment, orderCodeById = {}) {
  if (!appointment) return null;
  return {
    id: appointment.appointmentCode || appointment.id,
    apiId: appointment.id,
    patientId: appointment.patient?.patientCode || appointment.patientId,
    orderId: appointment.order?.orderCode || orderCodeById[appointment.orderId] || appointment.orderId || '',
    doctorId: appointment.doctorId || '',
    hospitalId: appointment.hospitalId || '',
    scheduledDate: appointment.scheduledDate || '',
    type: appointment.type || 'Visit',
    roomOrArea: appointment.roomOrArea || '',
    status: enumLabel(appointment.status),
    notes: appointment.notes || ''
  };
}

export function normalizeNotification(notification, orderCodeById = {}) {
  if (!notification) return null;
  const latestDelivery = (notification.deliveryLogs || [])[0];
  const type = String(notification.type || '');
  return {
    id: notification.id,
    title: notification.title || enumLabel(type),
    body: notification.body || '',
    audience: notification.recipientUserId ? 'doctor' : notification.recipientPhone ? 'patient' : 'all',
    channel: latestDelivery ? enumLabel(latestDelivery.channel) : 'In-platform',
    status: latestDelivery ? (['SENT', 'DELIVERED'].includes(latestDelivery.status) ? 'Delivered' : enumLabel(latestDelivery.status)) : 'Delivered',
    read: Boolean(notification.isRead),
    deliveryType: enumLabel(type),
    entityId: notification.order?.orderCode || orderCodeById[notification.orderId] || notification.orderId || '',
    createdAt: notification.createdAt
  };
}

export function normalizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    username: user.username || '',
    email: user.email || '',
    role: normalizeRole(user.role),
    status: enumLabel(user.status),
    lastLoginAt: user.lastLoginAt || '',
    linkedDoctorId: user.doctorProfile?.id || ''
  };
}

export function normalizeDoctor(doctor) {
  if (!doctor) return null;
  return {
    id: doctor.id,
    name: doctor.user?.name || [doctor.title, doctor.firstName, doctor.lastName].filter(Boolean).join(' '),
    specialty: doctor.specialty || '',
    hospitalId: doctor.hospitalId || '',
    licenseNumber: doctor.licenseNumber || '',
    council: doctor.council || '',
    phone: doctor.phone || '',
    email: doctor.email || doctor.user?.email || '',
    status: doctor.status || 'Active',
    notificationPreferences: {
      email: doctor.notificationEmail !== false,
      sms: doctor.notificationSms !== false
    }
  };
}

export function normalizeHospital(hospital) {
  if (!hospital) return null;
  return {
    id: hospital.id,
    name: hospital.name,
    code: hospital.code || hospital.id,
    phone: hospital.phone || '',
    email: hospital.email || '',
    address: hospital.address || '',
    billingContact: hospital.billingContact || '',
    accountStatus: hospital.accountStatus || 'Active',
    counts: hospital._count || {}
  };
}

export function normalizeDepartment(department) {
  if (!department) return null;
  return {
    id: department.id,
    name: department.name,
    code: department.code || '',
    type: enumLabel(department.type),
    leadName: department.leadName || '',
    isActive: department.isActive !== false
  };
}

export function normalizeEquipment(equipment) {
  if (!equipment) return null;
  return {
    id: equipment.id,
    name: equipment.name,
    departmentId: equipment.departmentId || '',
    room: equipment.room || '',
    modality: equipment.modality || '',
    serialNumber: equipment.serialNumber || '',
    status: enumLabel(equipment.status),
    serviceDue: dateOnly(equipment.serviceDueDate),
    notes: equipment.notes || ''
  };
}

export function normalizeAuditLog(log) {
  if (!log) return null;
  return {
    id: log.id,
    actor: log.actor?.name || log.actorId || 'System',
    role: normalizeRole(log.actorRole) || 'system',
    action: log.action || '',
    module: log.module || '',
    entityId: log.entityId || '',
    details: log.details || '',
    timestamp: log.createdAt
  };
}

export function normalizeShift(shift) {
  if (!shift) return null;
  return {
    id: shift.shiftCode || shift.id,
    apiId: shift.id,
    userId: shift.userId,
    cashier: shift.user?.name || '',
    type: shift.type || 'Cashier',
    status: enumLabel(shift.status),
    openingFloat: num(shift.openingFloat),
    expectedCash: num(shift.expectedCash),
    countedCash: shift.countedCash != null ? num(shift.countedCash) : null,
    variance: shift.variance != null ? num(shift.variance) : null,
    startedAt: shift.startedAt || '',
    closedAt: shift.closedAt || '',
    payments: (shift.payments || []).map((payment) => ({
      id: payment.paymentCode || payment.id,
      amount: num(payment.amount),
      method: enumLabel(payment.method),
      status: enumLabel(payment.status),
      createdAt: payment.createdAt
    }))
  };
}

export function normalizeExpense(expense) {
  if (!expense) return null;
  return {
    id: expense.expenseCode || expense.id,
    apiId: expense.id,
    description: expense.description || '',
    category: expense.category || '',
    vendor: expense.vendor || '',
    status: enumLabel(expense.status),
    amount: num(expense.totalAmount),
    paidAmount: num(expense.amountPaid),
    balance: num(expense.balance),
    createdBy: expense.createdBy?.name || '',
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt
  };
}

export function normalizeDeliveryLog(log, orderCodeById = {}) {
  if (!log) return null;
  return {
    id: log.id,
    orderId: log.report?.order?.orderCode || orderCodeById[log.report?.orderId] || '',
    reportId: log.report?.reportCode || log.reportId || '',
    channel: enumLabel(log.channel),
    status: enumLabel(log.status),
    target: log.target || '',
    safeMessage: log.safeMessage !== false,
    error: log.error || '',
    retryCount: num(log.retryCount),
    performedBy: log.performedBy?.name || '',
    sentAt: log.deliveredAt || log.createdAt,
    createdAt: log.createdAt
  };
}

export function normalizeReport(report, orderCodeById = {}) {
  if (!report) return null;
  return {
    id: report.reportCode || report.id,
    apiId: report.id,
    orderId: report.order?.orderCode || orderCodeById[report.orderId] || report.orderId || '',
    status: enumLabel(report.status),
    secureToken: report.secureToken || '',
    generatedAt: report.generatedAt || '',
    downloadedAt: report.downloadedAt || ''
  };
}

export function normalizeScanBooking(booking, orderCodeById = {}) {
  if (!booking) return null;
  return {
    id: booking.bookingCode || booking.id,
    apiId: booking.id,
    patientId: booking.patient?.patientCode || booking.patientId,
    orderId: booking.orderItem?.orderId ? (orderCodeById[booking.orderItem.orderId] || booking.orderItem.orderId) : '',
    orderItemId: booking.orderItemId || '',
    equipmentId: booking.equipmentId || '',
    startAt: booking.startAt || '',
    endAt: booking.endAt || '',
    status: enumLabel(booking.status),
    notes: booking.notes || ''
  };
}
