import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const CLOSE_MS = 280;
const DRAG_CLOSE_PX = 110;

function Modal({
  title,
  subtitle = null,
  children,
  on_close,
  footer,
  size = 'md',
  variant = 'sheet',
  trap_history = true,
  close_label = null,
  header_style = 'default',
}) {
  const is_sheet = variant === 'sheet' || variant === 'dialog';
  const is_closed_ref = useRef(false);
  const on_close_ref = useRef(on_close);
  const drag_start_y = useRef(0);
  const drag_delta = useRef(0);
  const sheet_ref = useRef(null);
  const [is_open, setIsOpen] = useState(false);
  const [is_closing, setIsClosing] = useState(false);
  const [drag_y, setDragY] = useState(0);
  const [is_dragging, setIsDragging] = useState(false);

  on_close_ref.current = on_close;

  const finishClose = useCallback(() => {
    if (is_closed_ref.current) {
      return;
    }
    is_closed_ref.current = true;
    on_close_ref.current?.();
  }, []);

  const beginClose = useCallback(() => {
    if (is_closed_ref.current || is_closing) {
      return;
    }

    if (trap_history && window.history.state?.ks_modal) {
      window.history.back();
      return;
    }

    setIsClosing(true);
    setIsOpen(false);
    window.setTimeout(finishClose, CLOSE_MS);
  }, [finishClose, is_closing, trap_history]);

  useEffect(() => {
    const previous_overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    is_closed_ref.current = false;

    const open_frame = window.requestAnimationFrame(() => setIsOpen(true));

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        beginClose();
      }
    }

    function handlePopState() {
      setIsClosing(true);
      setIsOpen(false);
      window.setTimeout(finishClose, CLOSE_MS);
    }

    if (trap_history) {
      window.history.pushState({ ks_modal: true }, '');
      window.addEventListener('popstate', handlePopState);
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(open_frame);
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
  }, [beginClose, finishClose, trap_history]);

  function onHandleTouchStart(event) {
    if (!is_sheet) {
      return;
    }
    drag_start_y.current = event.touches[0].clientY;
    drag_delta.current = 0;
    setIsDragging(true);
  }

  function onHandleTouchMove(event) {
    if (!is_dragging) {
      return;
    }
    const delta = Math.max(0, event.touches[0].clientY - drag_start_y.current);
    drag_delta.current = delta;
    setDragY(delta);
  }

  function onHandleTouchEnd() {
    if (!is_dragging) {
      return;
    }
    setIsDragging(false);
    if (drag_delta.current >= DRAG_CLOSE_PX) {
      setDragY(0);
      beginClose();
      return;
    }
    setDragY(0);
  }

  const show_header = title || close_label || subtitle;
  const sheet_style = drag_y > 0
    ? { transform: `translate3d(0, ${drag_y}px, 0)` }
    : undefined;

  return createPortal(
    <div
      className={[
        'modal-overlay',
        'is-sheet',
        is_open ? 'is-open' : '',
        is_closing ? 'is-closing' : '',
      ].filter(Boolean).join(' ')}
      onClick={beginClose}
      role="presentation"
    >
      <div
        ref={sheet_ref}
        className={[
          'modal',
          `modal-${size}`,
          'is-sheet',
          is_open ? 'is-open' : '',
          is_closing ? 'is-closing' : '',
          is_dragging ? 'is-dragging' : '',
        ].filter(Boolean).join(' ')}
        style={sheet_style}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        <div
          className="sheet-handle-zone"
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
          onTouchCancel={onHandleTouchEnd}
        >
          <div className="sheet-handle" aria-hidden="true" />
        </div>

        {show_header && (
          <div className={`modal-header sheet-header${header_style === 'bar' ? ' is-bar' : ''}`}>
            {close_label && (
              <button
                type="button"
                className={`modal-back-btn${header_style === 'bar' ? ' is-icon' : ''}`}
                onClick={beginClose}
                aria-label={close_label}
              >
                <span aria-hidden="true">←</span>
                {header_style !== 'bar' && close_label}
              </button>
            )}
            <div className="modal-header-copy">
              {title && <h3 className="modal-title">{title}</h3>}
              {subtitle && <p className="modal-subtitle">{subtitle}</p>}
            </div>
            <button
              type="button"
              className="sheet-close-btn"
              onClick={beginClose}
              aria-label={close_label || 'Close'}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        )}

        <div className="modal-body sheet-body">{children}</div>

        {footer && <div className="modal-footer sheet-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export default Modal;
