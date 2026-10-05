import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import NexusOverlay from './NexusOverlay';

test('details escape the workspace stacking context and retain close handlers', () => {
  const close = jest.fn();
  const { container, unmount } = render(
    <section style={{ isolation: 'isolate' }}>
      <NexusOverlay role="dialog" aria-label="Service details" className="nexus-modal-backdrop">
        <button onClick={close}>Close detail</button>
      </NexusOverlay>
    </section>,
  );
  const dialog = screen.getByRole('dialog', { name: 'Service details' });
  expect(container.contains(dialog)).toBe(false);
  expect(dialog.parentElement?.parentElement).toBe(document.body);
  fireEvent.click(screen.getByRole('button', { name: 'Close detail' }));
  expect(close).toHaveBeenCalledTimes(1);
  unmount();
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('nested verification remains a separate overlay and forwards guarded events', () => {
  const guard = jest.fn((event: React.MouseEvent) => event.stopPropagation());
  const parent = jest.fn();
  render(<div onClick={parent}>
    <NexusOverlay role="dialog" aria-label="Service" className="nexus-modal-backdrop">
      <NexusOverlay role="dialog" aria-label="Verification" className="nexus-modal-backdrop service-control-otp-backdrop" onClickCapture={guard}>
        <button>Guarded action</button>
      </NexusOverlay>
    </NexusOverlay>
  </div>);
  const verification = screen.getByRole('dialog', { name: 'Verification' });
  expect(screen.getByRole('dialog', { name: 'Service' }).contains(verification)).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Guarded action' }));
  expect(guard).toHaveBeenCalledTimes(1);
  expect(parent).not.toHaveBeenCalled();
});
