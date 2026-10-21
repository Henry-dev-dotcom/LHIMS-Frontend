import { useEffect, useState } from 'react';

/*
  "Install Now": lets a subscriber put CurataMed on a phone or PC as an app.
  Chrome/Edge/Android hand us a `beforeinstallprompt` event once - it can fire
  before any page mounts, so the listener is attached at import time (main.jsx)
  and the event is held here. iOS Safari has no such event; there the button
  shows the Share -> Add to Home Screen steps instead.
*/
let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function isIos() {
  if (typeof navigator === 'undefined') return false;
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || iPadOs;
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

/** Returns { installed, canPrompt, ios, install }. install() resolves to 'accepted' | 'dismissed' | 'manual'. */
export function useInstallApp() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  async function install() {
    if (!deferredPrompt) return 'manual';
    const prompt = deferredPrompt;
    deferredPrompt = null;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    notify();
    return outcome;
  }

  return { installed: isStandalone(), canPrompt: Boolean(deferredPrompt), ios: isIos(), install };
}
