import { RefObject, useEffect, useRef } from 'react';

/** Keep keyboard navigation in the active dialog and restore its opener on close. */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, active: boolean, onClose: () => void) {
  const closeHandler = useRef(onClose);
  closeHandler.current = onClose;
  useEffect(() => {
    if (!active || !ref.current) return;
    const dialog = ref.current;
    const opener = document.activeElement as HTMLElement | null;
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')).filter(el => !el.closest('[hidden]'));
    (controls()[0] || dialog).focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeHandler.current(); }
      if (event.key !== 'Tab') return;
      const elements = controls();
      if (!elements.length) { event.preventDefault(); dialog.focus(); return; }
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener('keydown', handleKey);
    return () => { dialog.removeEventListener('keydown', handleKey); if (opener?.isConnected) opener.focus(); };
    // The open/close transition owns focus; changing callback identities must not reset typing focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ref]);
}
