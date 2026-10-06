import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { idWithPrefix, addAudit, nowIso } from '../workflow/workflowEngine';
import { buildParameterEntries } from '../utils/labFlags';
import { apiClient, hasCommand, runCommand } from './commands';
import { authService } from '../services/authService';
import { getStoredSession } from '../api/config';
import { canAccessPage } from '../utils/permissions';
import { normalizeAuthUser } from '../api/normalizers';
import { hydrateWorkspace } from './hydrate';

// Legacy demo-store persistence key; cleared on boot so stale seed data never leaks in.
const LEGACY_STORAGE_KEY = 'diagnosis-center-change-pack-v1-state';

/* All collections start empty and are hydrated from the backend after login.
   The key set mirrors what pages read from state.data. */
const emptyData = {
  hospitals: [],
  doctors: [],
  users: [],
  departments: [],
  patients: [],
  catalog: [],
  orders: [],
  results: [],
  resultReports: [],
  invoices: [],
  labAnalyzers: ['Sysmex XN-550', 'Cobas c111', 'Mindray BS-240', 'Manual microscopy bench'],
  scanEquipment: [],
  sampleLogs: [],
  scanBookings: [],
  scanRejections: [],
  appointments: [],
  dailyVisits: [],
  duplicateFlags: [],
  adjustments: [],
  floatAdjustments: [],
  expenses: [],
  financeShifts: [],
  auditLogs: [],
  notifications: [],
  securityEvents: [],
  backupExports: [],
  deliveryLogs: [],
  equipment: [],
  notificationSettings: { email: true, sms: true, inApp: true }
};

const initialState = {
  auth: null,
  currentPage: 'login',
  data: emptyData,
  hydrating: false,
  ui: {
    sidebarOpen: false,
    toast: null,
    activeLabAcceptOrderId: '',
    // What the laboratory just accepted, so the slip that goes with the samples
    // can be printed. Cleared when the bench closes the printout.
    acceptedPrintout: null,
    activeAcceptedSampleOrderId: '',
    activeScanAcceptOrderId: '',
    activeAcceptedScanOrderId: '',
    activeWalkInPatientId: '',
    activeWalkInVisitId: ''
  }
};

/*
  The workspace page named in the address, if the signed-in role may open it.

  Reloading used to drop whoever was signed in back on their landing page,
  losing the screen they were working on. The page now lives in the address as
  #/app/<page>, and this reads it back. It is checked against the same
  canAccessPage the sidebar uses, so an address cannot open a page the role
  could not otherwise reach.
*/
function pageFromAddress(auth) {
  try {
    const path = (window.location.hash || '').replace(/^#\/?/, '').split('?')[0];
    const [section, pageId] = path.split('/').filter(Boolean);
    if (section !== 'app' || !pageId) return null;
    return canAccessPage(auth.role, pageId, auth.modules) ? pageId : null;
  } catch {
    return null;
  }
}

function getInitialState() {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    // Render the shell immediately from the cached (non-sensitive) profile;
    // the session is revalidated against /auth/me on mount.
    const cached = normalizeAuthUser(getStoredSession().user);
    if (cached) {
      // Data hydrates asynchronously right after mount; start in the
      // hydrating state so pages don't flash an empty/"no records" view.
      return { ...initialState, auth: cached, currentPage: pageFromAddress(cached) || cached.landing, hydrating: true };
    }
  } catch {
    // Fall through to the logged-out state.
  }
  return initialState;
}

function toast(type, message) {
  return { type, message };
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
        // Dropping the session also drops the hydrated workspace data.
        data: action.auth ? state.data : emptyData,
        currentPage: action.navigate || (action.auth ? state.currentPage : 'login'),
        ui: { ...state.ui, sidebarOpen: false }
      };
    }
    case 'SET_HYDRATING': {
      return { ...state, hydrating: action.hydrating };
    }
    case 'SET_COLLECTIONS': {
      return { ...state, data: { ...state.data, ...action.collections } };
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
    case 'OPEN_SCAN_ACCEPT': {
      return { ...state, currentPage: 'scan-queue', ui: { ...state.ui, sidebarOpen: false, activeScanAcceptOrderId: action.orderId } };
    }
    case 'OPEN_ACCEPTED_SCAN': {
      return { ...state, currentPage: 'accepted-scans', ui: { ...state.ui, sidebarOpen: false, activeAcceptedScanOrderId: action.orderId } };
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
      return { ...state, currentPage: 'lab-accept', ui: { ...state.ui, sidebarOpen: false, activeLabAcceptOrderId: action.orderId, acceptedPrintout: null } };
    }
    case 'LAB_SAMPLES_ACCEPTED': {
      return { ...state, ui: { ...state.ui, acceptedPrintout: { orderId: action.orderId, samples: action.samples || [] } } };
    }
    case 'CLOSE_ACCEPTED_PRINTOUT': {
      return { ...state, ui: { ...state.ui, acceptedPrintout: null } };
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

  // Hydrate the workspace whenever an authenticated user (re)appears. The
  // hydrating flag gates the shell's first paint so pages don't flash an
  // empty/"no records" state while the initial fetch is in flight.
  const authUserId = state.auth?.userId || '';
  useEffect(() => {
    if (!authUserId) return;
    let cancelled = false;
    rawDispatch({ type: 'SET_HYDRATING', hydrating: true });
    hydrateWorkspace(apiClient, stateRef.current.auth, rawDispatch)
      .finally(() => {
        if (!cancelled) rawDispatch({ type: 'SET_HYDRATING', hydrating: false });
      });
    return () => { cancelled = true; };
  }, [authUserId]);

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);
  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const context = useContext(AppStoreContext);
  if (!context) throw new Error('useAppStore must be used inside AppStoreProvider');
  return context;
}
