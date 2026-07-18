function Modal({ title, children, on_close, footer, size = 'md' }) {
  return (
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
    </div>
  );
}

export default Modal;
