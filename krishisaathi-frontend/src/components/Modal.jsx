import { useEffect } from 'react';
import { createPortal } from 'react-dom';

function Modal({ title, children, on_close, footer, size = 'md' }) {
  useEffect(() => {
    const previous_overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        on_close?.();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previous_overflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [on_close]);

  return createPortal(
    <div className="modal-overlay" onClick={on_close} role="presentation">
      <div
        className={`modal modal-${size}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        {title && <h3 className="modal-title">{title}</h3>}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export default Modal;
