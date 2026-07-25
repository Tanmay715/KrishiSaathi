/** App-wide signal so layout-level voice saves can refresh the open page in place. */
export const DATA_CHANGED_EVENT = 'ks-data-changed';

export function notifyDataChanged(detail = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT, { detail }));
}

export function onDataChanged(handler) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const listener = (event) => handler(event.detail || {});
  window.addEventListener(DATA_CHANGED_EVENT, listener);
  return () => window.removeEventListener(DATA_CHANGED_EVENT, listener);
}
