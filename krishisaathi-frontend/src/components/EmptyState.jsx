function EmptyState({ title, message, action }) {
  return (
    <div className="card empty-state">
      {title && <h3 className="empty-state-title">{title}</h3>}
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}

export default EmptyState;
