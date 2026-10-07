import { useEffect, useRef } from 'react';

function Overlay({ id, title, open, onClose, children, testId, kind }) {
  const headingRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    headingRef.current?.focus?.();
    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="flow-overlay" data-testid={testId ?? `${kind}-${id}`}>
      <button type="button" className="flow-backdrop" aria-label="Close" onClick={onClose} />
      <div
        className={kind === 'modal' ? 'flow-modal' : 'flow-drawer'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
      >
        <header className="flow-drawer-head">
          <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1}>{title}</h2>
          <button type="button" className="bar-button" onClick={onClose} data-testid={`${id}-close`}>
            Close
          </button>
        </header>
        <div className="flow-drawer-body">{children}</div>
      </div>
    </div>
  );
}

export function FlowDrawer(props) {
  return <Overlay kind="drawer" {...props} />;
}

export function FlowModal(props) {
  return <Overlay kind="modal" {...props} />;
}
