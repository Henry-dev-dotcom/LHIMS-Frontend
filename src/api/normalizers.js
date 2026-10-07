import { ALL_ROLES } from '../data/roles';

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
  PLATFORM_ADMIN: 'platform',
  NURSE: 'nurse',
  PHARMACIST: 'pharmacist',
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
  const roleInfo = ALL_ROLES.find((item) => item.id === role);
  return {
    role,
    userName: apiUser.name || apiUser.username || 'User',
    userId: apiUser.id,
    username: apiUser.username || '',
    email: apiUser.email || '',
    // Whether the person has proved they own that address by following the link
    // mailed to it. False until they do, and false again if it is ever changed.
    emailVerified: Boolean(apiUser.emailVerified),
    // The facility (tenant) this account belongs to; null for the platform operator.
    facility: apiUser.facility
      ? {
        id: apiUser.facility.id,
        code: apiUser.facility.code,
        name: apiUser.facility.name,
        logoDataUrl: apiUser.facility.logoDataUrl || null,
        // null only for a facility whose administrator has not finished setup yet.
        onboardingCompletedAt: apiUser.facility.onboardingCompletedAt,
        // Whether a clinician's order waits for reception before the lab can see
        // it. True in a diagnostic centre, false in a hospital or clinic.
        receptionConfirmsOrders: Boolean(apiUser.facility.receptionConfirmsOrders)
      }
      : null,
    // A new facility's administrator starts on the setup checklist.
    landing: role === 'admin' && apiUser.facility?.onboardingCompletedAt === null && !apiUser.support ? 'setup' : roleInfo?.landing || 'overview',
    // { operatorName, reason, expiresAt } during a platform operator's read-only support session.
    support: apiUser.support || null,
    linkedDoctorId: apiUser.doctorProfileId || apiUser.doctorProfile?.id || '',
    hospitalId: apiUser.hospitalId || apiUser.doctorProfile?.hospitalId || '',
    permissions: apiUser.permissions || [],
    // Switched-on department modules for this facility (empty for the platform operator).
    modules: Array.isArray(apiUser.modules) ? apiUser.modules : [],
    // { status, readOnly, trialEndsAt, graceEndsAt, currentPeriodEnd, cancelAtPeriodEnd }; null when not on a plan.
    subscription: apiUser.subscription || null,
    customRole: apiUser.customRole ? { id: apiUser.customRole.id, name: apiUser.customRole.name } : null,
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
    /*
      A test's measured fields, with the range each is read against.

      The bounds live on the parameter's reference ranges, not on the parameter
      itself, and this used to read them off the parameter - so low, high and the
      printed range were always undefined and the bench typed values with nothing
      to check them against. The first range is taken, which is the same one the
      server uses when it stores the result and works out the flag.
    */
    parameters: (item.parameters || []).map((parameter) => {
      const range = (parameter.ranges || [])[0] || {};
      const low = range.low != null ? num(range.low) : undefined;
      const high = range.high != null ? num(range.high) : undefined;
      const printed = range.displayRange
        || (low !== undefined && high !== undefined ? `${low} - ${high}` : '')
        || (low !== undefined ? `>= ${low}` : '')
        || (high !== undefined ? `<= ${high}` : '');
      return {
        name: parameter.name,
        unit: parameter.unit || '',
        referenceRange: printed,
        low,
        high,
        criticalLow: range.criticalLow != null ? num(range.criticalLow) : undefined,
        criticalHigh: range.criticalHigh != null ? num(range.criticalHigh) : undefined
      };
    }),
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
    /*
      What the bill is actually made of, and what has been paid against it.

      The server has always sent both; the normaliser dropped them, so a cashier
      could see only a total. You cannot tell somebody what they are paying for
      from a total, and a receipt has to itemise.
    */
    items: (invoice.items || []).map((item) => ({
      id: item.id,
      description: item.description || item.catalogItem?.name || 'Item',
      quantity: num(item.quantity, 1),
      unitPrice: num(item.unitPrice ?? item.catalogItem?.price),
      amount: num(item.total ?? item.amount),
      type: ITEM_TYPE_FROM_API[item.catalogItem?.type] || item.catalogItem?.type || ''
    })),
    payments: (invoice.payments || []).map((payment) => ({
      id: payment.id,
      amount: num(payment.amount),
      method: enumLabel(payment.method),
      reference: payment.reference || '',
      receivedBy: payment.receivedBy?.name || '',
      receiptId: payment.receipt?.id || '',
      receiptCode: payment.receipt?.receiptCode || '',
      paidAt: payment.createdAt || ''
    })),
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt
  };
}

