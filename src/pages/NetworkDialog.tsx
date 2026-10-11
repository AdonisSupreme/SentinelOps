import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function NetworkDialog({ children, onClose, label }: {children:React.ReactNode; onClose:()=>void; label:string}) {
  const ref=useRef<HTMLDivElement>(null);
  const close=useRef(onClose); close.current=onClose;
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement | null;
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden'; ref.current?.focus();
    const keyboard=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){ event.preventDefault(); close.current(); }
      if(event.key!=='Tab')return;
      const items=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex="0"]') || []).filter(el=>el.getClientRects().length);
      const first=items[0], last=items[items.length-1];
      if(!first){event.preventDefault();return;}
      if(event.shiftKey && (document.activeElement===first || document.activeElement===ref.current)){event.preventDefault();last.focus();}
      else if(!event.shiftKey && (document.activeElement===last || document.activeElement===ref.current)){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',keyboard);
    return()=>{document.body.style.overflow=overflow; document.removeEventListener('keydown',keyboard);previous?.focus();};
  },[]);
  return createPortal(<div className="network-sentinel-page network-modern network-overlay-root"><div className="editor-backdrop" onClick={onClose}><div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className="network-dialog-container" onClick={event=>event.stopPropagation()}>{children}</div></div></div>,document.body);
}
