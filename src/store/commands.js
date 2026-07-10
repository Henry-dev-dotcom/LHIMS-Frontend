import { createApiClient } from '../api/apiClient';
import { authService } from '../services/authService';
import { doctorService } from '../services/doctorService';
import { orderService } from '../services/orderService';
import { patientService } from '../services/patientService';
import { receptionService } from '../services/receptionService';
import { billingService } from '../services/billingService';
import { normalizeAuthUser, toApiEnum } from '../api/normalizers';
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
