import { createApiClient } from '../api/apiClient';
import { authService } from '../services/authService';
import { doctorService } from '../services/doctorService';
import { orderService } from '../services/orderService';
import { patientService } from '../services/patientService';
import { receptionService } from '../services/receptionService';
import { billingService } from '../services/billingService';
import { financeService } from '../services/financeService';
import { adminService } from '../services/adminService';
import { labService } from '../services/labService';
import { scanService } from '../services/scanService';
import { resultService } from '../services/resultService';
import { notificationService } from '../services/notificationService';
import { listItems, normalizeAuthUser, toApiEnum } from '../api/normalizers';
import { loadCollections } from './hydrate';

/*
  Async command router. Write actions keep their historical dispatch names
  (pages still call dispatch({ type: 'X', payload })), but instead of mutating
  the local demo store they call the backend through the service layer and
  then refresh the affected state. The sync reducer in AppStore.jsx only
  handles UI/local state and hydration set-actions.
*/

export const apiClient = createApiClient({});

function toastAction(type, message) {
  return { type: 'SHOW_TOAST', toast: { type, message } };
}

/* Pages address entities by their display id (order code, invoice code...);
   the API wants the backend id. Normalized entities carry both. */
function requireApiId(collection, displayId, label) {
  const entity = (collection || []).find((item) => item.id === displayId || item.apiId === displayId);
  if (!entity) throw new Error(`${label} ${displayId} was not found in the loaded workspace.`);
  return entity.apiId || entity.id;
}

function splitFullName(fullName = '') {
  const parts = String(fullName).trim().split(/\s+/);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || parts[0] || '' };
}

function toApiPatientPayload(form = {}) {
  const { firstName, lastName } = form.firstName ? form : splitFullName(form.fullName);
  const payload = {
    firstName,
    lastName,
    gender: form.gender ? toApiEnum(form.gender) : undefined,
    dateOfBirth: form.dateOfBirth || undefined,
    phone: form.phone || undefined,
    email: form.email || undefined,
    address: form.address || undefined,
    nationalId: form.nationalId || undefined,
    insuranceProvider: form.insuranceProvider || undefined,
    policyNumber: form.policyNumber || undefined,
    emergencyContact: form.emergencyContact || undefined,
    allergiesAndConditions: form.allergies || form.allergiesAndConditions || undefined,
    hospitalId: form.hospitalId || undefined,
    referringDoctorId: form.referringDoctorId || undefined
  };
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== ''));
}

function refresh(dispatch, getState, names) {
  return loadCollections(apiClient, getState().auth, dispatch, names);
}

/* Result parameter payloads: backend requires non-empty string values and
   Prisma ResultFlag enums. */
function toApiParameters(parameters = []) {
  return parameters
    .filter((parameter) => String(parameter.value ?? '').trim() !== '')
    .map((parameter) => ({
      name: parameter.name,
      value: String(parameter.value),
      unit: parameter.unit || undefined,
      flag: toApiEnum(parameter.flag || 'Pending'),
      referenceRange: parameter.referenceRange || undefined,
      notes: parameter.notes || undefined
    }));
}

/* Accepted samples are fetched fresh at command time: hydrated results only
   cover samples that already have a result, but sample-level actions need the
   sample id before any result exists. */
async function findLabSampleForOrder(orderApiId) {
  const payload = await labService.acceptedSamples(apiClient, { limit: 100 });
  return listItems(payload).find((sample) => sample.orderItem?.orderId === orderApiId) || null;
}

async function findLabSampleByCode(sampleCode) {
  const payload = await labService.acceptedSamples(apiClient, { limit: 100 });
  return listItems(payload).find((sample) => sample.sampleCode === sampleCode || sample.id === sampleCode) || null;
}

/* A recollection can be requested on an already-rejected sample, which no
   longer appears in the accepted list, so search both accepted and rejected. */
async function findLabSampleAnywhere(sampleCode) {
  const [accepted, rejected] = await Promise.all([
    labService.acceptedSamples(apiClient, { limit: 100 }).catch(() => null),
    labService.rejectedRetest(apiClient, { limit: 100 }).catch(() => null)
  ]);
  return [...listItems(accepted), ...listItems(rejected)]
    .find((sample) => sample.sampleCode === sampleCode || sample.id === sampleCode) || null;
}

function findReportForOrder(getState, orderId) {
  return (getState().data.resultReports || []).find((report) => report.orderId === orderId) || null;
}

function scanItemForOrder(order) {
  return (order?.orderItems || []).find((item) => item.type === 'Scan') || null;
}

/* UI payment-method labels -> Prisma PaymentMethod enum. */
function toApiPaymentMethod(method) {
  const value = String(method || '').toLowerCase();
  if (value.includes('cash')) return 'CASH';
  if (value.includes('momo') || value.includes('mobile')) return 'MOBILE_MONEY';
  if (value.includes('card')) return 'CARD';
  if (value.includes('transfer') || value.includes('bank') || value.includes('cheque')) return 'BANK_TRANSFER';
  if (value.includes('insurance')) return 'INSURANCE';
  return 'OTHER';
}

