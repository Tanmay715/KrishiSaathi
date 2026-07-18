function StatCard({ icon, label, value, tone = 'default' }) {
  return (
    <div className={`card stat-card compact tone-${tone}`}>
      <div className="stat-card-top">
        <span className="stat-icon" aria-hidden="true">{icon}</span>
        <div className="stat-label">{label}</div>
      </div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

export default StatCard;