/* Lab results use the frontend's release convention: a signed-off result is
   what pages call 'Final / Released'. */
/* ScanStatus, in the words the imaging unit uses. */
const SCAN_STATUS_FROM_API = {
  NOT_ACCEPTED: 'Not Accepted',
  ACCEPTED: 'Accepted',
  DRAFT: 'Accepted',
  PENDING_REVIEW: 'Accepted',
  SIGNED_OFF: 'Accepted',
  RETAKE_REQUESTED: 'Retake Requested'
};

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
    // The laboratory's comment on the result. It is written for the clinician,
    // so it has to be readable wherever the result is.
    comment: result.technicianNotes || '',
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
      notes: parameter.notes || '',
      // Where the value came from, so the bench can see at a glance which numbers
      // it is checking rather than entering.
      fromAnalyzer: parameter.source === 'ANALYZER',
      analyzerCode: parameter.analyzerCode || '',
      // The instrument's untouched reading, kept when a unit conversion changed it.
      analyzerRawValue: parameter.analyzerRawValue || '',
      measuredAt: parameter.measuredAt || ''
    })),
    abnormal: (result.parameters || []).some((parameter) => ['HIGH', 'LOW', 'CRITICAL'].includes(parameter.flag)),
    enteredBy: result.enteredBy?.name || '',
    submittedAt: result.submittedAt || '',
    signedBy: result.signedOffBy?.name || result.reviews?.[0]?.reviewer?.name || '',
    signedAt: result.signedOffAt || '',
    approvedAt: result.signedOffAt || '',
    approvedBy: result.signedOffBy?.name || '',
    // Every reversal (a sent result pulled back by the lab to correct it) is kept here,
    // newest first: who, when, why, and the status it moved from and to.
    versionHistory: (result.amendments || []).map((amendment) => ({
      id: amendment.id,
      changedBy: amendment.amendedBy?.name || '',
      changedAt: amendment.createdAt,
      reason: amendment.reason || '',
      fromStatus: amendment.beforeData?.status ? (LAB_RESULT_STATUS_FROM_API[amendment.beforeData.status] || enumLabel(amendment.beforeData.status)) : '',
      toStatus: amendment.afterData?.status ? (LAB_RESULT_STATUS_FROM_API[amendment.afterData.status] || enumLabel(amendment.afterData.status)) : '',
      parameters: amendment.beforeData?.parameters || []
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

/* The backend keeps one LabSample per order item (one per test) and only the
   accepted-samples endpoint's statuses reach the lab result-entry workspace. */
const LAB_SAMPLE_STATUS_FROM_API = {
  NOT_ACCEPTED: 'Not Accepted',
  ACCEPTED: 'Accepted',
  DRAFT: 'Accepted',
  PENDING_REVIEW: 'Accepted',
  SIGNED_OFF: 'Accepted',
  REJECTED: 'Rejected',
  RECOLLECTION_REQUESTED: 'Recollection Requested'
};

function mapSampleLog(sample, orderCodeById) {
  const orderApiId = sample.orderItem?.orderId || sample.orderItem?.order?.id || '';
  const result = (sample.results || [])[0] || null;
  /*
    A result is finished only once it has been signed off.

    Anything short of that - a draft, or one submitted and never signed - still
    owes somebody work, so it belongs in the Accepted queue with whatever was
    entered already filled in. Treating "submitted" as finished left such
    results in a limbo once the separate review tab was retired: gone from
    Accepted because they had a result, and absent from Results because they had
    never been released.
  */
  const finished = Boolean(result) && (result.status === 'SIGNED_OFF' || result.status === 'AMENDED');
  const unfinished = Boolean(result) && !finished;
  // A result sent back for correction carries the reason it was returned.
  const returnedReason = unfinished
    ? (result.reviews || []).find((review) => review.decision === 'REVERSED')?.note || ''
    : '';
  const orderCode = orderCodeById[orderApiId] || sample.orderItem?.order?.orderCode || orderApiId || '';
  const catalogCode = sample.orderItem?.catalogItem?.catalogCode || sample.orderItem?.catalogItemId || '';
  const rejection = (sample.rejections || [])[0];
  return {
    id: sample.sampleCode || sample.id,
    apiId: sample.id,
    orderId: orderCode,
    patientId: sample.patient?.patientCode || sample.patientId || '',
    status: LAB_SAMPLE_STATUS_FROM_API[sample.status] || enumLabel(sample.status),
    sampleType: sample.sampleType || 'Blood',
    barcode: sample.barcodeValue || '',
    labItemIds: catalogCode ? [catalogCode] : [],
    // One sample is one test, so the test it belongs to, and whether its result
    // has been entered, belong on the row. The lab works test by test: it
    // accepts the ones whose samples are in, and enters each result on its own.
    orderItemId: sample.orderItemId || sample.orderItem?.id || '',
    orderApiId,
    catalogCode,
    testName: sample.orderItem?.catalogItem?.name || catalogCode || '',
    resultId: result?.id || '',
    resultStatus: enumLabel(result?.status || ''),
    /*
      "Has a result" means one has been submitted, not merely that a row exists.
      Reversing a sent result puts it back to DRAFT and keeps it, which is how
      the old values survive for the correction - so counting any row at all
      would make a reversed test vanish from the queue instead of returning to
      it, which is the opposite of what reversing is for.
    */
    hasResult: finished,
    returned: Boolean(returnedReason),
    /*
      A draft result on an accepted sample is what the result-entry popup opens
      on. It exists for two reasons, and carries what each needs:

        - an analyzer filed values and the bench has still to check them, so the
          provenance of each value comes too;
        - a sent result was reversed for correction, so the reason comes with it
          and the old values are there to be edited rather than retyped.
    */
    draftResult: unfinished
      ? {
        reason: returnedReason,
        analyzer: result.analyzerUsed || '',
        reportText: result.interpretation || '',
        comment: result.technicianNotes || '',
        parameters: (result.parameters || []).map((parameter) => ({
          name: parameter.name,
          value: parameter.value ?? '',
          fromAnalyzer: parameter.source === 'ANALYZER',
          analyzerCode: parameter.analyzerCode || '',
          analyzerRawValue: parameter.analyzerRawValue || '',
          measuredAt: parameter.measuredAt || ''
        }))
      }
      : null,
    collectedAt: sample.collectedAt || '',
    collectedBy: sample.acceptedBy?.name || '',
    acceptedAt: sample.acceptedAt || '',
    acceptedBy: sample.acceptedBy?.name || '',
    rejectionReason: rejection?.reason || '',
    recollectionReason: (sample.rejections || []).find((entry) => entry.action === 'RECOLLECTION_REQUESTED')?.reason || ''
  };
}

/* The backend keeps one LabSample per order item (one per test), and so does
   this: the laboratory accepts tests one at a time (only the ones whose samples
   have arrived) and enters each result on its own, so collapsing them into one
   row per order threw away exactly the distinction the bench works by. Grouping
   remains available for anything that still wants a per-order summary. */
export function normalizeSampleLogs(rawSamples = [], orderCodeById = {}, { groupByOrder = false } = {}) {
  const logs = rawSamples
    .filter(Boolean)
    .map((sample) => mapSampleLog(sample, orderCodeById))
    .filter((log) => log.orderId);
  if (!groupByOrder) return logs;

  const groups = new Map();
  logs.forEach((log) => {
    const existing = groups.get(log.orderId);
    if (!existing) {
      groups.set(log.orderId, log);
      return;
    }
    log.labItemIds.forEach((code) => { if (!existing.labItemIds.includes(code)) existing.labItemIds.push(code); });
    if (log.acceptedAt && (!existing.acceptedAt || log.acceptedAt > existing.acceptedAt)) existing.acceptedAt = log.acceptedAt;
    if (log.collectedAt && (!existing.collectedAt || log.collectedAt < existing.collectedAt)) existing.collectedAt = log.collectedAt;
  });
  return Array.from(groups.values());
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
    // Whether the visit went on the patient's scheme or was paid for directly,
    // and who took them in - both of which the records desk reads back.
    insuranceUsed: Boolean(visit.insuranceUsed),
    checkedInBy: visit.checkedInBy?.name || '',
    patientName: [visit.patient?.firstName, visit.patient?.lastName].filter(Boolean).join(' '),
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
    customRoleId: user.customRole?.id || '',
    customRoleName: user.customRole?.name || '',
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

/* Scan results carry narrative findings/impression rather than parameters. */
/*
  An accepted scan, one row per requested study.

  The imaging unit works the way the laboratory does: a request may name a chest
  film and an abdominal ultrasound, and the unit takes in whichever it is about
  to do. The backend keeps one ScanAcceptance per order item, so this keeps one
  row per study too, carrying whether its report has been written and what was
  written before where a sent report was pulled back for correction.
*/
/*
  The report on an accepted study.

  An accepted study carries its report, but that nested report does not carry the
  study it belongs to - so normalising it on its own produced a report with no
  patient, no order and no test name. The parent's context is put back first,
  which is exactly what normalizeLabResultFromSample does for a sample.
*/
export function normalizeScanResultFromAcceptance(acceptance, orderCodeById = {}) {
  const result = (acceptance?.scanResults || [])[0];
  if (!result) return null;
  return normalizeScanResult({
    ...result,
    acceptance,
    orderItem: result.orderItem || acceptance.orderItem,
    patient: acceptance.orderItem?.order?.patient
  }, orderCodeById);
}

export function normalizeScanAcceptance(acceptance, orderCodeById = {}) {
  if (!acceptance) return null;
  const orderApiId = acceptance.orderItem?.orderId || acceptance.orderItem?.order?.id || '';
  const orderCode = orderCodeById[orderApiId] || acceptance.orderItem?.order?.orderCode || orderApiId || '';
  const catalogCode = acceptance.orderItem?.catalogItem?.catalogCode || acceptance.orderItem?.catalogItemId || '';
  const result = (acceptance.scanResults || [])[0] || null;
  // As in the laboratory: finished means signed off, not merely written.
  const finished = Boolean(result) && (result.status === 'SIGNED_OFF' || result.status === 'AMENDED');
  const unfinished = Boolean(result) && !finished;
  const returnedReason = unfinished
    ? (result.reviews || []).find((review) => review.decision === 'REVERSED')?.note || ''
    : '';
  return {
    id: acceptance.id,
    apiId: acceptance.id,
    orderId: orderCode,
    orderApiId,
    orderItemId: acceptance.orderItemId || acceptance.orderItem?.id || '',
    patientId: acceptance.orderItem?.order?.patient?.patientCode || '',
    status: SCAN_STATUS_FROM_API[acceptance.status] || enumLabel(acceptance.status),
    catalogCode,
    labItemIds: catalogCode ? [catalogCode] : [],
    testName: acceptance.orderItem?.catalogItem?.name || catalogCode || '',
    modality: acceptance.orderItem?.catalogItem?.modality || '',
    acceptedAt: acceptance.acceptedAt || '',
    acceptedBy: acceptance.acceptedBy?.name || '',
    resultId: result?.id || '',
    resultApiId: result?.id || '',
    resultStatus: enumLabel(result?.status || ''),
    // As in the laboratory: a report counts only once it has been submitted,
    // because pulling a sent report back leaves it a draft so its text survives.
    hasResult: finished,
    returned: Boolean(returnedReason),
    fileCount: (result?.files || []).length,
    dicomCount: (result?.files || []).filter((file) => file.isDicom).length,
    // The attached images themselves, so the viewer can ask for their bytes
    // without going back through the results collection to find them.
    dicomFiles: (result?.files || [])
      .filter((file) => file.isDicom)
      .map((file) => ({
        id: file.id,
        fileName: file.fileName || file.id,
        modality: file.modality || '',
        studyUid: file.studyUid || '',
        seriesUid: file.seriesUid || ''
      })),
    draftResult: unfinished
      ? {
        reason: returnedReason,
        reportText: result.findings || '',
        comment: result.technicianNotes || '',
        parameters: []
      }
      : null
  };
}

export function normalizeScanResult(result, orderCodeById = {}) {
  if (!result) return null;
  const orderApiId = result.orderItem?.orderId || result.orderId;
  return {
    id: result.resultCode || result.id,
    apiId: result.id,
    orderId: orderCodeById[orderApiId] || result.orderItem?.order?.orderCode || orderApiId || '',
    patientId: result.patient?.patientCode || result.patientId || '',
    department: 'Imaging',
    status: LAB_RESULT_STATUS_FROM_API[result.status] || enumLabel(result.status),
    reportText: [result.findings, result.impression].filter(Boolean).join('\n\n'),
    // The unit's comment on the report, written for the clinician.
    comment: result.technicianNotes || '',
    findings: result.findings || '',
    impression: result.impression || '',
    recommendation: result.recommendations || '',
    comparison: result.comparison || '',
    parameters: [],
    abnormal: Boolean(result.abnormal),
    enteredBy: result.reportedBy?.name || result.enteredBy?.name || '',
    submittedAt: result.submittedAt || '',
    signedBy: result.signedOffBy?.name || result.reviews?.[0]?.reviewer?.name || '',
    signedAt: result.signedOffAt || '',
    approvedAt: result.signedOffAt || '',
    approvedBy: result.signedOffBy?.name || result.reviews?.[0]?.reviewer?.name || '',
    // Every reversal (a sent report pulled back by the unit to correct it), newest first.
    versionHistory: (result.amendments || []).map((amendment) => ({
      id: amendment.id,
      changedBy: amendment.amendedBy?.name || '',
      changedAt: amendment.createdAt,
      reason: amendment.reason || '',
      fromStatus: amendment.beforeData?.status ? (LAB_RESULT_STATUS_FROM_API[amendment.beforeData.status] || enumLabel(amendment.beforeData.status)) : '',
      toStatus: amendment.afterData?.status ? (LAB_RESULT_STATUS_FROM_API[amendment.afterData.status] || enumLabel(amendment.afterData.status)) : '',
      findings: amendment.beforeData?.findings || '',
      impression: amendment.beforeData?.impression || ''
    })),
    updatedAt: result.updatedAt || ''
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

/* ------------------------------------------- analyzers that file their own results */

export function normalizeAnalyzerDevice(device) {
  if (!device) return null;
  return {
    id: device.id,
    code: device.deviceCode || device.id,
    name: device.name || '',
    make: device.make || '',
    model: device.model || '',
    serialNumber: device.serialNumber || '',
    // Kept raw as well: the forms and the API both speak the enum.
    protocol: device.protocol || '',
    protocolLabel: ANALYZER_PROTOCOL_LABELS[device.protocol] || enumLabel(device.protocol),
    departmentId: device.departmentId || '',
    departmentName: device.department?.name || '',
    status: enumLabel(device.status),
    rawStatus: device.status || '',
    // Only the opening characters of the key are ever returned, so two can be told apart.
    keyPrefix: device.apiKeyPrefix || '',
    keyIssuedAt: device.apiKeyIssuedAt || '',
    keyLastUsedAt: device.apiKeyLastUsedAt || '',
    autoSubmitForReview: Boolean(device.autoSubmitForReview),
    acceptUnmappedTests: Boolean(device.acceptUnmappedTests),
    lastMessageAt: device.lastMessageAt || '',
    notes: device.notes || '',
    mappingCount: device._count?.testMaps ?? 0,
    messageCount: device._count?.messages ?? 0,
    registeredBy: device.createdBy?.name || '',
    createdAt: device.createdAt || ''
  };
}

export const ANALYZER_PROTOCOL_LABELS = {
  HL7_V2: 'HL7 v2',
  ASTM: 'ASTM',
  CSV: 'Export file (CSV)',
  JSON: 'JSON'
};

export function normalizeAnalyzerTestMap(map) {
  if (!map) return null;
  return {
    id: map.id,
    deviceId: map.deviceId || '',
    // No device means the mapping applies to every analyzer in the facility.
    deviceName: map.device?.name || 'All analyzers',
    analyzerCode: map.analyzerCode || '',
    catalogItemId: map.catalogItemId || '',
    testName: map.catalogItem?.name || '',
    referenceParameterId: map.referenceParameterId || '',
    fieldName: map.referenceParameter?.name || '',
    fieldUnit: map.referenceParameter?.unit || '',
    factor: map.factor === null || map.factor === undefined ? '' : String(map.factor),
    unitOverride: map.unitOverride || '',
    isActive: map.isActive !== false,
    createdBy: map.createdBy?.name || ''
  };
}

export function normalizeAnalyzerMessage(message) {
  if (!message) return null;
  return {
    id: message.id,
    deviceId: message.deviceId || '',
    deviceName: message.device?.name || '',
    protocol: message.device?.protocol || '',
    status: enumLabel(message.status),
    rawStatus: message.status || '',
    analyzerSampleId: message.analyzerSampleId || '',
    sampleCode: message.sample?.sampleCode || '',
    patientName: personName(message.sample?.patient),
    patientCode: message.sample?.patient?.patientCode || '',
    resultCode: message.labResult?.resultCode || '',
    resultStatus: enumLabel(message.labResult?.status),
    applied: message.appliedCount ?? 0,
    skipped: message.skippedCount ?? 0,
    // Why nothing (or only some) of it could be stored, in words the bench can act on.
    reason: message.error || '',
    resolutionNote: message.resolutionNote || '',
    resolvedBy: message.resolvedBy?.name || '',
    resolvedAt: message.resolvedAt || '',
    receivedAt: message.receivedAt || '',
    processedAt: message.processedAt || '',
    contentType: message.contentType || '',
    // Present only on a single-message read, not in the list.
    rawPayload: message.rawPayload || ''
  };
}

export function normalizeAnalyzerUnmappedCode(entry) {
  if (!entry) return null;
  return {
    // The pair is the identity: the same code from two instruments may mean two things.
    id: `${entry.deviceId}:${entry.analyzerCode}`,
    analyzerCode: entry.analyzerCode || '',
    label: entry.label || '',
    unit: entry.sampleUnit || '',
    exampleValue: entry.exampleValue || '',
    deviceId: entry.deviceId || '',
    deviceName: entry.deviceName || '',
    occurrences: entry.occurrences ?? 0,
    lastSeenAt: entry.lastSeenAt || ''
  };
}
