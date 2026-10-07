import { canAccessPage } from './permissions';

/*
  The workspace page named in the address.

  A workspace screen lives at `#/app/<page>`, so that refreshing returns somebody
  to the screen they were on, and so a screen can be linked to at all. This reads
  that back, checked against the same canAccessPage the sidebar uses - an address
  must not open a page the role could not otherwise reach.

  Shared by the store, which reads it once at startup, and by the app shell,
  which watches for it changing afterwards. One definition, because two copies of
  this rule would eventually disagree about what a role may open.
*/
export function pageFromAddress(auth, hash = typeof window === 'undefined' ? '' : window.location.hash) {
  try {
    if (!auth) return null;
    const path = (hash || '').replace(/^#\/?/, '').split('?')[0];
    const [section, pageId] = path.split('/').filter(Boolean);
    if (section !== 'app' || !pageId) return null;
    return canAccessPage(auth.role, pageId, auth.modules) ? pageId : null;
  } catch {
    return null;
  }
}

/** The address a workspace page should be at. */
export function workspaceHash(pageId) {
  return `#/app/${pageId}`;
}
