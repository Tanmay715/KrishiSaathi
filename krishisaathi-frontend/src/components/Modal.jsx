import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

function Modal({
  title,
  children,
  on_close,
  footer,
  size = 'md',
  variant = 'dialog',
  trap_history = true,
  close_label = null,
}) {
  const is_closed_ref = useRef(false);
  const on_close_ref = useRef(on_close);
  on_close_ref.current = on_close;

  useEffect(() => {
    const previous_overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    is_closed_ref.current = false;

    function finishClose() {
      if (is_closed_ref.current) {
        return;
      }
      is_closed_ref.current = true;
      on_close_ref.current?.();
    }

    function requestClose() {
      if (trap_history && window.history.state?.ks_modal) {
        window.history.back();
        return;
      }
      finishClose();
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        requestClose();
      }
    }

    function handlePopState() {
      finishClose();
    }

    if (trap_history) {
      window.history.pushState({ ks_modal: true }, '');
      window.addEventListener('popstate', handlePopState);
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previous_overflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (trap_history) {
        window.removeEventListener('popstate', handlePopState);
        if (!is_closed_ref.current && window.history.state?.ks_modal) {
          is_closed_ref.current = true;
          window.history.back();
        }
      }
    };
  }, [trap_history]);

  function handleOverlayClose() {
    if (trap_history && window.history.state?.ks_modal) {
      window.history.back();
      return;
    }
    on_close_ref.current?.();
  }

  return createPortal(
    <div
      className={`modal-overlay${variant === 'sheet' ? ' is-sheet' : ''}`}
      onClick={handleOverlayClose}
      role="presentation"
    >
      <div
        className={`modal modal-${size}${variant === 'sheet' ? ' is-sheet' : ''}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        {(title || close_label) && (
          <div className="modal-header">
            {close_label && (
              <button
                type="button"
                className="modal-back-btn"
                onClick={handleOverlayClose}
              >
                <span aria-hidden="true">←</span>
                {close_label}
              </button>
            )}
            {title && <h3 className="modal-title">{title}</h3>}
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export default Modal;
