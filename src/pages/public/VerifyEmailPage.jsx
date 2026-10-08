import { useState } from 'react';
import { CheckCircle2, MailCheck, TriangleAlert } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { apiClient } from '../../store/commands';
import { authService } from '../../services/authService';

/*
  Confirming an email address.

  This is the page an emailed link opens, and nothing happens when it opens. The
  person has to press the button.

  That is deliberate and it is the whole design. Mail gateways open every link in
  a message to scan it for malware, and some run the page; a link that confirmed
  the address on being opened would be spent by the scanner, and the person it was
  sent to would arrive to be told it had expired. A button that only a person
  presses cannot be spent by anything else.

  It is also public: the link is often opened on a phone that is not signed in to
  CurataMed, and the token in it is the only credential needed.
*/

function tokenFromAddress() {
  const match = String(window.location.hash || '').match(/verify-email\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export function VerifyEmailPage() {
  const token = tokenFromAddress();
  const [status, setStatus] = useState('ready'); // ready | working | done | failed
  const [message, setMessage] = useState('');

  async function confirm() {
    setStatus('working');
    setMessage('');
    try {
      await authService.verifyEmail(apiClient, token);
      setStatus('done');
    } catch (error) {
      setStatus('failed');
      setMessage(error?.message || 'This link could not be confirmed. Request a new one from Facility Setup.');
    }
  }

  // A full reload rather than a route change: the signed-in session, if there is
  // one, only learns the address is verified by asking the server again.
  const goToApp = () => window.location.assign(window.location.pathname + window.location.search);

  return (
    <main className="public-ambient min-h-screen px-3 py-8 text-slate-900 sm:px-4">
      <div className="mx-auto max-w-lg">
        <Card
          title="Confirm your email address"
          subtitle="One press and this address is confirmed for your CurataMed account."
          actions={<MailCheck className="h-6 w-6 text-clinical-600" aria-hidden="true" />}
        >
          {!token && (
            <div role="alert" className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
              <p>This link is incomplete. Open it again from the email, or request a new one from Facility Setup.</p>
            </div>
          )}

          {token && status !== 'done' && (
            <div className="space-y-4">
              <p className="text-sm leading-6 text-slate-600">
                You asked CurataMed to confirm this email address. Press the button below to finish. If you did not ask for this, close the page; nothing changes.
              </p>
              {status === 'failed' && (
                <div role="alert" className="flex gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <p>{message}</p>
                </div>
              )}
              <Button onClick={confirm} disabled={status === 'working'}>
                {status === 'working' ? 'Confirming…' : status === 'failed' ? 'Try again' : 'Confirm my email'}
              </Button>
            </div>
          )}

          {status === 'done' && (
            <div className="space-y-4">
              <div role="status" className="flex gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                <p className="font-semibold">Your email address is confirmed.</p>
              </div>
              <Button onClick={goToApp}>Continue to CurataMed</Button>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
