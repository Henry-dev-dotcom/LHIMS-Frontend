import { useEffect } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function getFocusable(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (element) => element.offsetParent !== null || element === document.activeElement
  );
}

/**
 * Traps Tab focus within `containerRef` while `active` is true, cycling between
 * the first and last focusable elements. Mirrors the Modal's trap so overlay
 * surfaces (drawers, menus) behave consistently for keyboard users.
 */
export function useFocusTrap(containerRef, active) {
  useEffect(() => {
    if (!active) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    const handleKeyDown = (event) => {
      if (event.key !== 'Tab') return;
      const focusable = getFocusable(container);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      // If focus has escaped the container, pull it back in.
      if (!container.contains(activeElement)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, active]);
}
