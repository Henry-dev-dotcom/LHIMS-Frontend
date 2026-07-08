import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { seedData } from '../data/seedData';
import { ROLES } from '../data/roles';
import { createOrder, transitionOrder, updateBillingStatus, idWithPrefix, addAudit, nowIso, createResultDeliveryBundle, retryDeliveryNotification, markReportDownloaded } from '../workflow/workflowEngine';
import { buildParameterEntries, computeResultFlag } from '../utils/labFlags';
import { apiClient, hasCommand, runCommand } from './commands';
import { authService } from '../services/authService';
import { getStoredSession } from '../api/config';
import { normalizeAuthUser } from '../api/normalizers';

// Legacy demo-store persistence key; cleared on boot so stale seed data never leaks in.
const LEGACY_STORAGE_KEY = 'diagnosis-center-change-pack-v1-state';

const initialState = {
  auth: null,
  currentPage: 'login',
  data: seedData,
  ui: {
    sidebarOpen: false,
    toast: null,
    activeLabAcceptOrderId: '',
    activeAcceptedSampleOrderId: '',
    activeScanAcceptOrderId: '',
    activeAcceptedScanOrderId: '',
    activeWalkInPatientId: '',
    activeWalkInVisitId: ''
  }
};

function getInitialState() {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    // Render the shell immediately from the cached (non-sensitive) profile;
    // the session is revalidated against /auth/me on mount.
    const cached = normalizeAuthUser(getStoredSession().user);
    if (cached) {
      return { ...initialState, auth: cached, currentPage: cached.landing };
    }
  } catch {
    // Fall through to the logged-out state.
  }
  return initialState;
}

function toast(type, message) {
  return { type, message };
}

function stableSerialize(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${key}:${stableSerialize(value[key])}`).join('|')}}`;
}