const commands = {
  LOGIN_WITH_CREDENTIALS: async (action, dispatch) => {
    const data = await authService.login(apiClient, {
      username: String(action.username || '').trim(),
      password: String(action.password || '')
    });
    const auth = normalizeAuthUser(data?.user);
    if (!auth) throw new Error('Login response did not include a user profile.');
    dispatch({ type: 'SET_AUTH', auth, navigate: auth.landing });
    dispatch(toastAction('success', `Welcome, ${auth.userName}`));
  },

  LOGOUT: async (_action, dispatch) => {
    try {
      await authService.logout(apiClient);
    } catch {
      // Session is cleared locally regardless; the cookie may already be gone.
    }
    dispatch({ type: 'SET_AUTH', auth: null, navigate: 'login' });
    dispatch(toastAction('success', 'Signed out'));
  },

  /* ------------------------------------------------ doctor + core orders */

  CREATE_DOCTOR_ORDER: async (action, dispatch, getState) => {
    const payload = action.payload || {};
    let patientId = payload.patientId;
    if (payload.patientMode === 'new' && payload.newPatient) {
      const created = await patientService.create(apiClient, toApiPatientPayload(payload.newPatient));
      patientId = created?.patient?.id || created?.id;
    }
    if (!patientId) throw new Error('Select or register a patient before submitting the order.');
    await doctorService.createOrder(apiClient, {
      patientId,
      hospitalId: payload.hospitalId || undefined,
      urgency: toApiEnum(payload.urgency || 'Routine'),
      clinicalNotes: payload.clinicalNotes || undefined,
      items: (payload.itemIds || []).map((catalogItemId) => ({ catalogItemId }))
    });
    await refresh(dispatch, getState, ['orders', 'invoices', 'patients']);
    dispatch(toastAction('success', 'Order submitted to the diagnosis center'));
  },

  TRANSITION_ORDER: async (action, dispatch, getState) => {
    const { orderId, nextStatus, reason } = action.payload || {};
    const apiId = requireApiId(getState().data.orders, orderId, 'Order');
    if (toApiEnum(nextStatus) === 'CANCELLED') {
      await orderService.cancel(apiClient, apiId, { reason: reason || 'Cancelled from workspace' });
    } else {
      await orderService.transition(apiClient, apiId, { nextStatus: toApiEnum(nextStatus), reason: reason || undefined });
    }
    await refresh(dispatch, getState, ['orders', 'invoices']);
    dispatch(toastAction('success', `${orderId} moved to ${nextStatus}`));
  },

  UPDATE_BILLING_STATUS: async (action, dispatch, getState) => {
    const { orderId, billingStatus } = action.payload || {};
    const invoice = (getState().data.invoices || []).find((item) => item.orderId === orderId);
    if (!invoice) throw new Error(`No invoice found for ${orderId}.`);
    await billingService.updateInvoice(apiClient, invoice.apiId, { status: toApiEnum(billingStatus) });
    await refresh(dispatch, getState, ['invoices', 'orders']);
    dispatch(toastAction('success', `Billing for ${orderId} set to ${billingStatus}`));
  },

  CREATE_PATIENT: async (action, dispatch, getState) => {
    await patientService.create(apiClient, toApiPatientPayload(action.payload));
    await refresh(dispatch, getState, ['patients']);
    dispatch(toastAction('success', 'Patient record created'));
  },

  UPDATE_PATIENT: async (action, dispatch, getState) => {
    const apiId = requireApiId(getState().data.patients, action.patientId, 'Patient');
    await patientService.update(apiClient, apiId, toApiPatientPayload(action.payload));
    await refresh(dispatch, getState, ['patients']);
    dispatch(toastAction('success', 'Patient record updated'));
  },

  /* ------------------------------------------------------- reception */

  CONFIRM_RECEPTION_ORDER: async (action, dispatch, getState) => {
    const apiId = requireApiId(getState().data.orders, action.orderId, 'Order');
    await receptionService.confirmOrder(apiClient, apiId, { invoiceNow: true, notes: action.payload?.receptionNotes || undefined });
    await refresh(dispatch, getState, ['orders', 'invoices', 'notifications']);
    dispatch(toastAction('success', `${action.orderId} confirmed and invoiced`));
  },

  CHECK_IN_PATIENT: async (action, dispatch, getState) => {
    const payload = action.payload || {};
    const orderApiId = payload.orderId ? requireApiId(getState().data.orders, payload.orderId, 'Order') : undefined;
    await receptionService.checkIn(apiClient, {
      patientId: payload.patientId,
      orderId: orderApiId,
      identityVerified: payload.identityVerified !== false,
      notes: payload.notes || undefined
    });
    await refresh(dispatch, getState, ['dailyVisits', 'orders']);
    dispatch(toastAction('success', 'Patient checked in'));
  },

  CREATE_WALK_IN_PATIENT: async (action, dispatch, getState) => {
    const created = await patientService.create(apiClient, toApiPatientPayload(action.payload));
    const patientId = created?.patient?.id || created?.id;
    await receptionService.checkIn(apiClient, { patientId, identityVerified: true, visitType: 'Walk-in', notes: 'Walk-in registration' });
    await refresh(dispatch, getState, ['patients', 'dailyVisits']);
    const visit = (getState().data.dailyVisits || []).find((item) => item.patientId === patientId && item.walkIn);
    dispatch({ type: 'START_WALK_IN_TEST_REQUEST', payload: { patientId, visitId: visit?.id || '' } });
    dispatch(toastAction('success', 'Walk-in patient registered and checked in'));
  },

  CREATE_RECEPTION_WALK_IN_ORDER: async (action, dispatch, getState) => {
    const payload = action.payload || {};
    if (!payload.patientId) throw new Error('Select a walk-in patient first.');
    if (!(payload.itemIds || []).length) throw new Error('Add at least one test or scan.');
    await receptionService.walkIn(apiClient, {
      patientId: payload.patientId,
      hospitalId: payload.hospitalId || undefined,
      requestedItems: payload.itemIds.map((catalogItemId) => ({ catalogItemId })),
      invoiceNow: true,
      checkInNow: false,
      notes: payload.clinicalNotes || undefined
    });
    await refresh(dispatch, getState, ['orders', 'invoices', 'dailyVisits']);
    dispatch(toastAction('success', 'Walk-in test request created and routed'));
  },

  CREATE_APPOINTMENT: async (action, dispatch, getState) => {
    const payload = action.payload || {};
    const orderApiId = payload.orderId ? requireApiId(getState().data.orders, payload.orderId, 'Order') : undefined;
    await receptionService.createAppointment(apiClient, {
      patientId: payload.patientId,
      orderId: orderApiId,
      scheduledDate: payload.scheduledAt || payload.scheduledDate,
      type: payload.purpose || payload.type || 'Visit',
      roomOrArea: payload.room || payload.roomOrArea || undefined,
      notes: payload.notes || undefined
    });
    await refresh(dispatch, getState, ['appointments']);
    dispatch(toastAction('success', 'Appointment scheduled'));
  },

  UPDATE_APPOINTMENT_STATUS: async (action, dispatch, getState) => {
    const { appointmentId, status, reason } = action.payload || {};
    const apiId = requireApiId(getState().data.appointments, appointmentId, 'Appointment');
    await receptionService.updateAppointment(apiClient, apiId, { status: toApiEnum(status), notes: reason || undefined });
    await refresh(dispatch, getState, ['appointments']);
    dispatch(toastAction('success', `Appointment ${appointmentId} ${String(status).toLowerCase()}`));
  },

  /* ---------------------------------------------------------------- lab */

  ACCEPT_LAB_SAMPLE: async (action, dispatch, getState) => {
    const orderApiId = requireApiId(getState().data.orders, action.orderId, 'Order');
    await labService.acceptSample(apiClient, orderApiId, {
      sampleType: action.payload?.sampleType || undefined,
      barcode: action.payload?.barcode || undefined,
      notes: action.payload?.notes || undefined
    });
    await refresh(dispatch, getState, ['orders', 'results', 'sampleLogs']);
    dispatch(toastAction('success', `Sample accepted for ${action.orderId}`));
  },

  /* The Sample Log "log new sample" form accepts every eligible lab item on the
     chosen order (the backend uses the authenticated user as collector). */
  ADD_SAMPLE_LOG: async (action, dispatch, getState) => {
    const payload = action.payload || {};
    if (!payload.orderId) throw new Error('Select a lab order before logging a sample.');
    const orderApiId = requireApiId(getState().data.orders, payload.orderId, 'Order');
    await labService.acceptSample(apiClient, orderApiId, {
      sampleType: payload.sampleType || undefined,
      collectedAt: payload.collectedAt || undefined,
      notes: payload.notes || undefined
    });
    await refresh(dispatch, getState, ['orders', 'results', 'sampleLogs']);
    dispatch(toastAction('success', `Sample logged for ${payload.orderId}`));
  },

  BATCH_ACCEPT_LAB_SAMPLES: async (action, dispatch, getState) => {
    const orderIds = action.orderIds || action.payload?.orderIds || [];
    for (const orderId of orderIds) {
      const orderApiId = requireApiId(getState().data.orders, orderId, 'Order');
      await labService.acceptSample(apiClient, orderApiId, {});
    }
    await refresh(dispatch, getState, ['orders', 'results', 'sampleLogs']);
    dispatch(toastAction('success', `${orderIds.length} sample(s) accepted`));
  },

  REJECT_SAMPLE: async (action, dispatch, getState) => {
    const sample = await findLabSampleByCode(action.sampleId);
    if (!sample) throw new Error(`Sample ${action.sampleId} was not found among accepted samples.`);
    await labService.rejectSample(apiClient, sample.id, {
      reason: action.reason || 'Rejected at the bench',
      requestRecollection: Boolean(action.requestRecollection)
    });
    await refresh(dispatch, getState, ['orders', 'results', 'sampleLogs']);
    dispatch(toastAction('success', `Sample ${action.sampleId} rejected`));
  },

  REQUEST_SAMPLE_RECOLLECTION: async (action, dispatch, getState) => {
    const sample = await findLabSampleAnywhere(action.sampleId);
    if (!sample) throw new Error(`Sample ${action.sampleId} was not found.`);
    await labService.rejectSample(apiClient, sample.id, {
      reason: action.reason || 'Recollection requested',
      requestRecollection: true
    });
    await refresh(dispatch, getState, ['orders', 'results', 'sampleLogs']);
    dispatch(toastAction('success', `Recollection requested for ${action.sampleId}`));
  },

  /* The demo's single "push to clinician" walks the backend's full chain:
     save the entered result, submit it for review, sign it off (report is
     generated server-side), then release it to the clinician. */
  PUSH_LAB_RESULT_TO_CLINICIAN: async (action, dispatch, getState) => {
    const payload = action.payload || {};
    const orderApiId = requireApiId(getState().data.orders, payload.orderId, 'Order');
    const sample = await findLabSampleForOrder(orderApiId);
    if (!sample) throw new Error(`No accepted sample found for ${payload.orderId}. Accept the sample first.`);

    const parameters = toApiParameters(payload.parameters);
    if (!parameters.length) throw new Error('Enter at least one result value before pushing to the clinician.');

    const saved = await labService.saveResult(apiClient, {
      sampleId: sample.id,
      overallComment: payload.reportText || undefined,
      parameters
    });
    const resultApiId = saved?.result?.id || saved?.id || sample.results?.[0]?.id;
    if (!resultApiId) throw new Error('The laboratory result id was not returned by the server.');

    await labService.submitReview(apiClient, { resultId: resultApiId, notes: payload.technicianNotes || undefined });
    await labService.signOff(apiClient, resultApiId, { decision: 'SIGNED_OFF' });

    // Release is a separate permission; if this role cannot release, the
    // signed-off report stays queued for reception/admin.
    let released = false;
    try {
      await refresh(dispatch, getState, ['resultReports']);
      const report = findReportForOrder(getState, payload.orderId);
      if (report) {
        await resultService.release(apiClient, report.apiId, { notifyDoctor: true, notifyReception: true });
        released = true;
      }
    } catch {
      released = false;
    }

    await refresh(dispatch, getState, ['orders', 'results', 'sampleLogs', 'resultReports', 'notifications', 'deliveryLogs']);
    dispatch(toastAction('success', released
      ? `Result for ${payload.orderId} signed off and released to the clinician`
      : `Result for ${payload.orderId} signed off — awaiting release`));
  },

  APPROVE_DEPARTMENT_RESULT: async (action, dispatch, getState) => {
    const { orderId, department, approverNote } = action.payload || {};
    const result = (getState().data.results || []).find((item) => item.orderId === orderId && item.department === department && item.status === 'Pending Review');
    if (!result) throw new Error(`No pending ${department} result found for ${orderId}.`);
    const service = department === 'Imaging' ? scanService : labService;
    await service.signOff(apiClient, result.apiId, { decision: 'SIGNED_OFF', reviewerComment: approverNote || undefined });
    await refresh(dispatch, getState, ['orders', 'results', 'resultReports', 'notifications']);
    dispatch(toastAction('success', `${department} result for ${orderId} signed off`));
  },

  UPDATE_LAB_RESULT_ARCHIVE: async (action, dispatch, getState) => {
    const result = (getState().data.results || []).find((item) => item.id === action.resultId);
    if (!result) throw new Error(`Result ${action.resultId} was not found.`);
    await labService.saveResult(apiClient, {
      resultId: result.apiId,
      overallComment: action.payload?.reportText || undefined,
      parameters: toApiParameters(action.payload?.parameters)
    });
    await refresh(dispatch, getState, ['results', 'resultReports']);
    dispatch(toastAction('success', 'Laboratory result corrected and versioned'));
  },

  SIGN_LAB_RESULT_WITH_SIGNATURE: async (action, dispatch, getState) => {
    const result = (getState().data.results || []).find((item) => item.id === action.resultId);
    if (!result) throw new Error(`Result ${action.resultId} was not found.`);
    if (result.status !== 'Pending Review') {
      await labService.submitReview(apiClient, { resultId: result.apiId, notes: 'Re-sign after correction' }).catch(() => {});
    }
    await labService.signOff(apiClient, result.apiId, {
      decision: 'SIGNED_OFF',
      reviewerComment: [action.payload?.signedBy ? `Signed by ${action.payload.signedBy}` : '', action.payload?.note || ''].filter(Boolean).join(' — ') || undefined
    });
    await refresh(dispatch, getState, ['results', 'resultReports', 'notifications']);
    dispatch(toastAction('success', 'Result signed off'));
  },

  /* ---------------------------------------------------------------- scan */

  ACCEPT_SCAN_ORDER: async (action, dispatch, getState) => {
    const orderApiId = requireApiId(getState().data.orders, action.orderId, 'Order');
    await scanService.acceptScan(apiClient, orderApiId, { notes: action.payload?.technicianNotes || undefined });
    await refresh(dispatch, getState, ['orders']);
    dispatch(toastAction('success', `Scan accepted for ${action.orderId}`));
  },

  REJECT_SCAN_ORDER: async (action, dispatch, getState) => {
    const { orderId, reason, actionNeeded } = action.payload || {};
    // A retake targets an existing imaging result; the backend has no
    // pre-result rejection for scans.
    const result = (getState().data.results || []).find((item) => item.orderId === orderId && item.department === 'Imaging');
    if (!result) throw new Error(`No imaging result exists for ${orderId} yet — save the report first, then request a retake.`);
    await scanService.retake(apiClient, {
      resultId: result.apiId,
      reason: reason || 'Retake required',
      notes: actionNeeded || undefined
    });
    await refresh(dispatch, getState, ['orders', 'results']);
    dispatch(toastAction('success', `Retake recorded for ${orderId}`));
  },

  ADD_SCAN_BOOKING: async (action, dispatch, getState) => {
    const payload = action.payload || {};
    const order = (getState().data.orders || []).find((item) => item.id === payload.orderId);
    if (!order) throw new Error(`Order ${payload.orderId} was not found.`);
    const item = scanItemForOrder(order);
    const equipment = (getState().data.equipment || []).find((eq) => (
      eq.id === payload.equipmentId || eq.name === payload.machine || (payload.room && eq.room === payload.room && eq.modality === payload.modality)
    ));
    if (!equipment) throw new Error('Select a known equipment/room for the booking.');
    await scanService.createBooking(apiClient, {
      patientId: order.patientId,
      orderItemId: item?.id || undefined,
      equipmentId: equipment.id,
      scheduledAt: payload.bookedAt || new Date().toISOString(),
      notes: payload.technicianNotes || undefined
    });
    await refresh(dispatch, getState, ['scanBookings']);
    dispatch(toastAction('success', `Equipment booked for ${payload.orderId}`));
  },

  SAVE_SCAN_REPORT: async (action, dispatch, getState) => {
    const payload = action.payload || {};
    const order = (getState().data.orders || []).find((item) => item.id === payload.orderId);
    const item = scanItemForOrder(order);
    if (!item) throw new Error(`No scan item found on ${payload.orderId}.`);
    const saved = await scanService.saveReport(apiClient, {
      orderItemId: item.id,
      findings: payload.findings,
      impression: payload.impression,
      recommendation: payload.internalNotes || undefined
    });
    const resultApiId = saved?.result?.id || saved?.id;
    if (resultApiId) {
      await scanService.submitReview(apiClient, { resultId: resultApiId }).catch(() => {});
    }
    await refresh(dispatch, getState, ['orders', 'results']);
    dispatch(toastAction('success', `Imaging report for ${payload.orderId} submitted for review`));
  },

  /* ----------------------------------------------------- results delivery */

  PREPARE_RESULT_DELIVERY: async (action, dispatch, getState) => {
    const report = findReportForOrder(getState, action.orderId);
    if (!report) throw new Error(`No generated report found for ${action.orderId} yet.`);
    await resultService.release(apiClient, report.apiId, { notifyDoctor: true, notifyReception: true });
    await refresh(dispatch, getState, ['orders', 'resultReports', 'notifications', 'deliveryLogs']);
    dispatch(toastAction('success', `Result for ${action.orderId} released and delivery notices queued`));
  },

  SEND_RESULT_TO_PATIENT: async (action, dispatch, getState) => {
    const { orderId, channel } = action.payload || {};
    const report = findReportForOrder(getState, orderId);
    if (!report) throw new Error(`No generated report found for ${orderId} yet.`);
    const order = (getState().data.orders || []).find((item) => item.id === orderId);
    const patient = (getState().data.patients || []).find((item) => item.id === order?.patientId);
    const wantsEmail = /email/i.test(channel || '');
    const wantsWhatsapp = /whatsapp/i.test(channel || '');
    const recipient = wantsEmail ? patient?.email : patient?.phone;
    if (!recipient) throw new Error(`The patient has no ${wantsEmail ? 'email address' : 'phone number'} on record.`);
    const sender = wantsEmail ? resultService.email : wantsWhatsapp ? resultService.whatsapp : resultService.sms;
    await sender(apiClient, report.apiId, { recipient });
    await refresh(dispatch, getState, ['notifications', 'deliveryLogs']);
    dispatch(toastAction('success', `Privacy-safe ${wantsEmail ? 'email' : wantsWhatsapp ? 'WhatsApp' : 'SMS'} notice sent`));
  },

  RETRY_DELIVERY_NOTIFICATION: async (action, dispatch, getState) => {
    await resultService.retryDelivery(apiClient, action.notificationId, {});
    await refresh(dispatch, getState, ['notifications', 'deliveryLogs']);
    dispatch(toastAction('success', 'Delivery retried'));
  },

  MARK_NOTIFICATION_DELIVERED: async (action, dispatch, getState) => {
    await notificationService.markRead(apiClient, action.notificationId);
    await refresh(dispatch, getState, ['notifications']);
  },

  MARK_DOCTOR_NOTIFICATION_READ: async (action, dispatch, getState) => {
    await notificationService.markRead(apiClient, action.notificationId);
    await refresh(dispatch, getState, ['notifications']);
  },

  MARK_REPORT_DOWNLOADED: async (action, dispatch, getState) => {
    const report = (getState().data.resultReports || []).find((item) => item.id === action.reportId || item.orderId === action.orderId);
    if (report) {
      await resultService.report(apiClient, report.apiId).catch(() => {});
      await refresh(dispatch, getState, ['resultReports']);
    }
  },

  /* --------------------------------------------------- billing & finance */

  UPDATE_INVOICE: async (action, dispatch, getState) => {
    const payload = action.payload || {};
    const apiId = requireApiId(getState().data.invoices, payload.invoiceId, 'Invoice');
    await billingService.updateInvoice(apiClient, apiId, {
      status: payload.status ? toApiEnum(payload.status) : undefined,
      discountAmount: payload.discount !== undefined && payload.discount !== '' ? Number(payload.discount) : undefined,
      insuranceClaimNumber: payload.insuranceReference || undefined
    });
    await refresh(dispatch, getState, ['invoices', 'orders']);
    dispatch(toastAction('success', `Invoice ${payload.invoiceId} updated`));
  },

  RECORD_PAYMENT: async (action, dispatch, getState) => {
    const payload = action.payload || {};
    const apiId = requireApiId(getState().data.invoices, payload.invoiceId, 'Invoice');
    await billingService.recordPayment(apiClient, apiId, {
      amount: Number(payload.amount),
      method: toApiPaymentMethod(payload.method),
      reference: payload.reference || undefined
    });
    await refresh(dispatch, getState, ['invoices', 'orders', 'financeShifts']);
    dispatch(toastAction('success', `Payment recorded on ${payload.invoiceId}`));
  },

  REFUND_OR_ADJUST_INVOICE: async (action, dispatch, getState) => {
    const payload = action.payload || {};
    const apiId = requireApiId(getState().data.invoices, payload.invoiceId, 'Invoice');
    await billingService.refund(apiClient, apiId, {
      amount: Number(payload.amount),
      reason: payload.reason,
      supervisorApprovalId: payload.supervisorCode || payload.supervisorApprovalId || 'SUPERVISOR'
    });
    await refresh(dispatch, getState, ['invoices', 'orders', 'financeShifts']);
    dispatch(toastAction('success', `Refund/adjustment recorded on ${payload.invoiceId}`));
  },

  START_FINANCE_SHIFT: async (action, dispatch, getState) => {
    const payload = action.payload || {};
    await financeService.startShift(apiClient, {
      openingFloat: Number(payload.openingFloat || 0),
      notes: payload.notes || undefined
    });
    await refresh(dispatch, getState, ['financeShifts']);
    dispatch(toastAction('success', 'Cashier shift started'));
  },

  CLOSE_FINANCE_SHIFT: async (action, dispatch, getState) => {
    const payload = action.payload || {};
    const apiId = requireApiId(getState().data.financeShifts, action.shiftId, 'Shift');
    await financeService.closeShift(apiClient, apiId, {
      closingCash: Number(payload.actualCash || 0),
      notes: payload.notes || undefined
    });
    await refresh(dispatch, getState, ['financeShifts']);
    dispatch(toastAction('success', `Shift ${action.shiftId} closed`));
  },

  CREATE_FLOAT_ADJUSTMENT: async (action, dispatch, getState) => {
    const payload = action.payload || {};
    await financeService.adjustFloat(apiClient, {
      type: /out/i.test(payload.type) ? 'MONEY_OUT' : /in/i.test(payload.type) ? 'MONEY_IN' : 'ADJUSTMENT',
      amount: Number(payload.amount),
      reason: payload.description || payload.reason || 'Float adjustment'
    });
    await refresh(dispatch, getState, ['financeShifts']);
    dispatch(toastAction('success', 'Float adjustment recorded'));
  },

  CREATE_EXPENSE: async (action, dispatch, getState) => {
    const payload = action.payload || {};
    await financeService.createExpense(apiClient, {
      vendorName: payload.vendor || 'Unspecified vendor',
      category: payload.category || 'General',
      description: payload.description,
      amount: Number(payload.amount),
      notes: payload.notes || undefined
    });
    await refresh(dispatch, getState, ['expenses']);
    dispatch(toastAction('success', 'Expense recorded'));
  },

  RECORD_EXPENSE_PAYMENT: async (action, dispatch, getState) => {
    const payload = action.payload || {};
    const apiId = requireApiId(getState().data.expenses, payload.expenseId, 'Expense');
    await financeService.payExpense(apiClient, apiId, {
      amount: Number(payload.amount),
      method: toApiPaymentMethod(payload.method)
    });
    await refresh(dispatch, getState, ['expenses', 'financeShifts']);
    dispatch(toastAction('success', `Payment recorded on ${payload.expenseId}`));
  },

  WRITE_OFF_EXPENSE: async (action, dispatch, getState) => {
    const payload = action.payload || {};
    const apiId = requireApiId(getState().data.expenses, payload.expenseId, 'Expense');
    await financeService.writeOffExpense(apiClient, apiId, {
      reason: payload.reason,
      supervisorApprovalId: payload.supervisorCode || 'SUPERVISOR'
    });
    await refresh(dispatch, getState, ['expenses']);
    dispatch(toastAction('success', `Expense ${payload.expenseId} written off`));
  },

  UPDATE_CATALOG_PRICE: async (action, dispatch, getState) => {
    const payload = action.payload || {};
    const apiId = requireApiId(getState().data.catalog, payload.itemId, 'Catalog item');
    await adminService.updateCatalogItem(apiClient, apiId, {
      price: Number(payload.price),
      expectedCompletionHours: payload.expectedHours ? Number(payload.expectedHours) : undefined
    });
    await refresh(dispatch, getState, ['catalog']);
    dispatch(toastAction('success', `Price updated for ${payload.itemId}`));
  },

  /* ---------------------------------------------------------------- admin */

  ADMIN_CREATE_USER: async (action, dispatch, getState) => {
    const form = action.payload || {};
    await adminService.createUser(apiClient, {
      name: form.name,
      username: form.username,
      email: form.email || undefined,
      role: toApiEnum(form.role) === 'LAB' ? 'LAB_STAFF' : toApiEnum(form.role) === 'SCAN' ? 'SCAN_STAFF' : toApiEnum(form.role) === 'BILLING' ? 'BILLING_STAFF' : toApiEnum(form.role),
      password: form.password || form.tempPassword || 'ChangeMe123!'
    });
    await refresh(dispatch, getState, ['users']);
    dispatch(toastAction('success', `User ${form.username} created`));
  },

  ADMIN_UPDATE_USER: async (action, dispatch, getState) => {
    const form = action.payload || {};
    const userId = action.userId || form.id;
    await adminService.updateUser(apiClient, userId, {
      name: form.name || undefined,
      email: form.email || undefined,
      status: form.status ? toApiEnum(form.status) : undefined
    });
    await refresh(dispatch, getState, ['users']);
    dispatch(toastAction('success', 'User updated'));
  },

  /* The Hospitals page manages partner facilities; the backend model for
     both is the Hospital resource. */
  ADMIN_CREATE_FACILITY: async (action, dispatch, getState) => {
    await commands.ADMIN_CREATE_HOSPITAL(action, dispatch, getState);
  },

  ADMIN_UPDATE_FACILITY: async (action, dispatch, getState) => {
    await commands.ADMIN_UPDATE_HOSPITAL({ ...action, hospitalId: action.facilityId || action.hospitalId }, dispatch, getState);
  },

  ADMIN_CREATE_HOSPITAL: async (action, dispatch, getState) => {
    const form = action.payload || {};
    await adminService.createHospital(apiClient, {
      name: form.name,
      code: form.code || form.name?.slice(0, 12).replace(/\s+/g, '-') || 'HOSP',
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      billingContact: form.billingContact || undefined,
      accountStatus: form.accountStatus || 'Active'
    });
    await refresh(dispatch, getState, ['hospitals']);
    dispatch(toastAction('success', `${form.name} added as a partner facility`));
  },

  ADMIN_UPDATE_HOSPITAL: async (action, dispatch, getState) => {
    const form = action.payload || {};
    const hospitalId = action.hospitalId || form.id;
    await adminService.updateHospital(apiClient, hospitalId, {
      name: form.name || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      billingContact: form.billingContact || undefined,
      accountStatus: form.accountStatus || undefined
    });
    await refresh(dispatch, getState, ['hospitals']);
    dispatch(toastAction('success', 'Facility updated'));
  },

  ADMIN_CREATE_CATALOG_ITEM: async (action, dispatch, getState) => {
    const form = action.payload || {};
    const isLab = /lab/i.test(form.type || '');
    await adminService.createCatalogItem(apiClient, {
      catalogCode: form.id || form.catalogCode || `${isLab ? 'LAB' : 'SCN'}-${Date.now().toString(36).toUpperCase()}`,
      name: form.name,
      type: isLab ? 'LAB' : 'SCAN',
      price: Number(form.price || 0),
      expectedCompletionHours: Number(form.expectedHours || 24),
      sampleType: isLab ? (form.sampleType || 'Blood') : undefined,
      modality: !isLab ? (form.modality || 'General') : undefined,
      aliases: form.searchText ? String(form.searchText).split(/\s+/).filter(Boolean).slice(0, 10) : []
    });
    await refresh(dispatch, getState, ['catalog']);
    dispatch(toastAction('success', `${form.name} added to the catalog`));
  },

  ADMIN_UPDATE_CATALOG_ITEM: async (action, dispatch, getState) => {
    const form = action.payload || {};
    const apiId = requireApiId(getState().data.catalog, action.itemId || form.id, 'Catalog item');
    await adminService.updateCatalogItem(apiClient, apiId, {
      name: form.name || undefined,
      price: form.price !== undefined && form.price !== '' ? Number(form.price) : undefined,
      expectedCompletionHours: form.expectedHours ? Number(form.expectedHours) : undefined,
      sampleType: form.sampleType || undefined,
      modality: form.modality || undefined,
      isActive: form.isActive
    });
    await refresh(dispatch, getState, ['catalog']);
    dispatch(toastAction('success', 'Catalog item updated'));
  },

  ADMIN_CREATE_DEPARTMENT: async (action, dispatch, getState) => {
    const form = action.payload || {};
    await adminService.departments.create(apiClient, {
      name: form.name,
      code: form.code || form.name?.slice(0, 6).toUpperCase(),
      type: toApiEnum(form.type || 'Laboratory'),
      leadName: form.leadName || form.lead || undefined
    });
    await refresh(dispatch, getState, ['departments']);
    dispatch(toastAction('success', `${form.name} department created`));
  },

  ADMIN_UPDATE_DEPARTMENT: async (action, dispatch, getState) => {
    const form = action.payload || {};
    const departmentId = action.departmentId || form.id;
    await adminService.departments.update(apiClient, departmentId, {
      name: form.name || undefined,
      leadName: form.leadName || form.lead || undefined,
      isActive: form.isActive
    });
    await refresh(dispatch, getState, ['departments']);
    dispatch(toastAction('success', 'Department updated'));
  },

  ADMIN_CREATE_EQUIPMENT: async (action, dispatch, getState) => {
    const form = action.payload || {};
    await adminService.equipment.create(apiClient, {
      name: form.name,
      departmentId: form.departmentId || undefined,
      room: form.room || undefined,
      modality: form.modality || undefined,
      serialNumber: form.serialNumber || undefined,
      status: form.status ? toApiEnum(form.status) : undefined,
      serviceDueDate: form.serviceDue || undefined,
      notes: form.notes || undefined
    });
    await refresh(dispatch, getState, ['equipment']);
    dispatch(toastAction('success', `${form.name} added to equipment`));
  },

  ADMIN_UPDATE_EQUIPMENT: async (action, dispatch, getState) => {
    const form = action.payload || {};
    const equipmentId = action.equipmentId || form.id;
    await adminService.equipment.update(apiClient, equipmentId, {
      name: form.name || undefined,
      room: form.room || undefined,
      status: form.status ? toApiEnum(form.status) : undefined,
      serviceDueDate: form.serviceDue || undefined,
      notes: form.notes || undefined
    });
    await refresh(dispatch, getState, ['equipment']);
    dispatch(toastAction('success', 'Equipment updated'));
  },

  UPDATE_DOCTOR_PROFILE: async (action, dispatch, getState) => {
    await doctorService.updateProfile(apiClient, action.payload || {});
    await refresh(dispatch, getState, ['doctors']);
    dispatch(toastAction('success', 'Profile updated'));
  },

  UPDATE_NOTIFICATION_PREFS: async (action, dispatch, getState) => {
    const payload = action.payload || {};
    await doctorService.updateProfile(apiClient, {
      notificationEmail: payload.email !== undefined ? Boolean(payload.email) : undefined,
      notificationSms: payload.sms !== undefined ? Boolean(payload.sms) : undefined
    });
    await refresh(dispatch, getState, ['doctors']);
    dispatch(toastAction('success', 'Notification preferences saved'));
  },

  ADMIN_UPDATE_NOTIFICATION_SETTINGS: async (action, dispatch, getState) => {
    await notificationService.updateSettings(apiClient, action.payload || {});
    dispatch({ type: 'SET_COLLECTIONS', collections: { notificationSettings: { ...getState().data.notificationSettings, ...(action.payload || {}) } } });
    dispatch(toastAction('success', 'Notification settings saved'));
  }
};

export function hasCommand(type) {
  return Object.prototype.hasOwnProperty.call(commands, type);
}

export async function runCommand(action, dispatch, getState) {
  const handler = commands[action.type];
  if (!handler) return;
  try {
    await handler(action, dispatch, getState);
  } catch (error) {
    const message = error?.message || 'Request failed. Please try again.';
    dispatch(toastAction('error', message));
  }
}
