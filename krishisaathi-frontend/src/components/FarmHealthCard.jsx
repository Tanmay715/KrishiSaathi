import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ProgressRing from './ProgressRing';

function FarmHealthCard({
  farms_count,
  plots_count,
  earned,
  spent,
  net,
  pending_count = 0,
}) {
  const { t } = useTranslation();
  const total_flow = earned + spent;
  const health_pct = total_flow <= 0
    ? 50
    : Math.round((earned / total_flow) * 100);
  const is_profit = net >= 0;

  return (
    <section className="farm-health fade-in">
      <header className="farm-health-head">
        <div>
          <h2>{t('dashboard.farm_health')}</h2>
          <p>
            {farms_count} {t('dashboard.farms_short')}
            {' · '}
            {plots_count} {t('dashboard.plots_short')}
          </p>
        </div>
        <Link to="/farms" className="text-link-btn">{t('nav.farms')}</Link>
      </header>

      <div className="farm-health-body">
        <ProgressRing
          value={health_pct}
          size={96}
          stroke={9}
          tone={is_profit ? 'profit' : 'loss'}
          label={`${is_profit ? '+' : '-'}₹${Math.abs(net) >= 1000
            ? `${(Math.abs(net) / 1000).toFixed(net >= 10000 ? 0 : 1)}k`
            : Math.abs(net).toLocaleString('en-IN')}`}
          sublabel={is_profit ? t('finance.status_profit') : t('finance.status_loss')}
        />

        <div className="farm-health-metrics">
          <div className="farm-health-metric is-earn">
            <span>{t('dashboard.total_earned')}</span>
            <strong>₹{earned.toLocaleString('en-IN')}</strong>
          </div>
          <div className="farm-health-metric is-spend">
            <span>{t('dashboard.total_spent')}</span>
            <strong>₹{spent.toLocaleString('en-IN')}</strong>
          </div>
          {pending_count > 0 && (
            <p className="farm-health-pending">
              {t('dashboard.pending_income_note', { count: pending_count })}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default FarmHealthCard;
