import React from 'react';
import { createPortal } from 'react-dom';

/** Escape workspace/card stacking contexts while retaining Nexus theme tokens. */
export default function NexusOverlay(props: React.HTMLAttributes<HTMLDivElement>) {
  return createPortal(
    <div className="nexus-page nexus-refined nexus-overlay-root">
      <div {...props} />
    </div>,
    document.body,
  );
}
