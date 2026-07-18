import { useEffect, useRef, useState } from 'react';

function OverflowMenu({ items = [], label = 'More' }) {
  const [is_open, setIsOpen] = useState(false);
  const root_ref = useRef(null);

  useEffect(() => {
    if (!is_open) {
      return undefined;
    }

    function handlePointer(event) {
      if (root_ref.current && !root_ref.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKey(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [is_open]);

  const visible_items = items.filter(Boolean);
  if (!visible_items.length) {
    return null;
  }

  return (
    <div className="overflow-menu" ref={root_ref}>
      <button
        type="button"
        className="overflow-menu-trigger"
        aria-label={label}
        aria-expanded={is_open}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {is_open && (
        <ul className="overflow-menu-list" role="menu">
          {visible_items.map((item) => (
            <li key={item.id || item.label} role="none">
              <button
                type="button"
                role="menuitem"
                className={`overflow-menu-item${item.danger ? ' is-danger' : ''}`}
                disabled={item.disabled}
                onClick={() => {
                  setIsOpen(false);
                  item.onClick?.();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default OverflowMenu;
