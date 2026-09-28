import { lazy, Suspense, useEffect } from 'react';
import { useAppStore } from '../store/AppStore';
import { canAccessPage } from '../utils/permissions';
import { PAGE_META } from './routeRegistry';

// Lazy-load every page so each becomes its own chunk, split out of the main
// bundle and fetched on demand. `lazyPage` adapts our named page exports to the
// default-export shape React.lazy expects.
const lazyPage = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })));

const OverviewPage = lazyPage(() => import('../pages/dashboards/OverviewPage'), 'OverviewPage');
const RoleDashboard = lazyPage(() => import('../pages/dashboards/RoleDashboard'), 'RoleDashboard');
const PlaceholderPage = lazyPage(() => import('../pages/PlaceholderPage'), 'PlaceholderPage');
const AccessRestrictedPage = lazyPage(() => import('../pages/auth/AccessRestrictedPage'), 'AccessRestrictedPage');
const OrderRegistryPage = lazyPage(() => import('../pages/core/OrderRegistryPage'), 'OrderRegistryPage');
const PatientRecordsPage = lazyPage(() => import('../pages/core/PatientRecordsPage'), 'PatientRecordsPage');
const DoctorPortalPage = lazyPage(() => import('../pages/doctor/DoctorPortalPage'), 'DoctorPortalPage');
const DoctorNewOrderPage = lazyPage(() => import('../pages/doctor/DoctorNewOrderPage'), 'DoctorNewOrderPage');
const DoctorResultsPage = lazyPage(() => import('../pages/doctor/DoctorResultsPage'), 'DoctorResultsPage');
const DoctorActiveOrdersPage = lazyPage(() => import('../pages/doctor/DoctorActiveOrdersPage'), 'DoctorActiveOrdersPage');
const DoctorCompletedOrdersPage = lazyPage(() => import('../pages/doctor/DoctorCompletedOrdersPage'), 'DoctorCompletedOrdersPage');
const DoctorPatientTrendsPage = lazyPage(() => import('../pages/doctor/DoctorPatientTrendsPage'), 'DoctorPatientTrendsPage');
const AuditLogPage = lazyPage(() => import('../pages/admin/AuditLogPage'), 'AuditLogPage');
const UserManagementPage = lazyPage(() => import('../pages/admin/UserManagementPage'), 'UserManagementPage');
const HospitalsPage = lazyPage(() => import('../pages/admin/HospitalsPage'), 'HospitalsPage');
const NotificationSettingsPage = lazyPage(() => import('../pages/admin/NotificationSettingsPage'), 'NotificationSettingsPage');
const AdminSettingsPage = lazyPage(() => import('../pages/admin/AdminSettingsPage'), 'AdminSettingsPage');
const ReportsPage = lazyPage(() => import('../pages/admin/ReportsPage'), 'ReportsPage');
const ResultsDeliveryPage = lazyPage(() => import('../pages/results/ResultsDeliveryPage'), 'ResultsDeliveryPage');
const SecurityReliabilityPage = lazyPage(() => import('../pages/security/SecurityReliabilityPage'), 'SecurityReliabilityPage');
const LabQueuePage = lazyPage(() => import('../pages/lab/LabQueuePage'), 'LabQueuePage');
const SampleLogPage = lazyPage(() => import('../pages/lab/SampleLogPage'), 'SampleLogPage');
const LabAcceptPage = lazyPage(() => import('../pages/lab/LabAcceptPage'), 'LabAcceptPage');
const AcceptedSamplesPage = lazyPage(() => import('../pages/lab/AcceptedSamplesPage'), 'AcceptedSamplesPage');
const LabReviewPage = lazyPage(() => import('../pages/lab/LabReviewPage'), 'LabReviewPage');
const LabResultsPage = lazyPage(() => import('../pages/lab/LabResultsPage'), 'LabResultsPage');
const LabRejectedSamplesPage = lazyPage(() => import('../pages/lab/LabRejectedSamplesPage'), 'LabRejectedSamplesPage');
const ScanQueuePage = lazyPage(() => import('../pages/scan/ScanQueuePage'), 'ScanQueuePage');
const ScanAcceptPage = lazyPage(() => import('../pages/scan/ScanAcceptPage'), 'ScanAcceptPage');
const AcceptedScansPage = lazyPage(() => import('../pages/scan/AcceptedScansPage'), 'AcceptedScansPage');
const ScanReviewPage = lazyPage(() => import('../pages/scan/ScanReviewPage'), 'ScanReviewPage');
const ScanRejectedPage = lazyPage(() => import('../pages/scan/ScanRejectedPage'), 'ScanRejectedPage');
const EquipmentBookingPage = lazyPage(() => import('../pages/scan/EquipmentBookingPage'), 'EquipmentBookingPage');
const IncomingOrdersPage = lazyPage(() => import('../pages/reception/IncomingOrdersPage'), 'IncomingOrdersPage');
const PatientCheckInPage = lazyPage(() => import('../pages/reception/PatientCheckInPage'), 'PatientCheckInPage');
const ReceptionWalkInsPage = lazyPage(() => import('../pages/reception/ReceptionWalkInsPage'), 'ReceptionWalkInsPage');
const AppointmentsPage = lazyPage(() => import('../pages/reception/AppointmentsPage'), 'AppointmentsPage');
const ReceptionDailyVisitsPage = lazyPage(() => import('../pages/reception/ReceptionDailyVisitsPage'), 'ReceptionDailyVisitsPage');
const ReceptionResultsInboxPage = lazyPage(() => import('../pages/reception/ReceptionResultsInboxPage'), 'ReceptionResultsInboxPage');
const InvoicesPage = lazyPage(() => import('../pages/billing/InvoicesPage'), 'InvoicesPage');
const PriceCatalogPage = lazyPage(() => import('../pages/billing/PriceCatalogPage'), 'PriceCatalogPage');
const FinanceShiftPage = lazyPage(() => import('../pages/billing/FinanceShiftPage'), 'FinanceShiftPage');
const FloatTrackerPage = lazyPage(() => import('../pages/billing/FloatTrackerPage'), 'FloatTrackerPage');
const ExpensesPage = lazyPage(() => import('../pages/billing/ExpensesPage'), 'ExpensesPage');
const AccountLedgerPage = lazyPage(() => import('../pages/billing/AccountLedgerPage'), 'AccountLedgerPage');
const BillingAnalyticsPage = lazyPage(() => import('../pages/billing/BillingAnalyticsPage'), 'BillingAnalyticsPage');
const ApiReadinessPage = lazyPage(() => import('../pages/system/ApiReadinessPage'), 'ApiReadinessPage');
const RolesPage = lazyPage(() => import('../pages/admin/RolesPage'), 'RolesPage');
const OpdQueuePage = lazyPage(() => import('../pages/opd/OpdQueuePage'), 'OpdQueuePage');
const EmergencyBoardPage = lazyPage(() => import('../pages/opd/OpdQueuePage'), 'EmergencyBoardPage');
const PharmacyDispensingPage = lazyPage(() => import('../pages/pharmacy/PharmacyDispensingPage'), 'PharmacyDispensingPage');
const PharmacyStockPage = lazyPage(() => import('../pages/pharmacy/PharmacyStockPage'), 'PharmacyStockPage');
const WardBoardPage = lazyPage(() => import('../pages/inpatient/WardBoardPage'), 'WardBoardPage');
const ClinicQueuePage = lazyPage(() => import('../pages/opd/OpdQueuePage'), 'ClinicQueuePage');
const MaternityRegisterPage = lazyPage(() => import('../pages/maternity/MaternityRegisterPage'), 'MaternityRegisterPage');
const ImmunizationDueListPage = lazyPage(() => import('../pages/childHealth/ImmunizationDueListPage'), 'ImmunizationDueListPage');
const TheatreListPage = lazyPage(() => import('../pages/theatre/TheatreListPage'), 'TheatreListPage');
const PlatformFacilitiesPage = lazyPage(() => import('../pages/platform/PlatformFacilitiesPage'), 'PlatformFacilitiesPage');

