import { useState } from 'react';
import { useInstallApp } from '../../utils/pwaInstall';

/** "Install Now" link for the public pages. Hidden once the app is already installed. */
export function InstallAppButton({ className = 'font-semibold text-clinical-700 underline' }) {
  const { installed, canPrompt, ios, install } = useInstallApp();
  const [help, setHelp] = useState(false);

  if (installed) return null;

  async function onClick() {
    const result = await install();
    if (result === 'manual') setHelp((v) => !v);
  }

  const steps = ios
    ? 'On iPhone/iPad: tap the Share button in Safari, then "Add to Home Screen".'
    : 'In your browser menu choose "Install CurataMed" (or "Add to Home screen" on a phone). If you do not see it, open this page in Chrome or Edge.';

  return (
    <>
      <button type="button" onClick={onClick} className={className} aria-expanded={canPrompt ? undefined : help}>Install Now</button>
      {help && <span role="status" className="mt-1 block text-[11px] font-normal text-slate-400">{steps}</span>}
    </>
  );
}