function simpleHash(value) {
  const input = stableSerialize(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `SHA256-DEMO-${(hash >>> 0).toString(16).padStart(8, '0').toUpperCase()}-${String(input.length).padStart(6, '0')}`;
}

function createResultSnapshot(result = {}) {
  return {
    status: result.status || '',
    parameters: (result.parameters || []).map((parameter) => ({
      testId: parameter.testId || '',
      testName: parameter.testName || '',
      name: parameter.name || '',
      value: parameter.value || '',
      unit: parameter.unit || '',
      referenceRange: parameter.referenceRange || '',
      flag: parameter.flag || ''
    })),
    reportText: result.reportText || '',
    internalNotes: result.internalNotes || ''
  };
}

function createReportHashPayload(result = {}) {
  return {
    id: result.id,
    orderId: result.orderId,
    department: result.department,
    status: result.status,
    parameters: result.parameters,
    reportText: result.reportText,
    approvedBy: result.approvedBy,
    approvedAt: result.approvedAt,
    signedBy: result.signedBy,
    signedAt: result.signedAt,
    previousHash: result.previousHash || ''
  };
}

function getNextVersionNumber(result = {}) {
  const versions = result.versionHistory || result.amendments || [];
  const maxVersion = versions
    .map((entry) => Number(entry.version || entry.versionAfter || 1))
    .filter(Number.isFinite)
    .reduce((max, version) => Math.max(max, version), 1);
  return maxVersion + 1;
}

function createSecureId(result = {}) {
  return result.secureId || `SEC-${String(result.orderId || result.id || 'LAB').replace(/[^A-Z0-9]/gi, '').toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
}


function normalizePatientPayload(payload = {}) {
  return {
    fullName: String(payload.fullName || '').trim(),
    dateOfBirth: payload.dateOfBirth || '',
    gender: payload.gender || '',
    phone: payload.phone || '',
    email: payload.email || '',
    address: payload.address || '',
    nationalId: payload.nationalId || '',
    referringHospitalId: payload.referringHospitalId || '',
    referringDoctorId: payload.referringDoctorId || '',
    insuranceProvider: payload.insuranceProvider || '',
    policyNumber: payload.policyNumber || '',
    emergencyContact: payload.emergencyContact || '',
    allergies: payload.allergies || ''
  };
}

function createPatientRecord(data, payload, auth) {
  const timestamp = nowIso();
  const base = normalizePatientPayload(payload);
  const patient = {
    id: idWithPrefix('PAT-', data.patients || []),
    ...base,
    referringDoctorId: base.referringDoctorId || auth?.linkedDoctorId || '',
    referringHospitalId: base.referringHospitalId || auth?.hospitalId || '',
    createdAt: timestamp,
    updatedAt: timestamp
  };
  return {
    patient,
    data: {
      ...data,
      patients: [patient, ...(data.patients || [])],
      auditLogs: addAudit(data.auditLogs || [], {
        actor: auth?.userName || 'System',
        role: auth?.role || 'system',
        action: 'Patient record created',
        module: 'Patient Records',
        entityId: patient.id,
        details: patient.fullName
      })
    }
  };
}

function updatePatientRecord(data, patientId, payload, auth) {
  const timestamp = nowIso();
  const base = normalizePatientPayload(payload);
  const previous = (data.patients || []).find((patient) => patient.id === patientId);
  if (!previous) return { error: 'Patient not found.' };
  const updated = { ...previous, ...base, updatedAt: timestamp };
  return {
    patient: updated,
    data: {
      ...data,
      patients: (data.patients || []).map((patient) => patient.id === patientId ? updated : patient),
      auditLogs: addAudit(data.auditLogs || [], {
        actor: auth?.userName || 'System',
        role: auth?.role || 'system',
        action: 'Patient record updated',
        module: 'Patient Records',
        entityId: patientId,
        details: updated.fullName
      })
    }
  };
}


function ensureOrderInProgress(data, orderId, auth) {
  const order = (data.orders || []).find((item) => item.id === orderId);
  if (!order || order.status !== 'Confirmed') return data;
  return {
    ...data,
    orders: data.orders.map((item) => item.id === orderId ? {
      ...item,
      status: 'In Progress',
      updatedAt: nowIso(),
      timeline: [...(item.timeline || []), { status: 'In Progress', actor: auth?.userName || 'System', role: auth?.role || 'system', timestamp: nowIso() }]
    } : item),
    auditLogs: addAudit(data.auditLogs || [], {
      actor: auth?.userName || 'System',
      role: auth?.role || 'system',
      action: 'Order processing started',
      module: 'Department Workflow',
      entityId: orderId,
      details: 'Status moved to In Progress from department page.'
    })
  };
}

function upsertDepartmentResult(data, payload, auth) {
  const timestamp = nowIso();
  const existing = (data.results || []).find((result) => result.orderId === payload.orderId && result.department === payload.department);
  const resultRecord = {
    ...(existing || {}),
    id: existing?.id || idWithPrefix('RES-', data.results || []),
    orderId: payload.orderId,
    department: payload.department,
    status: payload.status || 'Pending Review',
    parameters: payload.parameters || existing?.parameters || [],
    reportText: payload.reportText || existing?.reportText || '',
    equipment: payload.equipment || existing?.equipment || '',
    internalNotes: payload.internalNotes || existing?.internalNotes || '',
    files: payload.files || existing?.files || [],
    abnormal: payload.abnormal ?? existing?.abnormal ?? false,
    approvedBy: payload.status === 'Final / Released' ? (auth?.userName || 'Approver') : (existing?.approvedBy || ''),
    approvedAt: payload.status === 'Final / Released' ? timestamp : (existing?.approvedAt || ''),
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
    versionHistory: existing?.versionHistory || [],
    reportHash: existing?.reportHash || '',
    previousHash: existing?.previousHash || '',
    secureId: existing?.secureId || '',
    verificationUrl: existing?.verificationUrl || '',
    digitalSignature: existing?.digitalSignature || '',
    signedBy: existing?.signedBy || '',
    signedAt: existing?.signedAt || '',
    signatureStatus: existing?.signatureStatus || ''
  };
  return {
    ...data,
    results: existing
      ? data.results.map((result) => result.id === existing.id ? resultRecord : result)
      : [resultRecord, ...(data.results || [])]
  };
}

function maybeReleaseOrderAfterResultApproval(data, orderId, auth) {
  const order = (data.orders || []).find((item) => item.id === orderId);
  if (!order) return data;
  const requiredDepartments = order.routedDepartments || [];
  const results = (data.results || []).filter((result) => result.orderId === orderId);
  const allFinal = requiredDepartments.length > 0 && requiredDepartments.every((department) => results.some((result) => result.department === department && result.status === 'Final / Released'));
  if (!allFinal || order.status === 'Final / Released') return data;
  const timestamp = nowIso();
  const releasedData = {
    ...data,
    orders: data.orders.map((item) => item.id === orderId ? {
      ...item,
      status: 'Final / Released',
      updatedAt: timestamp,
      timeline: [...(item.timeline || []), { status: 'Final / Released', actor: auth?.userName || 'System', role: auth?.role || 'system', timestamp }]
    } : item),
    auditLogs: addAudit(data.auditLogs || [], {
      actor: auth?.userName || 'System',
      role: auth?.role || 'system',
      action: 'Order released after department sign-off',
      module: 'Results Delivery',
      entityId: orderId,
      details: 'All routed department results reached Final / Released.'
    })
  };
  const delivery = createResultDeliveryBundle(releasedData, orderId, {
    actor: auth?.userName || 'System',
    role: auth?.role || 'system',
    source: 'Results Delivery'
  });
  return delivery.error ? releasedData : delivery.data;
}


function getOrderAmount(data, orderId) {
  const order = (data.orders || []).find((item) => item.id === orderId);
  if (!order) return 0;
  return (order.itemIds || []).reduce((sum, itemId) => {
    const item = (data.catalog || []).find((catalogItem) => catalogItem.id === itemId);
    return sum + Number(item?.price || 0);
  }, 0);
}

function ensureInvoiceForOrder(data, orderId, auth) {
  if ((data.invoices || []).some((invoice) => invoice.orderId === orderId)) return data;
  const timestamp = nowIso();
  const invoice = {
    id: idWithPrefix('INV-', data.invoices || []),
    orderId,
    amount: getOrderAmount(data, orderId),
    tax: 0,
    discount: 0,
    status: 'Pending',
    method: '',
    insuranceReference: '',
    transactions: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
  return {
    ...data,
    invoices: [invoice, ...(data.invoices || [])],
    auditLogs: addAudit(data.auditLogs || [], {
      actor: auth?.userName || 'System',
      role: auth?.role || 'billing',
      action: 'Invoice generated from order',
      module: 'Billing / Finance',
      entityId: orderId,
      details: `${invoice.id} generated for ${orderId}`
    })
  };
}

function confirmReceptionOrder(data, orderId, auth, payload = {}) {
  const order = (data.orders || []).find((item) => item.id === orderId);
  if (!order) return { error: 'Order not found.' };
  const timestamp = nowIso();
  let nextData = data;
  if (order.status === 'Submitted') {
    const transitioned = transitionOrder(nextData, {
      orderId,
      nextStatus: 'Confirmed',
      actor: auth?.userName || 'Reception',
      role: auth?.role || 'receptionist'
    });
    if (transitioned.error) return transitioned;
    nextData = transitioned.data;
  }
  nextData = ensureInvoiceForOrder(nextData, orderId, auth);
  const refreshed = (nextData.orders || []).find((item) => item.id === orderId);
  nextData = {
    ...nextData,
    orders: nextData.orders.map((item) => item.id === orderId ? {
      ...item,
      receptionNotes: payload.receptionNotes || item.receptionNotes || 'Patient/order verified by reception.',
      routedDepartments: item.routedDepartments?.length ? item.routedDepartments : refreshed?.routedDepartments || [],
      updatedAt: timestamp
    } : item),
    notifications: [
      {
        id: idWithPrefix('NOT-', nextData.notifications || []),
        title: 'Order confirmed by reception',
        body: `${orderId} was verified and routed to the requested department queue(s).`,
        audience: 'billing',
        channel: 'In-platform',
        status: 'Delivered',
        read: false,
        createdAt: timestamp,
        entityId: orderId
      },
      ...(nextData.notifications || [])
    ],
    auditLogs: addAudit(nextData.auditLogs || [], {
      actor: auth?.userName || 'Reception',
      role: auth?.role || 'receptionist',
      action: 'Order confirmed and routed',
      module: 'Reception',
      entityId: orderId,
      details: payload.receptionNotes || 'Confirmed from incoming orders queue.'
    })
  };
  return { data: nextData };
}


function createRoleNotification(data, { title, body, audience, entityId, channel = 'In-platform', status = 'Delivered', deliveryType = '' }) {
  return {
    id: idWithPrefix('NOT-', data.notifications || []),
    title,
    body,
    audience,
    channel,
    status,
    deliveryType,
    read: false,
    createdAt: nowIso(),
    entityId
  };
}

function getLabItemIdsForOrder(data, orderId) {
  const order = (data.orders || []).find((item) => item.id === orderId);
  if (!order) return [];
  return (order.itemIds || []).filter((itemId) => (data.catalog || []).find((catalogItem) => catalogItem.id === itemId)?.department === 'Laboratory');
}

function getScanItemIdsForOrder(data, orderId) {
  const order = (data.orders || []).find((item) => item.id === orderId);
  if (!order) return [];
  return (order.itemIds || []).filter((itemId) => (data.catalog || []).find((catalogItem) => catalogItem.id === itemId)?.department === 'Imaging');
}

function getActiveFinanceShift(data, userName) {
  return (data.financeShifts || []).find((shift) => shift.status === 'Open' && (!userName || shift.startedBy === userName));
}

function resultParametersWithoutTest(parameters = [], testId) {
  return parameters.filter((parameter) => parameter.testId !== testId);
}

function actorFromAuth(auth) {
  return {
    actor: auth?.userName || 'System',
    role: auth?.role || 'system'
  };
}


const DEFAULT_FACILITY_FEATURES = {
  clinicianRequests: true,
  receptionWalkins: true,
  laboratory: true,
  imaging: true,
  billing: true,
  resultsDelivery: true,
  reporting: true,
  apiAccess: false,
  patientMessaging: false,
  documentUpload: true
};

const DEFAULT_FACILITY_DEPARTMENTS = ['Reception', 'Laboratory', 'Imaging', 'Billing'];

function normalizeFacilityPayload(payload = {}, existing = {}) {
  const featurePayload = payload.features || payload.enabledFeatures || {};
  const deliveryPayload = payload.resultDelivery || {};
  const limitsPayload = payload.limits || {};
  return {
    name: String(payload.name ?? existing.name ?? '').trim(),
    code: String(payload.code ?? existing.code ?? '').trim().toUpperCase(),
    type: payload.type || existing.type || 'Full Diagnostic Facility',
    status: payload.status || existing.status || 'Active',
    contactPerson: payload.contactPerson ?? existing.contactPerson ?? '',
    phone: payload.phone ?? existing.phone ?? '',
    email: payload.email ?? existing.email ?? '',
    address: payload.address ?? existing.address ?? '',
    region: payload.region ?? existing.region ?? '',
    administrator: payload.administrator ?? existing.administrator ?? '',
    billingContact: payload.billingContact ?? existing.billingContact ?? '',
    departments: Array.isArray(payload.departments) ? payload.departments : (existing.departments || DEFAULT_FACILITY_DEPARTMENTS),
    catalogItemIds: Array.isArray(payload.catalogItemIds) ? payload.catalogItemIds : (existing.catalogItemIds || []),
    features: { ...DEFAULT_FACILITY_FEATURES, ...(existing.features || {}), ...featurePayload },
    resultDelivery: {
      sendToClinician: deliveryPayload.sendToClinician ?? existing.resultDelivery?.sendToClinician ?? true,
      sendToReception: deliveryPayload.sendToReception ?? existing.resultDelivery?.sendToReception ?? false,
      allowPatientCopy: deliveryPayload.allowPatientCopy ?? existing.resultDelivery?.allowPatientCopy ?? false,
      requireDigitalSignature: deliveryPayload.requireDigitalSignature ?? existing.resultDelivery?.requireDigitalSignature ?? true
    },
    branding: {
      primaryColor: payload.branding?.primaryColor ?? existing.branding?.primaryColor ?? '#191816',
      accentColor: payload.branding?.accentColor ?? existing.branding?.accentColor ?? '#f2b35d',
      logoName: payload.branding?.logoName ?? existing.branding?.logoName ?? ''
    },
    limits: {
      maxUsers: Number(limitsPayload.maxUsers ?? existing.limits?.maxUsers ?? 25),
      maxClinicians: Number(limitsPayload.maxClinicians ?? existing.limits?.maxClinicians ?? 10),
      dailyOrderLimit: Number(limitsPayload.dailyOrderLimit ?? existing.limits?.dailyOrderLimit ?? 250)
    },
    notes: payload.notes ?? existing.notes ?? ''
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_AUTH': {
      return {
        ...state,
        auth: action.auth,
        currentPage: action.navigate || (action.auth ? state.currentPage : 'login'),
        ui: { ...state.ui, sidebarOpen: false }
      };
    }
    case 'NAVIGATE':
      return { ...state, currentPage: action.pageId, ui: { ...state.ui, sidebarOpen: false } };
    case 'GO_HOME':
      return { ...state, currentPage: state.auth?.landing || 'overview', ui: { ...state.ui, sidebarOpen: false } };
    case 'TOGGLE_SIDEBAR':
      return { ...state, ui: { ...state.ui, sidebarOpen: !state.ui.sidebarOpen } };
    case 'CLOSE_SIDEBAR':
      return { ...state, ui: { ...state.ui, sidebarOpen: false } };
    case 'SHOW_TOAST':
      return { ...state, ui: { ...state.ui, toast: action.toast } };
    case 'CLEAR_TOAST':
      return { ...state, ui: { ...state.ui, toast: null } };
    case 'TRANSITION_ORDER': {
      const result = transitionOrder(state.data, { ...action.payload, ...actorFromAuth(state.auth) });
      if (result.error) return { ...state, ui: { ...state.ui, toast: toast('error', result.error) } };
      return { ...state, data: result.data, ui: { ...state.ui, toast: toast('success', `${action.payload.orderId} moved to ${action.payload.nextStatus}`) } };
    }
    case 'UPDATE_BILLING_STATUS': {
      const result = updateBillingStatus(state.data, { ...action.payload, ...actorFromAuth(state.auth) });
      if (result.error) return { ...state, ui: { ...state.ui, toast: toast('error', result.error) } };
      return { ...state, data: result.data, ui: { ...state.ui, toast: toast('success', `${action.payload.orderId} billing set to ${action.payload.billingStatus}`) } };
    }
    case 'CREATE_DEMO_ORDER': {
      const nextData = createOrder(state.data, action.payload, state.auth?.userName, state.auth?.role);
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Order created and sent to reception') } };
    }
    case 'CREATE_PATIENT': {
      const result = createPatientRecord(state.data, action.payload, state.auth);
      if (!result.patient.fullName) return { ...state, ui: { ...state.ui, toast: toast('error', 'Patient full name is required.') } };
      return { ...state, data: result.data, ui: { ...state.ui, toast: toast('success', `${result.patient.fullName} added to patient records`) } };
    }
    case 'UPDATE_PATIENT': {
      const result = updatePatientRecord(state.data, action.patientId, action.payload, state.auth);
      if (result.error) return { ...state, ui: { ...state.ui, toast: toast('error', result.error) } };
      return { ...state, data: result.data, ui: { ...state.ui, toast: toast('success', `${result.patient.fullName} updated`) } };
    }
    case 'CREATE_DOCTOR_ORDER': {
      let nextData = state.data;
      let patientId = action.payload.patientId;
      if (action.payload.patientMode === 'new') {
        const patientResult = createPatientRecord(nextData, {
          ...action.payload.newPatient,
          referringDoctorId: action.payload.doctorId,
          referringHospitalId: action.payload.hospitalId
        }, state.auth);
        if (!patientResult.patient.fullName) return { ...state, ui: { ...state.ui, toast: toast('error', 'New patient full name is required.') } };
        nextData = patientResult.data;
        patientId = patientResult.patient.id;
      }
      if (!patientId) return { ...state, ui: { ...state.ui, toast: toast('error', 'Select or create a patient before submitting an order.') } };
      if (!action.payload.itemIds?.length) return { ...state, ui: { ...state.ui, toast: toast('error', 'Select at least one test or scan.') } };
      nextData = createOrder(nextData, {
        patientId,
        doctorId: action.payload.doctorId,
        hospitalId: action.payload.hospitalId,
        itemIds: action.payload.itemIds,
        urgency: action.payload.urgency,
        clinicalNotes: action.payload.clinicalNotes
      }, state.auth?.userName, state.auth?.role);
      return { ...state, data: nextData, currentPage: 'doctor-dashboard', ui: { ...state.ui, toast: toast('success', 'Order submitted and routed to the required workflow queue(s)') } };
    }
    case 'UPDATE_DOCTOR_PROFILE': {
      const timestamp = nowIso();
      const doctorId = action.doctorId;
      const previous = (state.data.doctors || []).find((doctor) => doctor.id === doctorId);
      if (!previous) return { ...state, ui: { ...state.ui, toast: toast('error', 'Doctor profile not found.') } };
      const updatedDoctor = { ...previous, ...action.payload, updatedAt: timestamp };
      const nextData = {
        ...state.data,
        doctors: state.data.doctors.map((doctor) => doctor.id === doctorId ? updatedDoctor : doctor),
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'System',
          role: state.auth?.role || 'doctor',
          action: 'Doctor profile updated',
          module: 'Doctor Portal',
          entityId: doctorId,
          details: updatedDoctor.name
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Doctor profile updated') } };
    }

    case 'ADD_SAMPLE_LOG': {
      if (!action.payload.orderId) return { ...state, ui: { ...state.ui, toast: toast('error', 'Select an order before logging a sample.') } };
      const timestamp = nowIso();
      let nextData = ensureOrderInProgress(state.data, action.payload.orderId, state.auth);
      const sample = {
        id: idWithPrefix('SMP-', nextData.sampleLogs || []),
        orderId: action.payload.orderId,
        sampleType: action.payload.sampleType || 'Blood',
        collectedBy: action.payload.collectedBy || state.auth?.userName || 'Lab Staff',
        collectedAt: action.payload.collectedAt || timestamp,
        status: 'Accepted',
        rejectionReason: ''
      };
      nextData = {
        ...nextData,
        sampleLogs: [sample, ...(nextData.sampleLogs || [])],
        auditLogs: addAudit(nextData.auditLogs || [], {
          actor: state.auth?.userName || 'System',
          role: state.auth?.role || 'lab',
          action: 'Sample collected',
          module: 'Laboratory',
          entityId: action.payload.orderId,
          details: `${sample.sampleType} sample ${sample.id}`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', `Sample ${sample.id} logged`) } };
    }
    case 'REJECT_SAMPLE': {
      if (!action.sampleId || !String(action.reason || '').trim()) return { ...state, ui: { ...state.ui, toast: toast('error', 'Rejecting a sample requires a reason.') } };
      const sample = (state.data.sampleLogs || []).find((item) => item.id === action.sampleId);
      if (!sample) return { ...state, ui: { ...state.ui, toast: toast('error', 'Sample not found.') } };
      const nextData = {
        ...state.data,
        sampleLogs: state.data.sampleLogs.map((item) => item.id === action.sampleId ? { ...item, status: 'Rejected', rejectionReason: action.reason, rejectedAt: nowIso() } : item),
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'System',
          role: state.auth?.role || 'lab',
          action: 'Sample rejected / retest requested',
          module: 'Laboratory',
          entityId: sample.orderId,
          details: action.reason
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', `${action.sampleId} rejected and recollection requested`) } };
    }
    case 'ENTER_LAB_RESULT': {
      const { orderId, values, equipment, internalNotes, reportText } = action.payload;
      const order = (state.data.orders || []).find((item) => item.id === orderId);
      if (!order) return { ...state, ui: { ...state.ui, toast: toast('error', 'Lab order not found.') } };
      const labItems = (state.data.catalog || []).filter((item) => order.itemIds.includes(item.id) && item.department === 'Laboratory');
      const parameters = buildParameterEntries(labItems, values || {});
      if (parameters.some((parameter) => parameter.value === '')) return { ...state, ui: { ...state.ui, toast: toast('error', 'Enter all lab parameter values before sending for review.') } };
      let nextData = ensureOrderInProgress(state.data, orderId, state.auth);
      nextData = upsertDepartmentResult(nextData, {
        orderId,
        department: 'Laboratory',
        status: 'Pending Review',
        parameters,
        reportText,
        equipment,
        internalNotes,
        abnormal: parameters.some((parameter) => ['High', 'Low', 'Critical'].includes(parameter.flag))
      }, state.auth);
      nextData = {
        ...nextData,
        orders: nextData.orders.map((item) => item.id === orderId ? { ...item, status: 'Pending Review', updatedAt: nowIso(), timeline: [...(item.timeline || []), { status: 'Pending Review', actor: state.auth?.userName || 'System', role: state.auth?.role || 'lab', timestamp: nowIso() }] } : item),
        auditLogs: addAudit(nextData.auditLogs || [], {
          actor: state.auth?.userName || 'System',
          role: state.auth?.role || 'lab',
          action: 'Structured lab result entered',
          module: 'Laboratory',
          entityId: orderId,
          details: `${parameters.length} parameter(s) submitted for review.`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Lab result submitted for review') } };
    }
    case 'APPROVE_DEPARTMENT_RESULT': {
      const { orderId, department, approverNote } = action.payload;
      const result = (state.data.results || []).find((item) => item.orderId === orderId && item.department === department);
      if (!result) return { ...state, ui: { ...state.ui, toast: toast('error', 'No department result found to approve.') } };
      let nextData = upsertDepartmentResult(state.data, {
        ...result,
        orderId,
        department,
        status: 'Final / Released',
        reportText: approverNote ? `${result.reportText || ''}\n\nApprover note: ${approverNote}` : result.reportText
      }, state.auth);
      nextData = maybeReleaseOrderAfterResultApproval(nextData, orderId, state.auth);
      nextData = {
        ...nextData,
        auditLogs: addAudit(nextData.auditLogs || [], {
          actor: state.auth?.userName || 'System',
          role: state.auth?.role || 'system',
          action: `${department} result signed off`,
          module: department,
          entityId: orderId,
          details: approverNote || 'Approved and released at department level.'
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', `${department} result signed off`) } };
    }
    case 'ADD_SCAN_BOOKING': {
      if (!action.payload.orderId) return { ...state, ui: { ...state.ui, toast: toast('error', 'Select an imaging order before booking equipment.') } };
      const timestamp = nowIso();
      let nextData = ensureOrderInProgress(state.data, action.payload.orderId, state.auth);
      const booking = {
        id: idWithPrefix('BOOK-', nextData.scanBookings || []),
        orderId: action.payload.orderId,
        modality: action.payload.modality || 'X-ray',
        room: action.payload.room || 'Imaging Room 1',
        machine: action.payload.machine || 'Unassigned machine',
        bookedAt: action.payload.bookedAt || timestamp,
        status: action.payload.status || 'Booked',
        technicianNotes: action.payload.technicianNotes || ''
      };
      nextData = {
        ...nextData,
        scanBookings: [booking, ...(nextData.scanBookings || [])],
        auditLogs: addAudit(nextData.auditLogs || [], {
          actor: state.auth?.userName || 'System',
          role: state.auth?.role || 'scan',
          action: 'Imaging equipment booked',
          module: 'Imaging',
          entityId: action.payload.orderId,
          details: `${booking.machine} / ${booking.room}`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', `Booking ${booking.id} created`) } };
    }
    case 'SAVE_SCAN_REPORT': {
      const { orderId, findings, impression, files, internalNotes, equipment, status = 'Pending Review' } = action.payload;
      const order = (state.data.orders || []).find((item) => item.id === orderId);
      if (!order) return { ...state, ui: { ...state.ui, toast: toast('error', 'Imaging order not found.') } };
      if (status !== 'Draft' && (!findings || !impression)) return { ...state, ui: { ...state.ui, toast: toast('error', 'Findings and impression are required before submitting for review.') } };
      let nextData = ensureOrderInProgress(state.data, orderId, state.auth);
      const dicomFiles = (files || []).filter((file) => file.isDicom || /\.(dcm|dicom)$/i.test(file.name || ''));
      nextData = upsertDepartmentResult(nextData, {
        orderId,
        department: 'Imaging',
        status,
        parameters: [],
        reportText: `Findings: ${findings || 'Draft findings pending.'}\n\nImpression: ${impression || 'Draft impression pending.'}`,
        equipment,
        internalNotes,
        files: files || [],
        abnormal: /mass|fracture|lesion|abnormal|opacity|infiltration|critical/i.test(`${findings} ${impression}`),
        dicomMetadata: dicomFiles.map((file) => ({ name: file.name, size: file.size, contentType: file.type || 'application/dicom', storageStatus: 'Metadata captured' }))
      }, state.auth);
      const nextStatus = status === 'Pending Review' ? 'Pending Review' : 'In Progress';
      nextData = {
        ...nextData,
        orders: nextData.orders.map((item) => item.id === orderId ? { ...item, status: nextStatus, updatedAt: nowIso(), timeline: [...(item.timeline || []), { status: nextStatus, actor: state.auth?.userName || 'System', role: state.auth?.role || 'scan', timestamp: nowIso() }] } : item),
        auditLogs: addAudit(nextData.auditLogs || [], {
          actor: state.auth?.userName || 'System',
          role: state.auth?.role || 'scan',
          action: status === 'Draft' ? 'Radiology report draft saved' : 'Radiology report submitted for review',
          module: 'Imaging',
          entityId: orderId,
          details: `${(files || []).length} file(s) attached; ${dicomFiles.length} DICOM file(s).`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', status === 'Draft' ? 'Scan report draft saved' : 'Scan report submitted for radiologist review') } };
    }

    case 'OPEN_SCAN_ACCEPT': {
      return { ...state, currentPage: 'scan-queue', ui: { ...state.ui, sidebarOpen: false, activeScanAcceptOrderId: action.orderId } };
    }
    case 'ACCEPT_SCAN_ORDER': {
      const orderId = action.orderId || state.ui.activeScanAcceptOrderId;
      const order = (state.data.orders || []).find((item) => item.id === orderId);
      if (!order) return { ...state, ui: { ...state.ui, toast: toast('error', 'Imaging order not found.') } };
      const scanItemIds = getScanItemIdsForOrder(state.data, orderId);
      if (!scanItemIds.length) return { ...state, ui: { ...state.ui, toast: toast('error', 'This order has no scans routed to Imaging.') } };
      const timestamp = nowIso();
      let nextData = state.data;
      if (order.status === 'Confirmed' || order.status === 'Submitted') {
        nextData = ensureOrderInProgress(nextData, orderId, state.auth);
      }
      const existingAccepted = (nextData.scanBookings || []).find((booking) => booking.orderId === orderId && booking.status === 'Accepted');
      const acceptance = existingAccepted || {
        id: idWithPrefix('SCAN-', nextData.scanBookings || []),
        orderId,
        modality: action.payload?.modality || 'Imaging',
        room: action.payload?.room || 'Pending room assignment',
        machine: action.payload?.machine || 'Pending machine assignment',
        bookedAt: action.payload?.bookedAt || timestamp,
        status: 'Accepted',
        acceptedAt: timestamp,
        acceptedBy: state.auth?.userName || 'Scan Staff',
        technicianNotes: action.payload?.technicianNotes || '',
        scanItemIds
      };
      nextData = {
        ...nextData,
        scanBookings: existingAccepted ? nextData.scanBookings.map((item) => item.id === existingAccepted.id ? { ...item, ...acceptance, acceptedAt: item.acceptedAt || timestamp, acceptedBy: item.acceptedBy || state.auth?.userName || 'Scan Staff' } : item) : [acceptance, ...(nextData.scanBookings || [])],
        auditLogs: addAudit(nextData.auditLogs || [], {
          actor: state.auth?.userName || 'Scan Staff',
          role: state.auth?.role || 'scan',
          action: 'Imaging request accepted',
          module: 'Imaging',
          entityId: orderId,
          details: `${acceptance.id} accepted for ${scanItemIds.length} scan item(s)`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, activeScanAcceptOrderId: orderId, activeAcceptedScanOrderId: orderId, toast: toast('success', `${acceptance.id} accepted. You can keep accepting scans, then open Accepted Scans when ready.`) } };
    }
    case 'OPEN_ACCEPTED_SCAN': {
      return { ...state, currentPage: 'accepted-scans', ui: { ...state.ui, sidebarOpen: false, activeAcceptedScanOrderId: action.orderId } };
    }

    case 'REJECT_SCAN_ORDER': {
      const { orderId, reason, actionNeeded = 'Retake Requested' } = action.payload || {};
      if (!orderId || !String(reason || '').trim()) return { ...state, ui: { ...state.ui, toast: toast('error', 'A reason is required before rejecting or requesting a retake.') } };
      const order = (state.data.orders || []).find((item) => item.id === orderId);
      if (!order) return { ...state, ui: { ...state.ui, toast: toast('error', 'Imaging order not found.') } };
      const timestamp = nowIso();
      const rejection = {
        id: idWithPrefix('SREJ-', state.data.scanRejections || []),
        orderId,
        reason,
        actionNeeded,
        status: actionNeeded,
        createdAt: timestamp,
        createdBy: state.auth?.userName || 'Scan Staff'
      };
      const nextData = {
        ...state.data,
        scanRejections: [rejection, ...(state.data.scanRejections || [])],
        scanBookings: (state.data.scanBookings || []).map((booking) => booking.orderId === orderId ? { ...booking, status: actionNeeded, rejectionReason: reason, updatedAt: timestamp } : booking),
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Scan Staff',
          role: state.auth?.role || 'scan',
          action: `Imaging ${actionNeeded}`,
          module: 'Imaging',
          entityId: orderId,
          details: reason
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', `Imaging case marked as ${actionNeeded}`) } };
    }

    case 'CONFIRM_RECEPTION_ORDER': {
      const result = confirmReceptionOrder(state.data, action.orderId, state.auth, action.payload || {});
      if (result.error) return { ...state, ui: { ...state.ui, toast: toast('error', result.error) } };
      return { ...state, data: result.data, ui: { ...state.ui, toast: toast('success', `${action.orderId} confirmed and routed`) } };
    }
    case 'CHECK_IN_PATIENT': {
      const { patientId, orderId, identityVerified, notes, nextAction } = action.payload || {};
      if (!patientId) return { ...state, ui: { ...state.ui, toast: toast('error', 'Select a patient before check-in.') } };
      const timestamp = nowIso();
      let nextData = state.data;
      if (orderId) {
        const confirmed = confirmReceptionOrder(nextData, orderId, state.auth, { receptionNotes: 'Checked in at front desk.' });
        if (!confirmed.error) nextData = confirmed.data;
      }
      const visit = {
        id: idWithPrefix('VIS-', nextData.dailyVisits || []),
        patientId,
        orderId: orderId || '',
        checkedInAt: timestamp,
        checkedInBy: state.auth?.userName || 'Reception',
        identityVerified: Boolean(identityVerified),
        status: 'Checked In',
        visitType: nextAction === 'request-tests' ? 'Walk-in' : (orderId ? 'Order' : 'Walk-in'),
        walkIn: nextAction === 'request-tests' || !orderId,
        notes: notes || ''
      };
      nextData = {
        ...nextData,
        dailyVisits: [visit, ...(nextData.dailyVisits || [])],
        auditLogs: addAudit(nextData.auditLogs || [], {
          actor: state.auth?.userName || 'Reception',
          role: state.auth?.role || 'receptionist',
          action: 'Patient checked in',
          module: 'Reception',
          entityId: patientId,
          details: orderId ? `Linked to ${orderId}` : 'Walk-in / standalone check-in'
        })
      };
      return {
        ...state,
        data: nextData,
        currentPage: nextAction === 'request-tests' ? 'reception-walkins' : state.currentPage,
        ui: {
          ...state.ui,
          activeWalkInPatientId: nextAction === 'request-tests' ? patientId : state.ui.activeWalkInPatientId,
          activeWalkInVisitId: nextAction === 'request-tests' ? visit.id : state.ui.activeWalkInVisitId,
          toast: toast('success', nextAction === 'request-tests' ? 'Patient checked in. Continue by requesting tests.' : 'Patient checked in and added to daily visit log')
        }
      };
    }
    case 'CREATE_WALK_IN_PATIENT': {
      const result = createPatientRecord(state.data, action.payload, state.auth);
      if (!result.patient.fullName) return { ...state, ui: { ...state.ui, toast: toast('error', 'Patient full name is required.') } };
      const timestamp = nowIso();
      const visit = {
        id: idWithPrefix('VIS-', result.data.dailyVisits || []),
        patientId: result.patient.id,
        orderId: '',
        checkedInAt: timestamp,
        checkedInBy: state.auth?.userName || 'Reception',
        identityVerified: false,
        status: 'Walk-in Registered',
        visitType: 'Walk-in',
        walkIn: true,
        notes: 'Walk-in patient registered by reception.'
      };
      const nextData = {
        ...result.data,
        dailyVisits: [visit, ...(result.data.dailyVisits || [])],
        auditLogs: addAudit(result.data.auditLogs || [], {
          actor: state.auth?.userName || 'Reception',
          role: state.auth?.role || 'receptionist',
          action: 'Walk-in patient registered',
          module: 'Reception',
          entityId: result.patient.id,
          details: result.patient.fullName
        })
      };
      return {
        ...state,
        data: nextData,
        ui: {
          ...state.ui,
          activeWalkInPatientId: result.patient.id,
          activeWalkInVisitId: visit.id,
          toast: toast('success', `${result.patient.fullName} registered. Continue by requesting tests.`)
        }
      };
    }
    case 'START_WALK_IN_TEST_REQUEST': {
      const patientId = action.payload?.patientId || '';
      const visitId = action.payload?.visitId || '';
      if (!patientId) return { ...state, ui: { ...state.ui, toast: toast('error', 'Select a walk-in patient before requesting tests.') } };
      return {
        ...state,
        currentPage: 'reception-walkins',
        ui: {
          ...state.ui,
          activeWalkInPatientId: patientId,
          activeWalkInVisitId: visitId,
          toast: toast('success', 'Walk-in patient loaded for test request')
        }
      };
    }
    case 'CREATE_RECEPTION_WALK_IN_ORDER': {
      const { patientId, visitId, itemIds = [], urgency = 'Routine', clinicalNotes = '', hospitalId = '' } = action.payload || {};
      const patient = (state.data.patients || []).find((item) => item.id === patientId);
      if (!patient) return { ...state, ui: { ...state.ui, toast: toast('error', 'Select a checked-in walk-in patient before creating a request.') } };
      if (!itemIds.length) return { ...state, ui: { ...state.ui, toast: toast('error', 'Select at least one laboratory test or scan for this walk-in patient.') } };
      const validItems = itemIds.filter((itemId) => (state.data.catalog || []).some((item) => item.id === itemId));
      if (validItems.length !== itemIds.length) return { ...state, ui: { ...state.ui, toast: toast('error', 'One or more selected tests are no longer available in the catalog.') } };
      const directLabCount = validItems.filter((itemId) => (state.data.catalog || []).find((item) => item.id === itemId)?.department === 'Laboratory').length;
      const directScanCount = validItems.filter((itemId) => (state.data.catalog || []).find((item) => item.id === itemId)?.department === 'Imaging').length;

      const actor = state.auth?.userName || 'Reception';
      const beforeOrderIds = new Set((state.data.orders || []).map((order) => order.id));
      let nextData = createOrder(state.data, {
        patientId,
        doctorId: '',
        hospitalId: hospitalId || patient.referringHospitalId || '',
        itemIds: validItems,
        urgency,
        clinicalNotes: clinicalNotes || 'Walk-in request created directly by reception.',
        requestSource: 'Walk-in',
        walkInRequest: true,
        visitId,
        skipIntakeNotification: true
      }, actor, state.auth?.role || 'receptionist');

      const createdOrder = (nextData.orders || []).find((order) => !beforeOrderIds.has(order.id)) || nextData.orders?.[0];
      if (!createdOrder) return { ...state, ui: { ...state.ui, toast: toast('error', 'Walk-in request could not be created.') } };
      const confirmed = confirmReceptionOrder(nextData, createdOrder.id, state.auth, { receptionNotes: 'Walk-in request created and routed directly by reception.' });
      if (confirmed.error) return { ...state, ui: { ...state.ui, toast: toast('error', confirmed.error) } };
      nextData = confirmed.data;
      const timestamp = nowIso();
      nextData = {
        ...nextData,
        orders: (nextData.orders || []).map((order) => order.id === createdOrder.id ? {
          ...order,
          doctorId: '',
          hospitalId: hospitalId || patient.referringHospitalId || order.hospitalId || '',
          requestSource: 'Walk-in',
          walkInRequest: true,
          visitId: visitId || order.visitId || '',
          requestedByReception: actor,
          receptionNotes: 'Walk-in request created and routed directly by reception.',
          updatedAt: timestamp
        } : order),
        dailyVisits: (nextData.dailyVisits || []).map((visit) => visit.id === visitId ? {
          ...visit,
          orderId: visit.orderId || createdOrder.id,
          orderIds: [...new Set([...(visit.orderIds || []), visit.orderId, createdOrder.id].filter(Boolean))],
          status: 'Checked In',
          notes: [visit.notes, `Walk-in test request ${createdOrder.id} created.`].filter(Boolean).join(' '),
          updatedAt: timestamp,
          updatedBy: actor
        } : visit),
        notifications: [{
          id: idWithPrefix('NOT-', nextData.notifications || []),
          title: 'Walk-in diagnostic request routed',
          body: `${createdOrder.id} was created at reception and routed directly to the diagnostic department queue(s).`,
          audience: directLabCount > 0 ? 'lab' : (directScanCount > 0 ? 'imaging' : 'diagnostics'),
          channel: 'In-platform',
          status: 'Delivered',
          read: false,
          createdAt: timestamp,
          entityId: createdOrder.id
        }, ...(nextData.notifications || [])],
        auditLogs: addAudit(nextData.auditLogs || [], {
          actor,
          role: state.auth?.role || 'receptionist',
          action: 'Walk-in test request created',
          module: 'Reception Walk-ins',
          entityId: createdOrder.id,
          details: `${patient.fullName} · ${validItems.length} item(s) requested`
        })
      };
      return {
        ...state,
        data: nextData,
        ui: {
          ...state.ui,
          activeWalkInPatientId: patientId,
          activeWalkInVisitId: visitId || state.ui.activeWalkInVisitId,
          toast: toast('success', `${createdOrder.id} created, invoiced and routed directly to diagnostics`)
        }
      };
    }
    case 'CREATE_APPOINTMENT': {
      const { patientId, orderId, scheduledAt, purpose, room, notes } = action.payload || {};
      if (!patientId || !scheduledAt) return { ...state, ui: { ...state.ui, toast: toast('error', 'Patient and appointment time are required.') } };
      const timestamp = nowIso();
      const appointment = {
        id: idWithPrefix('APT-', state.data.appointments || []),
        patientId,
        orderId: orderId || '',
        scheduledAt,
        purpose: purpose || 'Visit / sample collection',
        room: room || 'Reception',
        status: 'Scheduled',
        notes: notes || '',
        createdAt: timestamp,
        updatedAt: timestamp
      };
      const nextData = {
        ...state.data,
        appointments: [appointment, ...(state.data.appointments || [])],
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Reception',
          role: state.auth?.role || 'receptionist',
          action: 'Appointment scheduled',
          module: 'Reception',
          entityId: appointment.id,
          details: `${appointment.purpose} at ${appointment.room}`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Appointment scheduled') } };
    }
    case 'UPDATE_APPOINTMENT_STATUS': {
      const { appointmentId, status, reason } = action.payload || {};
      const appt = (state.data.appointments || []).find((item) => item.id === appointmentId);
      if (!appt) return { ...state, ui: { ...state.ui, toast: toast('error', 'Appointment not found.') } };
      if (['Cancelled', 'Rescheduled'].includes(status) && !String(reason || '').trim()) return { ...state, ui: { ...state.ui, toast: toast('error', `${status} appointments require a reason.`) } };
      const nextData = {
        ...state.data,
        appointments: state.data.appointments.map((item) => item.id === appointmentId ? { ...item, status, reason: reason || item.reason || '', updatedAt: nowIso() } : item),
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Reception',
          role: state.auth?.role || 'receptionist',
          action: `Appointment ${status}`,
          module: 'Reception',
          entityId: appointmentId,
          details: reason || status
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', `Appointment ${status}`) } };
    }
    case 'UPDATE_DAILY_VISIT_STATUS': {
      const { visitId, status, note } = action.payload || {};
      const visit = (state.data.dailyVisits || []).find((item) => item.id === visitId);
      if (!visit) return { ...state, ui: { ...state.ui, toast: toast('error', 'Visit record not found.') } };
      const nextData = {
        ...state.data,
        dailyVisits: (state.data.dailyVisits || []).map((item) => item.id === visitId ? { ...item, status: status || item.status, notes: note || item.notes || '', updatedAt: nowIso(), updatedBy: state.auth?.userName || 'Reception' } : item),
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Reception',
          role: state.auth?.role || 'receptionist',
          action: `Visit ${status}`,
          module: 'Reception',
          entityId: visitId,
          details: note || status || 'Visit status updated'
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', `Visit marked ${status}`) } };
    }
    case 'FLAG_DUPLICATE_PATIENT': {
      const { patientId, possibleDuplicateId, reason } = action.payload || {};
      if (!patientId || !possibleDuplicateId) return { ...state, ui: { ...state.ui, toast: toast('error', 'Choose two patient records to flag.') } };
      const flag = {
        id: idWithPrefix('DUP-', state.data.duplicateFlags || []),
        patientId,
        possibleDuplicateId,
        reason: reason || 'Possible duplicate based on identity/search match.',
        status: 'Flagged',
        createdAt: nowIso(),
        createdBy: state.auth?.userName || 'Reception'
      };
      const nextData = {
        ...state.data,
        duplicateFlags: [flag, ...(state.data.duplicateFlags || [])],
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Reception',
          role: state.auth?.role || 'receptionist',
          action: 'Possible duplicate patient flagged',
          module: 'Reception',
          entityId: patientId,
          details: `${patientId} may duplicate ${possibleDuplicateId}`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Duplicate patient flag added') } };
    }
    case 'UPDATE_INVOICE': {
      const { invoiceId, tax, discount, insuranceReference, status, method } = action.payload || {};
      const invoice = (state.data.invoices || []).find((item) => item.id === invoiceId);
      if (!invoice) return { ...state, ui: { ...state.ui, toast: toast('error', 'Invoice not found.') } };
      const updated = {
        ...invoice,
        tax: Number(tax ?? invoice.tax ?? 0),
        discount: Number(discount ?? invoice.discount ?? 0),
        insuranceReference: insuranceReference ?? invoice.insuranceReference,
        status: status || invoice.status,
        method: method ?? invoice.method,
        updatedAt: nowIso()
      };
      const nextData = {
        ...state.data,
        invoices: state.data.invoices.map((item) => item.id === invoiceId ? updated : item),
        orders: state.data.orders.map((order) => order.id === invoice.orderId ? { ...order, billingStatus: updated.status === 'Paid' ? 'Paid' : updated.status === 'Insurance Pending' ? 'Insurance Pending' : order.billingStatus } : order),
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Billing',
          role: state.auth?.role || 'billing',
          action: 'Invoice updated',
          module: 'Billing / Finance',
          entityId: invoiceId,
          details: `Tax ${updated.tax}, discount ${updated.discount}, status ${updated.status}`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Invoice updated') } };
    }
    case 'RECORD_PAYMENT': {
      const { invoiceId, amount, method, reference } = action.payload || {};
      const invoice = (state.data.invoices || []).find((item) => item.id === invoiceId);
      if (!invoice) return { ...state, ui: { ...state.ui, toast: toast('error', 'Invoice not found.') } };
      const activeShift = getActiveFinanceShift(state.data, state.auth?.userName || 'Billing');
      if (!activeShift) return { ...state, ui: { ...state.ui, toast: toast('error', 'Start a finance shift before accepting payment.') } };
      const invoiceTotal = Number(invoice.amount || 0) + Number(invoice.tax || 0) - Number(invoice.discount || 0);
      const paidBefore = (invoice.transactions || []).filter((txn) => txn.status === 'Paid').reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
      const outstanding = Math.max(0, invoiceTotal - paidBefore);
      const numericAmount = Number(amount || outstanding || 0);
      if (numericAmount <= 0) return { ...state, ui: { ...state.ui, toast: toast('error', 'Payment amount must be greater than zero.') } };
      if (numericAmount > outstanding + 0.01) return { ...state, ui: { ...state.ui, toast: toast('error', 'Payment exceeds outstanding balance.') } };
      const transaction = { id: idWithPrefix('TXN-', invoice.transactions || []), amount: numericAmount, method: method || 'Transfer', reference: reference || '', status: 'Paid', shiftId: activeShift.id, staff: state.auth?.userName || 'Billing', createdAt: nowIso() };
      const paidTotal = paidBefore + numericAmount;
      const nextStatus = paidTotal >= invoiceTotal - 0.01 ? 'Paid' : 'Partial';
      const nextData = {
        ...state.data,
        invoices: state.data.invoices.map((item) => item.id === invoiceId ? { ...item, status: nextStatus, method: transaction.method, transactions: [...(item.transactions || []), transaction], updatedAt: nowIso() } : item),
        orders: state.data.orders.map((order) => order.id === invoice.orderId ? { ...order, billingStatus: nextStatus === 'Paid' ? 'Paid' : 'Payment Pending', updatedAt: nowIso() } : order),
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Billing',
          role: state.auth?.role || 'billing',
          action: 'Payment recorded to cashier float',
          module: 'Billing / Finance',
          entityId: invoiceId,
          details: `${transaction.method} payment of ${numericAmount} linked to ${activeShift.id}`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Payment recorded to active float') } };
    }
    case 'REFUND_OR_ADJUST_INVOICE': {
      const { invoiceId, amount, reason, supervisorCode } = action.payload || {};
      const invoice = (state.data.invoices || []).find((item) => item.id === invoiceId);
      if (!invoice) return { ...state, ui: { ...state.ui, toast: toast('error', 'Invoice not found.') } };
      if (!String(reason || '').trim()) return { ...state, ui: { ...state.ui, toast: toast('error', 'Refund/adjustment requires a reason.') } };
      const adjustment = { id: idWithPrefix('ADJ-', state.data.adjustments || []), invoiceId, amount: Number(amount || 0), reason, supervisorCode: supervisorCode || '', approvedBy: supervisorCode || 'Supervisor', createdAt: nowIso(), createdBy: state.auth?.userName || 'Billing' };
      const nextData = {
        ...state.data,
        adjustments: [adjustment, ...(state.data.adjustments || [])],
        invoices: state.data.invoices.map((item) => item.id === invoiceId ? { ...item, status: 'Refunded', updatedAt: nowIso() } : item),
        orders: state.data.orders.map((order) => order.id === invoice.orderId ? { ...order, billingStatus: 'Refunded', updatedAt: nowIso() } : order),
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Billing',
          role: state.auth?.role || 'billing',
          action: 'Refund / adjustment recorded',
          module: 'Billing / Finance',
          entityId: invoiceId,
          details: `${reason} · approved by ${action.payload?.supervisorCode || 'Supervisor'}`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Refund/adjustment recorded') } };
    }
    case 'UPDATE_CATALOG_PRICE': {
      const { itemId, price, expectedHours } = action.payload || {};
      const item = (state.data.catalog || []).find((entry) => entry.id === itemId);
      if (!item) return { ...state, ui: { ...state.ui, toast: toast('error', 'Catalog item not found.') } };
      const nextData = {
        ...state.data,
        catalog: state.data.catalog.map((entry) => entry.id === itemId ? { ...entry, price: Number(price ?? entry.price), expectedHours: Number(expectedHours ?? entry.expectedHours) } : entry),
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Billing',
          role: state.auth?.role || 'billing',
          action: 'Catalog price updated',
          module: 'Billing / Finance',
          entityId: itemId,
          details: `${item.name}: price ${price}, expected hours ${expectedHours}`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Catalog item updated') } };
    }


    case 'ADMIN_CREATE_USER': {
      const payload = action.payload || {};
      if (!String(payload.name || '').trim()) return { ...state, ui: { ...state.ui, toast: toast('error', 'User name is required.') } };
      const timestamp = nowIso();
      const user = {
        id: idWithPrefix('USR-', state.data.users || []),
        name: payload.name,
        role: payload.role || 'receptionist',
        status: payload.status || 'Active',
        email: payload.email || '',
        phone: payload.phone || '',
        linkedDoctorId: payload.linkedDoctorId || '',
        hospitalId: payload.hospitalId || '',
        createdAt: timestamp,
        updatedAt: timestamp
      };
      const nextData = {
        ...state.data,
        users: [user, ...(state.data.users || [])],
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Admin',
          role: state.auth?.role || 'admin',
          action: 'User account created',
          module: 'Admin / User Management',
          entityId: user.id,
          details: `${user.name} assigned ${user.role}`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'User account created') } };
    }
    case 'ADMIN_UPDATE_USER': {
      const { userId, payload = {} } = action;
      const existing = (state.data.users || []).find((user) => user.id === userId);
      if (!existing) return { ...state, ui: { ...state.ui, toast: toast('error', 'User account not found.') } };
      const updated = { ...existing, ...payload, id: existing.id, updatedAt: nowIso() };
      const nextData = {
        ...state.data,
        users: state.data.users.map((user) => user.id === userId ? updated : user),
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Admin',
          role: state.auth?.role || 'admin',
          action: 'User account updated',
          module: 'Admin / User Management',
          entityId: userId,
          details: `${updated.name} (${updated.role}) is ${updated.status}`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'User account updated') } };
    }

    case 'ADMIN_CREATE_FACILITY': {
      const payload = normalizeFacilityPayload(action.payload || {});
      if (!payload.name) return { ...state, ui: { ...state.ui, toast: toast('error', 'Facility name is required.') } };
      const timestamp = nowIso();
      const facility = {
        id: idWithPrefix('FAC-', state.data.facilities || []),
        ...payload,
        code: payload.code || `FAC-${String((state.data.facilities || []).length + 1).padStart(3, '0')}`,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      const nextData = {
        ...state.data,
        facilities: [facility, ...(state.data.facilities || [])],
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Admin',
          role: state.auth?.role || 'admin',
          action: 'Diagnostic facility created',
          module: 'Admin / Facilities',
          entityId: facility.id,
          details: `${facility.name} · ${Object.entries(facility.features || {}).filter(([, enabled]) => enabled).length} enabled features`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Diagnostic facility created') } };
    }
    case 'ADMIN_UPDATE_FACILITY': {
      const { facilityId, payload = {} } = action;
      const existing = (state.data.facilities || []).find((facility) => facility.id === facilityId);
      if (!existing) return { ...state, ui: { ...state.ui, toast: toast('error', 'Facility not found.') } };
      const updated = { ...existing, ...normalizeFacilityPayload(payload, existing), id: existing.id, createdAt: existing.createdAt, updatedAt: nowIso() };
      const nextData = {
        ...state.data,
        facilities: (state.data.facilities || []).map((facility) => facility.id === facilityId ? updated : facility),
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Admin',
          role: state.auth?.role || 'admin',
          action: 'Diagnostic facility updated',
          module: 'Admin / Facilities',
          entityId: facilityId,
          details: `${updated.name} is ${updated.status}`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Facility customization saved') } };
    }
    case 'ADMIN_CREATE_HOSPITAL': {
      const payload = action.payload || {};
      if (!String(payload.name || '').trim()) return { ...state, ui: { ...state.ui, toast: toast('error', 'Hospital name is required.') } };
      const timestamp = nowIso();
      const hospital = {
        id: idWithPrefix('HOSP-', state.data.hospitals || []),
        name: payload.name,
        billingContact: payload.billingContact || '',
        accountStatus: payload.accountStatus || 'Active',
        phone: payload.phone || '',
        address: payload.address || '',
        createdAt: timestamp,
        updatedAt: timestamp
      };
      const nextData = {
        ...state.data,
        hospitals: [hospital, ...(state.data.hospitals || [])],
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Admin',
          role: state.auth?.role || 'admin',
          action: 'Hospital partner created',
          module: 'Admin / Hospital Partners',
          entityId: hospital.id,
          details: hospital.name
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Hospital partner created') } };
    }
    case 'ADMIN_UPDATE_HOSPITAL': {
      const { hospitalId, payload = {} } = action;
      const existing = (state.data.hospitals || []).find((hospital) => hospital.id === hospitalId);
      if (!existing) return { ...state, ui: { ...state.ui, toast: toast('error', 'Hospital not found.') } };
      const updated = { ...existing, ...payload, id: existing.id, updatedAt: nowIso() };
      const nextData = {
        ...state.data,
        hospitals: state.data.hospitals.map((hospital) => hospital.id === hospitalId ? updated : hospital),
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Admin',
          role: state.auth?.role || 'admin',
          action: 'Hospital partner updated',
          module: 'Admin / Hospital Partners',
          entityId: hospitalId,
          details: `${updated.name} is ${updated.accountStatus}`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Hospital partner updated') } };
    }
    case 'ADMIN_CREATE_DOCTOR': {
      const payload = action.payload || {};
      if (!String(payload.name || '').trim()) return { ...state, ui: { ...state.ui, toast: toast('error', 'Doctor name is required.') } };
      const timestamp = nowIso();
      const doctor = {
        id: idWithPrefix('DOC-', state.data.doctors || []),
        name: payload.name,
        specialty: payload.specialty || '',
        hospitalId: payload.hospitalId || '',
        licenseNumber: payload.licenseNumber || '',
        email: payload.email || '',
        phone: payload.phone || '',
        notificationPreferences: payload.notificationPreferences || { email: true, sms: true },
        createdAt: timestamp,
        updatedAt: timestamp
      };
      const nextData = {
        ...state.data,
        doctors: [doctor, ...(state.data.doctors || [])],
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Admin',
          role: state.auth?.role || 'admin',
          action: 'Affiliated doctor created',
          module: 'Admin / Hospital Partners',
          entityId: doctor.id,
          details: doctor.name
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Affiliated doctor created') } };
    }
    case 'ADMIN_UPDATE_DOCTOR': {
      const { doctorId, payload = {} } = action;
      const existing = (state.data.doctors || []).find((doctor) => doctor.id === doctorId);
      if (!existing) return { ...state, ui: { ...state.ui, toast: toast('error', 'Doctor not found.') } };
      const updated = { ...existing, ...payload, id: existing.id, notificationPreferences: payload.notificationPreferences || existing.notificationPreferences, updatedAt: nowIso() };
      const nextData = {
        ...state.data,
        doctors: state.data.doctors.map((doctor) => doctor.id === doctorId ? updated : doctor),
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Admin',
          role: state.auth?.role || 'admin',
          action: 'Affiliated doctor updated',
          module: 'Admin / Hospital Partners',
          entityId: doctorId,
          details: updated.name
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Affiliated doctor updated') } };
    }
    case 'ADMIN_CREATE_CATALOG_ITEM': {
      const payload = action.payload || {};
      if (!String(payload.name || '').trim()) return { ...state, ui: { ...state.ui, toast: toast('error', 'Catalog item name is required.') } };
      const catalogItem = {
        id: idWithPrefix('CAT-', state.data.catalog || []),
        type: payload.type || 'Lab',
        name: payload.name,
        department: payload.department || (payload.type === 'Scan' ? 'Imaging' : 'Laboratory'),
        modality: payload.modality || '',
        price: Number(payload.price || 0),
        expectedHours: Number(payload.expectedHours || 8),
        parameters: payload.parameters || []
      };
      const nextData = {
        ...state.data,
        catalog: [catalogItem, ...(state.data.catalog || [])],
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Admin',
          role: state.auth?.role || 'admin',
          action: 'Test/scan catalog item created',
          module: 'Admin / Catalog Management',
          entityId: catalogItem.id,
          details: catalogItem.name
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Catalog item created') } };
    }
    case 'ADMIN_UPDATE_CATALOG_ITEM': {
      const { itemId, payload = {} } = action;
      const existing = (state.data.catalog || []).find((item) => item.id === itemId);
      if (!existing) return { ...state, ui: { ...state.ui, toast: toast('error', 'Catalog item not found.') } };
      const updated = {
        ...existing,
        ...payload,
        id: existing.id,
        price: Number(payload.price ?? existing.price),
        expectedHours: Number(payload.expectedHours ?? existing.expectedHours),
        parameters: payload.parameters ?? existing.parameters
      };
      const nextData = {
        ...state.data,
        catalog: state.data.catalog.map((item) => item.id === itemId ? updated : item),
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Admin',
          role: state.auth?.role || 'admin',
          action: 'Test/scan catalog item updated',
          module: 'Admin / Catalog Management',
          entityId: itemId,
          details: updated.name
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Catalog item updated') } };
    }
    case 'ADMIN_CREATE_DEPARTMENT': {
      const payload = action.payload || {};
      if (!String(payload.name || '').trim()) return { ...state, ui: { ...state.ui, toast: toast('error', 'Department name is required.') } };
      const department = { id: idWithPrefix('DEP-', state.data.departments || []), name: payload.name, type: payload.type || '', lead: payload.lead || '' };
      const nextData = {
        ...state.data,
        departments: [department, ...(state.data.departments || [])],
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Admin',
          role: state.auth?.role || 'admin',
          action: 'Department created',
          module: 'Admin / Department Management',
          entityId: department.id,
          details: department.name
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Department created') } };
    }
    case 'ADMIN_UPDATE_DEPARTMENT': {
      const { departmentId, payload = {} } = action;
      const existing = (state.data.departments || []).find((department) => department.id === departmentId);
      if (!existing) return { ...state, ui: { ...state.ui, toast: toast('error', 'Department not found.') } };
      const updated = { ...existing, ...payload, id: existing.id };
      const nextData = {
        ...state.data,
        departments: state.data.departments.map((department) => department.id === departmentId ? updated : department),
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Admin',
          role: state.auth?.role || 'admin',
          action: 'Department updated',
          module: 'Admin / Department Management',
          entityId: departmentId,
          details: updated.name
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Department updated') } };
    }
    case 'ADMIN_CREATE_EQUIPMENT': {
      const payload = action.payload || {};
      if (!String(payload.machine || '').trim()) return { ...state, ui: { ...state.ui, toast: toast('error', 'Equipment machine name is required.') } };
      const equipment = { id: idWithPrefix('EQ-', state.data.scanEquipment || []), room: payload.room || '', machine: payload.machine, modality: payload.modality || 'X-ray', status: payload.status || 'Available' };
      const nextData = {
        ...state.data,
        scanEquipment: [equipment, ...(state.data.scanEquipment || [])],
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Admin',
          role: state.auth?.role || 'admin',
          action: 'Equipment created',
          module: 'Admin / Department Management',
          entityId: equipment.id,
          details: equipment.machine
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Equipment created') } };
    }
    case 'ADMIN_UPDATE_EQUIPMENT': {
      const { equipmentId, payload = {} } = action;
      const existing = (state.data.scanEquipment || []).find((equipment) => equipment.id === equipmentId);
      if (!existing) return { ...state, ui: { ...state.ui, toast: toast('error', 'Equipment not found.') } };
      const updated = { ...existing, ...payload, id: existing.id };
      const nextData = {
        ...state.data,
        scanEquipment: state.data.scanEquipment.map((equipment) => equipment.id === equipmentId ? updated : equipment),
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Admin',
          role: state.auth?.role || 'admin',
          action: 'Equipment updated',
          module: 'Admin / Department Management',
          entityId: equipmentId,
          details: updated.machine
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Equipment updated') } };
    }
    case 'ADMIN_CONFIGURATION_EXPORT_RECORDED': {
      const nextData = {
        ...state.data,
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Admin',
          role: state.auth?.role || 'admin',
          action: 'Admin configuration export reviewed',
          module: 'Admin / Settings',
          entityId: 'CONFIG-EXPORT',
          details: 'Catalog, ranges, departments, equipment, hospitals, doctors and user mappings marked as reviewed.'
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Configuration export review recorded') } };
    }

    case 'ADMIN_UPDATE_NOTIFICATION_SETTINGS': {
      const nextData = {
        ...state.data,
        notificationSettings: action.payload,
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Admin',
          role: state.auth?.role || 'admin',
          action: 'Notification settings updated',
          module: 'Admin / Notification Settings',
          entityId: 'NOTIFICATION-SETTINGS',
          details: `Email: ${action.payload?.emailProvider || '—'} / SMS: ${action.payload?.smsProvider || '—'}`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Notification settings saved') } };
    }

    case 'PREPARE_RESULT_DELIVERY': {
      const delivery = createResultDeliveryBundle(state.data, action.orderId, {
        actor: state.auth?.userName || 'System',
        role: state.auth?.role || 'admin',
        source: 'Results Delivery',
        force: Boolean(action.force)
      });
      if (delivery.error) return { ...state, ui: { ...state.ui, toast: toast('error', delivery.error) } };
      return { ...state, data: delivery.data, ui: { ...state.ui, toast: toast('success', `${action.orderId} delivery bundle prepared`) } };
    }
    case 'RETRY_DELIVERY_NOTIFICATION': {
      const result = retryDeliveryNotification(state.data, action.notificationId, actorFromAuth(state.auth));
      if (result.error) return { ...state, ui: { ...state.ui, toast: toast('error', result.error) } };
      return { ...state, data: result.data, ui: { ...state.ui, toast: toast('success', 'Delivery retry queued') } };
    }
    case 'MARK_NOTIFICATION_DELIVERED': {
      const notification = (state.data.notifications || []).find((item) => item.id === action.notificationId);
      if (!notification) return { ...state, ui: { ...state.ui, toast: toast('error', 'Notification not found.') } };
      const timestamp = nowIso();
      const nextData = {
        ...state.data,
        notifications: state.data.notifications.map((item) => item.id === action.notificationId ? { ...item, status: 'Delivered', deliveredAt: timestamp, lastAttemptAt: timestamp, error: '' } : item),
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'System',
          role: state.auth?.role || 'admin',
          action: 'Delivery notification marked delivered',
          module: 'Results Delivery',
          entityId: notification.entityId || notification.id,
          details: `${notification.channel} ${notification.id}`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Notification marked delivered') } };
    }
    case 'MARK_DOCTOR_NOTIFICATION_READ': {
      const nextData = {
        ...state.data,
        notifications: (state.data.notifications || []).map((item) => item.id === action.notificationId ? { ...item, read: true, readAt: nowIso() } : item)
      };
      return { ...state, data: nextData };
    }
    case 'MARK_REPORT_DOWNLOADED': {
      const result = markReportDownloaded(state.data, action.reportId, actorFromAuth(state.auth));
      if (result.error) return { ...state, ui: { ...state.ui, toast: toast('error', result.error) } };
      return { ...state, data: result.data };
    }

    case 'LOG_RESTRICTED_ACCESS': {
      const timestamp = nowIso();
      const role = state.auth?.role || 'guest';
      const event = {
        id: idWithPrefix('SEC-', state.data.securityEvents || []),
        type: 'Access Denied',
        actor: state.auth?.userName || 'Guest',
        role,
        target: action.pageId || 'unknown-route',
        severity: 'Medium',
        details: `Blocked ${role} from ${action.pageId || 'unknown-route'}`,
        acknowledged: false,
        createdAt: timestamp
      };
      const nextData = {
        ...state.data,
        securityEvents: [event, ...(state.data.securityEvents || [])],
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: event.actor,
          role: event.role,
          action: 'Restricted route access blocked',
          module: 'Security / Access Control',
          entityId: event.target,
          details: event.details
        })
      };
      return { ...state, data: nextData };
    }
    case 'SECURITY_EXPORT_RECORDED': {
      const timestamp = nowIso();
      const event = {
        id: idWithPrefix('SEC-', state.data.securityEvents || []),
        type: 'Security Export',
        actor: state.auth?.userName || 'System',
        role: state.auth?.role || 'admin',
        target: action.scope || 'Security dataset',
        severity: 'Low',
        details: 'Security and reliability dataset exported.',
        acknowledged: true,
        createdAt: timestamp
      };
      const nextData = {
        ...state.data,
        securityEvents: [event, ...(state.data.securityEvents || [])],
        backupExports: [{ id: idWithPrefix('BAK-', state.data.backupExports || []), scope: action.scope || 'Security dataset', exportedBy: event.actor, createdAt: timestamp }, ...(state.data.backupExports || [])],
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: event.actor,
          role: event.role,
          action: 'Security dataset exported',
          module: 'Security / Reliability',
          entityId: event.id,
          details: event.target
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Security export recorded in audit trail') } };
    }


    case 'OPEN_LAB_ACCEPT': {
      return { ...state, currentPage: 'lab-queue', ui: { ...state.ui, sidebarOpen: false, activeLabAcceptOrderId: action.orderId } };
    }
    case 'ACCEPT_LAB_SAMPLE': {
      const orderId = action.orderId || state.ui.activeLabAcceptOrderId;
      const order = (state.data.orders || []).find((item) => item.id === orderId);
      if (!order) return { ...state, ui: { ...state.ui, toast: toast('error', 'Lab order not found.') } };
      const requestedLabItemIds = getLabItemIdsForOrder(state.data, orderId);
      const selectedLabItemIds = Array.isArray(action.payload?.labItemIds) ? action.payload.labItemIds.filter((id) => requestedLabItemIds.includes(id)) : [];
      const labItemIds = selectedLabItemIds.length ? selectedLabItemIds : requestedLabItemIds;
      if (!labItemIds.length) return { ...state, ui: { ...state.ui, toast: toast('error', 'This order has no lab tests routed to Laboratory.') } };
      const timestamp = nowIso();
      let nextData = state.data;
      if (order.status === 'Confirmed' || order.status === 'Submitted') {
        nextData = ensureOrderInProgress(nextData, orderId, state.auth);
      }
      const existingAccepted = (nextData.sampleLogs || []).find((sample) => sample.orderId === orderId && sample.status === 'Accepted');
      const sample = existingAccepted || {
        id: idWithPrefix('SMP-', nextData.sampleLogs || []),
        orderId,
        sampleType: action.payload?.sampleType || 'Blood',
        collectedBy: state.auth?.userName || 'Lab Staff',
        collectedAt: action.payload?.collectedAt || timestamp,
        acceptedAt: timestamp,
        acceptedBy: state.auth?.userName || 'Lab Staff',
        status: 'Accepted',
        labItemIds,
        rejectionReason: ''
      };
      nextData = {
        ...nextData,
        sampleLogs: existingAccepted ? nextData.sampleLogs.map((item) => item.id === existingAccepted.id ? { ...item, ...sample, acceptedAt: item.acceptedAt || timestamp, acceptedBy: item.acceptedBy || state.auth?.userName || 'Lab Staff' } : item) : [sample, ...(nextData.sampleLogs || [])],
        auditLogs: addAudit(nextData.auditLogs || [], {
          actor: state.auth?.userName || 'Lab Staff',
          role: state.auth?.role || 'lab',
          action: 'Lab sample accepted',
          module: 'Laboratory',
          entityId: orderId,
          details: `${sample.id} accepted for ${labItemIds.length} lab test(s)`
        })
      };
      return { ...state, data: nextData, currentPage: 'accepted-samples', ui: { ...state.ui, activeLabAcceptOrderId: orderId, activeAcceptedSampleOrderId: orderId, sidebarOpen: false, toast: toast('success', `${sample.id} accepted and sent directly to diagnostics result entry.`) } };
    }
    case 'BATCH_ACCEPT_LAB_SAMPLES': {
      const orderIds = Array.from(new Set(action.orderIds || [])).filter(Boolean);
      if (!orderIds.length) return { ...state, ui: { ...state.ui, toast: toast('error', 'Select at least one lab request to accept.') } };
      const timestamp = nowIso();
      let nextData = state.data;
      const acceptedSamples = [];
      orderIds.forEach((orderId) => {
        const order = (nextData.orders || []).find((item) => item.id === orderId);
        if (!order) return;
        const labItemIds = getLabItemIdsForOrder(nextData, orderId);
        if (!labItemIds.length) return;
        if (order.status === 'Confirmed' || order.status === 'Submitted') nextData = ensureOrderInProgress(nextData, orderId, state.auth);
        const existingAccepted = (nextData.sampleLogs || []).find((sample) => sample.orderId === orderId && sample.status === 'Accepted');
        if (existingAccepted) return;
        const sample = {
          id: idWithPrefix('SMP-', [...(nextData.sampleLogs || []), ...acceptedSamples]),
          orderId,
          sampleType: action.payload?.sampleType || 'Blood',
          collectedBy: state.auth?.userName || 'Lab Staff',
          collectedAt: action.payload?.collectedAt || timestamp,
          acceptedAt: timestamp,
          acceptedBy: state.auth?.userName || 'Lab Staff',
          status: 'Accepted',
          labItemIds,
          rejectionReason: ''
        };
        acceptedSamples.push(sample);
      });
      if (!acceptedSamples.length) return { ...state, ui: { ...state.ui, toast: toast('error', 'No new lab samples were accepted. They may already be accepted or not lab-routed.') } };
      nextData = {
        ...nextData,
        sampleLogs: [...acceptedSamples, ...(nextData.sampleLogs || [])],
        auditLogs: addAudit(nextData.auditLogs || [], {
          actor: state.auth?.userName || 'Lab Staff',
          role: state.auth?.role || 'lab',
          action: 'Batch lab samples accepted',
          module: 'Laboratory',
          entityId: acceptedSamples.map((sample) => sample.orderId).join(', '),
          details: `${acceptedSamples.length} sample(s) accepted in one batch.`
        })
      };
      return { ...state, data: nextData, currentPage: 'accepted-samples', ui: { ...state.ui, sidebarOpen: false, toast: toast('success', `${acceptedSamples.length} sample(s) accepted and sent directly to diagnostics result entry.`) } };
    }
    case 'OPEN_ACCEPTED_SAMPLE': {
      return { ...state, currentPage: 'accepted-samples', ui: { ...state.ui, sidebarOpen: false, activeAcceptedSampleOrderId: action.orderId } };
    }
    case 'ENTER_TEST_RESULT': {
      const { orderId, testId, values = {}, equipment = '', technicianNotes = '', reportText = '', files = [], mode = 'review' } = action.payload || {};
      const order = (state.data.orders || []).find((item) => item.id === orderId);
      const testItem = (state.data.catalog || []).find((item) => item.id === testId);
      if (!order || !testItem || testItem.department !== 'Laboratory') return { ...state, ui: { ...state.ui, toast: toast('error', 'Valid lab order and test are required.') } };
      const hasAccepted = (state.data.sampleLogs || []).some((sample) => sample.orderId === orderId && sample.status === 'Accepted');
      if (!hasAccepted) return { ...state, ui: { ...state.ui, toast: toast('error', 'Accept the sample before entering results.') } };
      const parameters = buildParameterEntries([testItem], values || {});
      const isDraft = mode === 'draft';
      if (!isDraft && parameters.some((parameter) => parameter.value === '')) return { ...state, ui: { ...state.ui, toast: toast('error', 'Enter all parameter values before sending this test for review.') } };
      const existing = (state.data.results || []).find((result) => result.orderId === orderId && result.department === 'Laboratory');
      const timestamp = nowIso();
      const previousTestParameters = (existing?.parameters || []).filter((parameter) => parameter.testId === testId && parameter.value !== '');
      const existingFilesForOtherTests = (existing?.files || []).filter((file) => !file.testId || file.testId !== testId);
      const normalizedFiles = (files || []).map((file, index) => ({
        id: file.id || `LAB-FILE-${Date.now()}-${index}`,
        name: file.name || file.fileName || 'Imported result document',
        fileName: file.fileName || file.name || 'Imported result document',
        type: file.type || file.fileType || 'application/octet-stream',
        fileType: file.fileType || file.type || 'application/octet-stream',
        size: Number(file.size ?? file.fileSize ?? 0),
        fileSize: Number(file.fileSize ?? file.size ?? 0),
        uploadedAt: file.uploadedAt || timestamp,
        uploadedBy: file.uploadedBy || state.auth?.userName || 'Lab Staff',
        source: file.source || 'Imported lab result document',
        testId,
        testName: testItem.name,
        dataUrl: file.dataUrl || '',
        url: file.url || '',
        note: file.note || ''
      }));
      const mergedFiles = [...existingFilesForOtherTests, ...normalizedFiles];
      const mergedParameters = [...resultParametersWithoutTest(existing?.parameters || [], testId), ...parameters];
      const labItemIds = getLabItemIdsForOrder(state.data, orderId);
      const completedTestIds = new Set(mergedParameters.filter((parameter) => parameter.value !== '').map((parameter) => parameter.testId));
      const allLabDone = labItemIds.every((id) => completedTestIds.has(id));
      const nextStatus = isDraft ? 'Draft' : (allLabDone ? 'Pending Review' : 'In Progress');
      const amendment = previousTestParameters.length ? {
        testId,
        testName: testItem.name,
        changedBy: state.auth?.userName || 'Lab Staff',
        changedAt: timestamp,
        reason: isDraft ? 'Draft updated before review.' : 'Result updated and submitted for review.',
        previousValues: previousTestParameters.map((parameter) => ({ name: parameter.name, value: parameter.value, flag: parameter.flag }))
      } : null;
      let nextData = upsertDepartmentResult(state.data, {
        orderId,
        department: 'Laboratory',
        status: nextStatus,
        parameters: mergedParameters,
        reportText: reportText || existing?.reportText || 'Lab result values entered.',
        equipment: equipment || existing?.equipment || '',
        internalNotes: technicianNotes || existing?.internalNotes || '',
        abnormal: mergedParameters.some((parameter) => ['High', 'Low', 'Critical'].includes(parameter.flag)),
        files: mergedFiles
      }, { ...state.auth, userName: state.auth?.userName || 'Lab Staff' });
      const updatedResult = (nextData.results || []).find((result) => result.orderId === orderId && result.department === 'Laboratory');
      if (amendment && updatedResult) {
        nextData = {
          ...nextData,
          results: nextData.results.map((result) => result.id === updatedResult.id ? { ...result, amendments: [amendment, ...(result.amendments || [])] } : result)
        };
      }
      const nextOrderStatus = nextStatus === 'Pending Review' ? 'Pending Review' : (order.status === 'Submitted' || order.status === 'Confirmed' ? 'In Progress' : order.status);
      nextData = {
        ...nextData,
        orders: nextData.orders.map((item) => item.id === orderId ? {
          ...item,
          status: nextOrderStatus,
          updatedAt: timestamp,
          timeline: [...(item.timeline || []), { status: isDraft ? `Lab draft saved: ${testItem.name}` : `Lab result sent for review: ${testItem.name}`, actor: state.auth?.userName || 'Lab Staff', role: state.auth?.role || 'lab', timestamp }]
        } : item),
        notifications: !isDraft && allLabDone ? [
          createRoleNotification(nextData, { title: 'Lab result awaiting sign-off', body: `${orderId} has lab results waiting for senior review.`, audience: 'admin', entityId: orderId, deliveryType: 'Lab Review' }),
          ...(nextData.notifications || [])
        ] : (nextData.notifications || []),
        auditLogs: addAudit(nextData.auditLogs || [], {
          actor: state.auth?.userName || 'Lab Staff',
          role: state.auth?.role || 'lab',
          action: isDraft ? 'Per-test lab result draft saved' : 'Per-test lab result submitted for review',
          module: 'Laboratory',
          entityId: orderId,
          details: `${testItem.name} saved as ${nextStatus}${amendment ? ' with amendment history' : ''}${normalizedFiles.length ? ` with ${normalizedFiles.length} imported file(s)` : ''}`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', isDraft ? `${testItem.name} draft saved${normalizedFiles.length ? ' with imported file(s)' : ''}` : `${testItem.name} sent for review${normalizedFiles.length ? ' with imported file(s)' : ''}`) } };
    }


    case 'PUSH_LAB_RESULT_TO_CLINICIAN': {
      const { orderId, parameters = [], equipment = '', technicianNotes = '', reportText = '', files = [] } = action.payload || {};
      const order = (state.data.orders || []).find((item) => item.id === orderId);
      if (!order) return { ...state, ui: { ...state.ui, toast: toast('error', 'Lab order not found.') } };
      const hasAccepted = (state.data.sampleLogs || []).some((sample) => sample.orderId === orderId && sample.status === 'Accepted');
      if (!hasAccepted) return { ...state, ui: { ...state.ui, toast: toast('error', 'Accept the sample before pushing results.') } };
      const submittedParameters = (parameters || []).map((parameter) => {
        const value = String(parameter.value || '').trim();
        return {
          testId: parameter.testId || '',
          testName: parameter.testName || '',
          id: parameter.id || parameter.name || '',
          name: parameter.name || 'Result',
          value,
          unit: parameter.unit || '',
          referenceRange: parameter.referenceRange || '',
          low: parameter.low ?? '',
          high: parameter.high ?? '',
          criticalLow: parameter.criticalLow ?? '',
          criticalHigh: parameter.criticalHigh ?? '',
          flag: parameter.flag || computeResultFlag(value, parameter.low, parameter.high, parameter.criticalLow, parameter.criticalHigh)
        };
      });
      if (!submittedParameters.length || submittedParameters.some((parameter) => parameter.value === '')) {
        return { ...state, ui: { ...state.ui, toast: toast('error', 'Enter all laboratory result values before pushing to the clinician.') } };
      }
      const timestamp = nowIso();
      let nextData = state.data;
      if (order.status === 'Confirmed' || order.status === 'Submitted') {
        nextData = ensureOrderInProgress(nextData, orderId, state.auth);
      }
      const existing = (nextData.results || []).find((result) => result.orderId === orderId && result.department === 'Laboratory');
      const normalizedFiles = (files || []).map((file, index) => ({
        id: file.id || `LAB-FILE-${Date.now()}-${index}`,
        name: file.name || file.fileName || 'Imported result document',
        fileName: file.fileName || file.name || 'Imported result document',
        type: file.type || file.fileType || 'application/octet-stream',
        fileType: file.fileType || file.type || 'application/octet-stream',
        size: Number(file.size ?? file.fileSize ?? 0),
        fileSize: Number(file.fileSize ?? file.size ?? 0),
        uploadedAt: file.uploadedAt || timestamp,
        uploadedBy: file.uploadedBy || state.auth?.userName || 'Lab Staff',
        source: file.source || 'Accepted Samples result import',
        testId: file.testId || '',
        testName: file.testName || '',
        dataUrl: file.dataUrl || '',
        url: file.url || '',
        note: file.note || ''
      }));
      const secureId = createSecureId(existing || { orderId, id: orderId });
      const resultBase = {
        ...(existing || {}),
        id: existing?.id || idWithPrefix('RES-', nextData.results || []),
        orderId,
        department: 'Laboratory',
        status: 'Final / Released',
        parameters: submittedParameters,
        reportText: reportText || existing?.reportText || 'Laboratory result completed and sent to clinician.',
        equipment: equipment || existing?.equipment || '',
        internalNotes: technicianNotes || existing?.internalNotes || '',
        files: normalizedFiles,
        abnormal: submittedParameters.some((parameter) => ['High', 'Low', 'Critical'].includes(parameter.flag)),
        approvedBy: state.auth?.userName || 'Lab Staff',
        approvedAt: timestamp,
        signedBy: state.auth?.userName || 'Lab Staff',
        signedAt: timestamp,
        digitalSignature: action.payload?.signatureDataUrl || existing?.digitalSignature || '',
        signatureStatus: 'Signed',
        secureId,
        verificationUrl: `#/verify-report/${secureId}`,
        patientPortalUrl: `#/patient/results/${secureId}`,
        previousHash: existing?.reportHash || existing?.previousHash || '',
        createdAt: existing?.createdAt || timestamp,
        updatedAt: timestamp,
        versionHistory: existing?.versionHistory || [],
        amendments: existing?.amendments || []
      };
      const resultRecord = {
        ...resultBase,
        reportHash: simpleHash(createReportHashPayload(resultBase))
      };
      const doctorNotification = createRoleNotification(nextData, {
        title: 'Lab result sent',
        body: `${orderId} has laboratory results ready for clinician review.`,
        audience: 'doctor',
        entityId: orderId,
        deliveryType: 'Lab Result Sent'
      });
      const patientNotification = createRoleNotification({ ...nextData, notifications: [doctorNotification, ...(nextData.notifications || [])] }, {
        title: 'Result ready',
        body: 'Your laboratory result is ready. Please contact your clinician for secure review.',
        audience: 'patient',
        channel: 'SMS',
        status: 'Queued',
        entityId: orderId,
        deliveryType: 'Privacy-safe Patient Result Notice'
      });
      nextData = {
        ...nextData,
        results: existing
          ? nextData.results.map((result) => result.id === existing.id ? resultRecord : result)
          : [resultRecord, ...(nextData.results || [])],
        orders: (nextData.orders || []).map((item) => item.id === orderId ? {
          ...item,
          updatedAt: timestamp,
          timeline: [...(item.timeline || []), { status: 'Laboratory result pushed to clinician', actor: state.auth?.userName || 'Lab Staff', role: state.auth?.role || 'lab', timestamp }]
        } : item),
        notifications: [patientNotification, doctorNotification, ...(nextData.notifications || [])],
        auditLogs: addAudit(nextData.auditLogs || [], {
          actor: state.auth?.userName || 'Lab Staff',
          role: state.auth?.role || 'lab',
          action: 'Laboratory result pushed to clinician',
          module: 'Laboratory',
          entityId: orderId,
          details: `${submittedParameters.length} parameter(s) sent. Hash ${resultRecord.reportHash}.`
        })
      };
      nextData = maybeReleaseOrderAfterResultApproval(nextData, orderId, state.auth);
      return { ...state, data: nextData, currentPage: 'lab-results', ui: { ...state.ui, activeAcceptedSampleOrderId: orderId, sidebarOpen: false, toast: toast('success', 'Lab result pushed directly to the clinician and stored in Results') } };
    }

    case 'UPDATE_LAB_RESULT_ARCHIVE': {
      const result = (state.data.results || []).find((item) => item.id === action.resultId && item.department === 'Laboratory');
      if (!result) return { ...state, ui: { ...state.ui, toast: toast('error', 'Laboratory result not found.') } };
      const timestamp = nowIso();
      const previousSnapshot = createResultSnapshot(result);
      const nextParameters = (action.payload?.parameters || result.parameters || []).map((parameter) => ({
        ...parameter,
        flag: parameter.value === '' ? 'Pending' : computeResultFlag(parameter.value, parameter.low, parameter.high, parameter.criticalLow, parameter.criticalHigh)
      }));
      const unsignedResult = {
        ...result,
        parameters: nextParameters,
        reportText: action.payload?.reportText ?? result.reportText,
        internalNotes: action.payload?.internalNotes ?? result.internalNotes,
        status: action.payload?.status || result.status,
        abnormal: nextParameters.some((parameter) => ['High', 'Low', 'Critical'].includes(parameter.flag)),
        updatedAt: timestamp,
        approvedAt: (action.payload?.status || result.status) === 'Final / Released' ? (result.approvedAt || timestamp) : result.approvedAt,
        approvedBy: (action.payload?.status || result.status) === 'Final / Released' ? (result.approvedBy || state.auth?.userName || 'Lab Staff') : result.approvedBy
      };
      const nextSnapshot = createResultSnapshot(unsignedResult);
      const nextVersion = getNextVersionNumber(result);
      const amendment = {
        id: `AMEND-${String(nextVersion).padStart(3, '0')}-${Date.now().toString(36).toUpperCase()}`,
        version: nextVersion,
        versionBefore: Math.max(1, nextVersion - 1),
        versionAfter: nextVersion,
        changedBy: state.auth?.userName || 'Lab Staff',
        changedAt: timestamp,
        reason: String(action.payload?.reason || '').trim() || 'Laboratory result corrected.',
        previousSnapshot,
        updatedSnapshot: nextSnapshot,
        previousValues: previousSnapshot.parameters,
        updatedValues: nextSnapshot.parameters,
        previousHash: result.reportHash || '',
        updatedHash: simpleHash(createReportHashPayload(unsignedResult))
      };
      const updatedResult = {
        ...unsignedResult,
        amendments: [amendment, ...(result.amendments || [])],
        versionHistory: [...(result.versionHistory || []), amendment],
        previousHash: result.reportHash || result.previousHash || '',
        reportHash: simpleHash(createReportHashPayload(unsignedResult)),
        signatureStatus: result.digitalSignature ? 'Needs re-sign after correction' : (result.signatureStatus || 'Unsigned'),
        digitalSignature: result.digitalSignature ? '' : result.digitalSignature,
        signedBy: result.digitalSignature ? '' : result.signedBy,
        signedAt: result.digitalSignature ? '' : result.signedAt
      };
      const nextData = {
        ...state.data,
        results: state.data.results.map((item) => item.id === result.id ? updatedResult : item),
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Lab Staff',
          role: state.auth?.role || 'lab',
          action: 'Laboratory result corrected',
          module: 'Laboratory',
          entityId: result.orderId,
          details: `${amendment.reason} · v${amendment.versionBefore} → v${amendment.versionAfter}`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Laboratory result updated, versioned and stored') } };
    }

    case 'SIGN_LAB_RESULT_WITH_SIGNATURE': {
      const result = (state.data.results || []).find((item) => item.id === action.resultId && item.department === 'Laboratory');
      if (!result) return { ...state, ui: { ...state.ui, toast: toast('error', 'Laboratory result not found.') } };
      const timestamp = nowIso();
      const secureId = createSecureId(result);
      const signedResultBase = {
        ...result,
        status: 'Final / Released',
        approvedBy: action.payload?.signedBy || state.auth?.userName || 'Lab Supervisor',
        approvedAt: timestamp,
        signedBy: action.payload?.signedBy || state.auth?.userName || 'Lab Supervisor',
        signedAt: timestamp,
        digitalSignature: action.payload?.signatureDataUrl || result.digitalSignature || '',
        signatureNote: action.payload?.note || '',
        signatureStatus: 'Signed',
        secureId,
        verificationUrl: `#/verify-report/${secureId}`,
        patientPortalUrl: `#/patient/results/${secureId}`,
        previousHash: result.reportHash || result.previousHash || '',
        updatedAt: timestamp
      };
      const signedResult = {
        ...signedResultBase,
        reportHash: simpleHash(createReportHashPayload(signedResultBase))
      };
      const doctorNotification = createRoleNotification(state.data, {
        title: 'Lab result finalised',
        body: `${signedResult.orderId} has been signed off and sent directly to the clinician for review.`,
        audience: 'doctor',
        entityId: signedResult.orderId,
        deliveryType: 'Lab Result Finalised'
      });
      const patientNotification = createRoleNotification({ ...state.data, notifications: [doctorNotification, ...(state.data.notifications || [])] }, {
        title: 'Result ready',
        body: `Your result is ready. Use the secure patient portal link or contact your clinician for access. No clinical values are included in this notice.`,
        audience: 'patient',
        channel: 'SMS',
        status: 'Queued',
        entityId: signedResult.orderId,
        deliveryType: 'Privacy-safe Patient Result Notice'
      });
      let nextData = {
        ...state.data,
        results: state.data.results.map((item) => item.id === result.id ? signedResult : item),
        notifications: [patientNotification, doctorNotification, ...(state.data.notifications || [])],
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: signedResult.signedBy,
          role: state.auth?.role || 'lab',
          action: 'Laboratory result digitally signed',
          module: 'Laboratory',
          entityId: result.orderId,
          details: `${result.id} signed. Hash ${signedResult.reportHash}. Secure ID ${secureId}.`
        })
      };
      nextData = maybeReleaseOrderAfterResultApproval(nextData, result.orderId, state.auth);
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Lab result signed, hashed and sent directly to the clinician') } };
    }

    case 'PRINT_SAMPLE_LABEL': {
      const sample = (state.data.sampleLogs || []).find((item) => item.id === action.sampleId);
      if (!sample) return { ...state, ui: { ...state.ui, toast: toast('error', 'Sample not found.') } };
      return { ...state, data: { ...state.data, auditLogs: addAudit(state.data.auditLogs || [], {
        actor: state.auth?.userName || 'Lab Staff',
        role: state.auth?.role || 'lab',
        action: 'Sample label printed',
        module: 'Laboratory',
        entityId: sample.id,
        details: `Label printed for ${sample.orderId}`
      }) }, ui: { ...state.ui, toast: toast('success', `Label print recorded for ${sample.id}`) } };
    }
    case 'REQUEST_SAMPLE_RECOLLECTION': {
      if (!action.sampleId || !String(action.reason || '').trim()) return { ...state, ui: { ...state.ui, toast: toast('error', 'Recollection requires a reason.') } };
      const sample = (state.data.sampleLogs || []).find((item) => item.id === action.sampleId);
      if (!sample) return { ...state, ui: { ...state.ui, toast: toast('error', 'Sample not found.') } };
      const nextData = {
        ...state.data,
        sampleLogs: state.data.sampleLogs.map((item) => item.id === action.sampleId ? { ...item, status: 'Recollection Requested', recollectionReason: action.reason, recollectionRequestedAt: nowIso() } : item),
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Lab Staff',
          role: state.auth?.role || 'lab',
          action: 'Sample recollection requested',
          module: 'Laboratory',
          entityId: sample.orderId,
          details: action.reason
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', `${action.sampleId} marked for recollection`) } };
    }

    case 'CREATE_FLOAT_ADJUSTMENT': {
      const activeShift = getActiveFinanceShift(state.data, state.auth?.userName || 'Billing');
      if (!activeShift) return { ...state, ui: { ...state.ui, toast: toast('error', 'Start a finance shift before float adjustments.') } };
      const amount = Number(action.payload?.amount || 0);
      if (amount <= 0) return { ...state, ui: { ...state.ui, toast: toast('error', 'Adjustment amount must be greater than zero.') } };
      const entry = {
        id: idWithPrefix('FLT-', state.data.floatAdjustments || []),
        type: action.payload?.type || 'In',
        method: action.payload?.method || 'Cash',
        amount,
        description: action.payload?.description || 'Manual float adjustment',
        staff: state.auth?.userName || 'Billing',
        shiftId: activeShift.id,
        createdAt: nowIso()
      };
      const nextData = {
        ...state.data,
        floatAdjustments: [entry, ...(state.data.floatAdjustments || [])],
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: entry.staff,
          role: state.auth?.role || 'billing',
          action: 'Float adjustment recorded',
          module: 'Billing / Finance',
          entityId: entry.id,
          details: `${entry.type} ${entry.method} ${amount} linked to ${entry.shiftId}`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Float adjustment recorded') } };
    }
    case 'CREATE_EXPENSE': {
      const amount = Number(action.payload?.amount || 0);
      const amountPaid = Number(action.payload?.amountPaid || 0);
      if (!String(action.payload?.description || '').trim()) return { ...state, ui: { ...state.ui, toast: toast('error', 'Expense description is required.') } };
      if (amount <= 0) return { ...state, ui: { ...state.ui, toast: toast('error', 'Expense amount must be greater than zero.') } };
      const status = amountPaid >= amount - 0.01 ? 'Paid' : amountPaid > 0 ? 'Partial' : 'Unpaid';
      const expense = {
        id: idWithPrefix('EXP-', state.data.expenses || []),
        description: action.payload.description,
        category: action.payload.category || 'Other',
        amount,
        amountPaid: Math.min(amountPaid, amount),
        method: action.payload.method || 'Cash',
        vendor: action.payload.vendor || '',
        reference: action.payload.reference || '',
        notes: action.payload.notes || '',
        status,
        createdBy: state.auth?.userName || 'Finance',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        payments: amountPaid > 0 ? [{ id: idWithPrefix('EXPPAY-', []), amount: Math.min(amountPaid, amount), method: action.payload.method || 'Cash', staff: state.auth?.userName || 'Finance', createdAt: nowIso() }] : []
      };
      const nextData = {
        ...state.data,
        expenses: [expense, ...(state.data.expenses || [])],
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: expense.createdBy,
          role: state.auth?.role || 'billing',
          action: 'Expense created',
          module: 'Billing / Finance',
          entityId: expense.id,
          details: `${expense.category}: ${expense.description}`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Expense saved') } };
    }
    case 'RECORD_EXPENSE_PAYMENT': {
      const { expenseId, amount, method } = action.payload || {};
      const expense = (state.data.expenses || []).find((item) => item.id === expenseId);
      if (!expense) return { ...state, ui: { ...state.ui, toast: toast('error', 'Expense not found.') } };
      const numericAmount = Number(amount || 0);
      if (numericAmount <= 0) return { ...state, ui: { ...state.ui, toast: toast('error', 'Payment amount must be greater than zero.') } };
      const nextExpenses = (state.data.expenses || []).map((item) => {
        if (item.id !== expenseId) return item;
        const paid = Math.min(Number(item.amount || 0), Number(item.amountPaid || 0) + numericAmount);
        return {
          ...item,
          amountPaid: paid,
          status: paid >= Number(item.amount || 0) - 0.01 ? 'Paid' : 'Partial',
          payments: [...(item.payments || []), { id: idWithPrefix('EXPPAY-', item.payments || []), amount: numericAmount, method: method || item.method || 'Cash', staff: state.auth?.userName || 'Finance', createdAt: nowIso() }],
          updatedAt: nowIso()
        };
      });
      const nextData = {
        ...state.data,
        expenses: nextExpenses,
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Finance',
          role: state.auth?.role || 'billing',
          action: 'Expense payment recorded',
          module: 'Billing / Finance',
          entityId: expenseId,
          details: `${method || expense.method || 'Cash'} expense payment ${numericAmount}`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Expense payment recorded') } };
    }
    case 'WRITE_OFF_EXPENSE': {
      const { expenseId, reason } = action.payload || {};
      if (!String(reason || '').trim()) return { ...state, ui: { ...state.ui, toast: toast('error', 'Write-off requires a reason.') } };
      if (!String(action.payload?.supervisorCode || '').trim()) return { ...state, ui: { ...state.ui, toast: toast('error', 'Write-off requires supervisor approval.') } };
      const nextData = {
        ...state.data,
        expenses: (state.data.expenses || []).map((item) => item.id === expenseId ? { ...item, status: 'Written Off', writeOffReason: reason, supervisorCode: action.payload?.supervisorCode || '', approvedBy: action.payload?.supervisorCode || 'Supervisor', updatedAt: nowIso() } : item),
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Finance',
          role: state.auth?.role || 'billing',
          action: 'Expense written off',
          module: 'Billing / Finance',
          entityId: expenseId,
          details: `${reason} · approved by ${action.payload?.supervisorCode || 'Supervisor'}`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Expense written off') } };
    }
    case 'START_FINANCE_SHIFT': {
      const active = getActiveFinanceShift(state.data, state.auth?.userName || 'Billing');
      if (active) return { ...state, ui: { ...state.ui, toast: toast('error', `Shift ${active.id} is already open.`) } };
      const openingFloat = Number(action.payload?.openingFloat || 0);
      const shift = {
        id: idWithPrefix('SHIFT-', state.data.financeShifts || []),
        startedBy: state.auth?.userName || 'Billing',
        role: state.auth?.role || 'billing',
        shiftType: action.payload?.shiftType || 'Morning',
        openingFloat,
        status: 'Open',
        startedAt: nowIso(),
        closedAt: '',
        actualCash: 0,
        expectedCash: openingFloat,
        variance: 0,
        notes: action.payload?.notes || ''
      };
      const nextData = {
        ...state.data,
        financeShifts: [shift, ...(state.data.financeShifts || [])],
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: shift.startedBy,
          role: shift.role,
          action: 'Finance shift started',
          module: 'Billing / Finance',
          entityId: shift.id,
          details: `Opening float ${openingFloat}`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', `Shift ${shift.id} started`) } };
    }
    case 'CLOSE_FINANCE_SHIFT': {
      const shiftId = action.shiftId;
      const shift = (state.data.financeShifts || []).find((item) => item.id === shiftId && item.status === 'Open');
      if (!shift) return { ...state, ui: { ...state.ui, toast: toast('error', 'Open shift not found.') } };
      const transactions = (state.data.invoices || []).flatMap((invoice) => (invoice.transactions || []).filter((txn) => txn.shiftId === shiftId));
      const cashTotal = transactions.filter((txn) => txn.method === 'Cash').reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
      const cardTotal = transactions.filter((txn) => txn.method === 'Card').reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
      const transferTotal = transactions.filter((txn) => txn.method === 'Transfer').reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
      const insuranceTotal = transactions.filter((txn) => txn.method === 'Insurance').reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
      const mobileMoneyTotal = transactions.filter((txn) => txn.method === 'Mobile Money').reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
      const expectedCash = Number(shift.openingFloat || 0) + cashTotal;
      const actualCash = Number(action.payload?.actualCash || 0);
      const closed = {
        ...shift,
        status: 'Closed',
        closedAt: nowIso(),
        closedBy: state.auth?.userName || 'Billing',
        actualCash,
        expectedCash,
        variance: actualCash - expectedCash,
        cardTotal,
        cashTotal,
        transferTotal,
        insuranceTotal,
        mobileMoneyTotal,
        denominations: action.payload?.denominations || {},
        notes: action.payload?.notes || shift.notes || ''
      };
      const nextData = {
        ...state.data,
        financeShifts: state.data.financeShifts.map((item) => item.id === shiftId ? closed : item),
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: closed.closedBy,
          role: state.auth?.role || 'billing',
          action: 'Finance shift closed',
          module: 'Billing / Finance',
          entityId: shiftId,
          details: `Expected cash ${expectedCash}; actual ${actualCash}; variance ${closed.variance}`
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', `Shift ${shiftId} closed`) } };
    }
    case 'SEND_RESULT_TO_PATIENT': {
      const { orderId, channel } = action.payload || {};
      const order = (state.data.orders || []).find((item) => item.id === orderId);
      const patient = (state.data.patients || []).find((item) => item.id === order?.patientId);
      if (!order || !patient) return { ...state, ui: { ...state.ui, toast: toast('error', 'Order/patient not found.') } };
      const safeBody = `Your diagnosis center result for order ${orderId} is ready. Please contact the center or your referring doctor for secure review.`;
      const note = createRoleNotification(state.data, {
        title: `${channel} patient result message`,
        body: safeBody,
        audience: 'patient',
        channel,
        entityId: orderId,
        status: channel === 'Print' ? 'Printed' : 'Queued',
        deliveryType: 'Patient Result Notice'
      });
      const nextData = {
        ...state.data,
        notifications: [note, ...(state.data.notifications || [])],
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'Reception',
          role: state.auth?.role || 'receptionist',
          action: `${channel} result notice prepared`,
          module: 'Results Delivery',
          entityId: orderId,
          details: `Safe patient-facing message for ${patient.fullName}`
        })
      };
      if (channel === 'WhatsApp' && patient.phone) {
        const digits = patient.phone.replace(/[^0-9]/g, '');
        window.open(`https://wa.me/${digits}?text=${encodeURIComponent(safeBody)}`, '_blank', 'noopener,noreferrer');
      }
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', `${channel} action recorded`) } };
    }

    case 'UPDATE_NOTIFICATION_PREFS': {
      const doctorId = action.doctorId;
      const doctor = (state.data.doctors || []).find((item) => item.id === doctorId);
      if (!doctor) return { ...state, ui: { ...state.ui, toast: toast('error', 'Doctor profile not found.') } };
      const nextData = {
        ...state.data,
        doctors: state.data.doctors.map((item) => item.id === doctorId ? {
          ...item,
          notificationPreferences: { ...(item.notificationPreferences || {}), ...action.payload }
        } : item),
        auditLogs: addAudit(state.data.auditLogs || [], {
          actor: state.auth?.userName || 'System',
          role: state.auth?.role || 'doctor',
          action: 'Notification preferences updated',
          module: 'Doctor Portal',
          entityId: doctorId,
          details: JSON.stringify(action.payload)
        })
      };
      return { ...state, data: nextData, ui: { ...state.ui, toast: toast('success', 'Notification preferences saved') } };
    }
    default:
      return state;
  }
}

const AppStoreContext = createContext(null);

export function AppStoreProvider({ children }) {
  const [state, rawDispatch] = useReducer(reducer, undefined, getInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Write actions route to the backend through the async command layer while
  // UI/local actions hit the sync reducer directly. Pages dispatch the same
  // action shapes either way.
  const dispatch = useCallback((action) => {
    if (hasCommand(action.type)) {
      runCommand(action, dispatch, () => stateRef.current);
      return;
    }
    rawDispatch(action);
  }, []);

  // Revalidate the cookie session once on mount. A cached profile renders the
  // shell instantly; a dead session drops the user back to the login page.
  useEffect(() => {
    let cancelled = false;
    authService.me(apiClient)
      .then((user) => {
        if (cancelled) return;
        const auth = normalizeAuthUser(user?.user || user);
        if (auth) rawDispatch({ type: 'SET_AUTH', auth });
        else rawDispatch({ type: 'SET_AUTH', auth: null, navigate: 'login' });
      })
      .catch(() => {
        if (!cancelled) rawDispatch({ type: 'SET_AUTH', auth: null, navigate: 'login' });
      });
    return () => { cancelled = true; };
  }, []);

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);
  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const context = useContext(AppStoreContext);
  if (!context) throw new Error('useAppStore must be used inside AppStoreProvider');
  return context;
}