const roleDashboardMap = {
  'doctor-dashboard': 'doctor',
  'reception-dashboard': 'receptionist',
  'lab-dashboard': 'lab',
  'scan-dashboard': 'scan',
  'billing-dashboard': 'billing',
  'admin-dashboard': 'admin'
};

function PageFallback() {
  return (
    <div role="status" aria-live="polite" style={{ padding: '2rem', textAlign: 'center', color: '#475569', fontWeight: 600 }}>
      Loading…
    </div>
  );
}

function resolvePage(pageId, role, modules) {
  if (!canAccessPage(role, pageId, modules)) {
    return <AccessRestrictedPage pageId={pageId} />;
  }

  if (pageId === 'overview') return <OverviewPage />;
  if (pageId === 'orders') return <OrderRegistryPage />;
  if (pageId === 'patients') return <PatientRecordsPage />;
  if (pageId === 'doctor-dashboard') return <DoctorPortalPage />;
  if (pageId === 'doctor-new-order') return <DoctorNewOrderPage />;
  if (pageId === 'doctor-active-orders') return <DoctorActiveOrdersPage />;
  if (pageId === 'doctor-completed-orders') return <DoctorCompletedOrdersPage />;
  if (pageId === 'doctor-results') return <DoctorResultsPage />;
  if (pageId === 'doctor-patient-trends') return <DoctorPatientTrendsPage />;
  if (pageId === 'audit-log') return <AuditLogPage />;
  if (pageId === 'users') return <UserManagementPage />;
  if (pageId === 'hospitals') return <HospitalsPage />;
  if (pageId === 'notification-settings') return <NotificationSettingsPage />;
  if (pageId === 'settings') return <AdminSettingsPage />;
  if (pageId === 'reports') return <ReportsPage />;
  if (pageId === 'result-delivery') return <ResultsDeliveryPage />;
  if (pageId === 'security') return <SecurityReliabilityPage />;
  if (pageId === 'lab-queue') return <LabQueuePage />;
  if (pageId === 'sample-log') return <SampleLogPage />;
  if (pageId === 'lab-accept') return <LabAcceptPage />;
  if (pageId === 'accepted-samples') return <AcceptedSamplesPage />;
  if (pageId === 'lab-review') return <LabReviewPage />;
  if (pageId === 'lab-results') return <LabResultsPage />;
  if (pageId === 'lab-rejections') return <LabRejectedSamplesPage />;
  if (pageId === 'scan-queue') return <ScanQueuePage />;
  if (pageId === 'scan-accept') return <ScanAcceptPage />;
  if (pageId === 'accepted-scans') return <AcceptedScansPage />;
  if (pageId === 'scan-review') return <ScanReviewPage />;
  if (pageId === 'scan-rejections') return <ScanRejectedPage />;
  if (pageId === 'equipment-booking') return <EquipmentBookingPage />;
  if (pageId === 'incoming-orders') return <IncomingOrdersPage />;
  if (pageId === 'patient-checkin') return <PatientCheckInPage />;
  if (pageId === 'reception-walkins') return <ReceptionWalkInsPage />;
  if (pageId === 'appointments') return <AppointmentsPage />;
  if (pageId === 'daily-visits') return <ReceptionDailyVisitsPage />;
  if (pageId === 'reception-results') return <ReceptionResultsInboxPage />;
  if (pageId === 'invoices') return <InvoicesPage />;
  if (pageId === 'finance-shift') return <FinanceShiftPage />;
  if (pageId === 'float-tracker') return <FloatTrackerPage />;
  if (pageId === 'expenses') return <ExpensesPage />;
  if (pageId === 'account-ledger') return <AccountLedgerPage />;
  if (pageId === 'billing-analytics') return <BillingAnalyticsPage />;
  if (pageId === 'price-catalog') return <PriceCatalogPage />;
  if (pageId === 'api-readiness') return <ApiReadinessPage />;
  if (pageId === 'platform-facilities') return <PlatformFacilitiesPage />;
  if (pageId === 'roles') return <RolesPage />;
  if (pageId === 'opd-queue') return <OpdQueuePage />;
  if (pageId === 'emergency-board') return <EmergencyBoardPage />;
  if (pageId === 'pharmacy-dispensing') return <PharmacyDispensingPage />;
  if (pageId === 'pharmacy-stock') return <PharmacyStockPage />;
  if (pageId === 'ward-board') return <WardBoardPage />;
  if (pageId === 'theatre-list') return <TheatreListPage />;
  if (pageId === 'clinic-antenatal') return <ClinicQueuePage clinic="ANTENATAL" />;
  if (pageId === 'clinic-postnatal') return <ClinicQueuePage clinic="POSTNATAL" />;
  if (pageId === 'maternity-register') return <MaternityRegisterPage />;
  if (pageId === 'clinic-child-welfare') return <ClinicQueuePage clinic="CHILD_WELFARE" />;
  if (pageId === 'immunisation-due') return <ImmunizationDueListPage />;
  if (pageId === 'clinic-dental') return <ClinicQueuePage clinic="DENTAL" />;
  if (pageId === 'clinic-eye') return <ClinicQueuePage clinic="EYE" />;
  if (pageId === 'clinic-physiotherapy') return <ClinicQueuePage clinic="PHYSIOTHERAPY" />;
  if (pageId === 'clinic-dietetics') return <ClinicQueuePage clinic="DIETETICS" />;
  if (roleDashboardMap[pageId]) return <RoleDashboard role={roleDashboardMap[pageId]} />;

  const meta = PAGE_META[pageId] || {
    title: 'Module Overview',
    section: 'Foundation',
    description: 'This module is available from the navigation workspace.',
    requirements: []
  };

  return <PlaceholderPage {...meta} />;
}

export function AppRouter() {
  const { state } = useAppStore();
  const pageId = state.currentPage || 'overview';
  const role = state.auth?.role || 'admin';

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const main = document.getElementById('main-content');
    if (main) {
      main.scrollTop = 0;
      main.scrollLeft = 0;
      main.focus({ preventScroll: true });
    }
  }, [pageId]);

  return <Suspense fallback={<PageFallback />}>{resolvePage(pageId, role, state.auth?.modules)}</Suspense>;
}
