import { useEffect } from 'react';
import { LockKeyhole, ShieldAlert } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ROLES } from '../../data/roles';
import { useAppStore } from '../../store/AppStore';
import { getAllowedRolesForPage, getDefaultPageForRole, getRoleLabel } from '../../utils/permissions';

export function AccessRestrictedPage({ pageId }) {
  const { state, dispatch } = useAppStore();
  const role = state.auth?.role || 'guest';
  const allowed = getAllowedRolesForPage(pageId);

  useEffect(() => {
    dispatch({ type: 'LOG_RESTRICTED_ACCESS', pageId });
  }, [dispatch, pageId]);

  return (
    <div>
      <PageHeader
        eyebrow="Permission guard"
        title="Access restricted"
        description="This route exists, but the current role is not allowed to view it. The polished permission guard keeps restricted clinical, financial and admin workflows visibly protected."
      />
      <Card>
        <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
          <div className="rounded-3xl border border-red-100 bg-red-50 p-6">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-danger text-white">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-slate-900">Current role: {getRoleLabel(role)}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">The requested page is blocked by the permission matrix.</p>
            <Button className="mt-5" onClick={() => dispatch({ type: 'NAVIGATE', pageId: getDefaultPageForRole(role) })}>
              Return to my dashboard
            </Button>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <ShieldAlert className="h-5 w-5 text-amber-500" /> Allowed roles for this route
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {ROLES.map((item) => {
                const isAllowed = allowed.includes(item.id);
                return (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold text-slate-900">{item.label}</p>
                      <StatusBadge status={isAllowed ? 'Allowed' : 'Blocked'} />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{item.accessSummary}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
