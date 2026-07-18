import { useTranslation } from 'react-i18next';

function MoneyFlowChart({ spent = 0, earned = 0, empty_label }) {
  const { t } = useTranslation();
  const spent_n = Number(spent || 0);
  const earned_n = Number(earned || 0);
  const total = spent_n + earned_n;

  if (total <= 0) {
    return (
      <div className="money-flow-chart is-empty">
        <p>{empty_label}</p>
      </div>
    );
  }

  const max = Math.max(spent_n, earned_n, 1);
  const spent_w = Math.max(6, (spent_n / max) * 100);
  const earned_w = Math.max(6, (earned_n / max) * 100);
  const net = earned_n - spent_n;

  return (
    <div className="money-compare">
      <div className="money-compare-row">
        <div className="money-compare-meta">
          <span className="money-compare-label is-spent">{t('analytics.spent')}</span>
          <strong>₹{spent_n.toLocaleString('en-IN')}</strong>
        </div>
        <div className="money-compare-track">
          <div className="money-compare-fill is-spent" style={{ width: `${spent_w}%` }} />
        </div>
      </div>

      <div className="money-compare-row">
        <div className="money-compare-meta">
          <span className="money-compare-label is-earned">{t('analytics.earned')}</span>
          <strong>₹{earned_n.toLocaleString('en-IN')}</strong>
        </div>
        <div className="money-compare-track">
          <div className="money-compare-fill is-earned" style={{ width: `${earned_w}%` }} />
        </div>
      </div>

      <div className={`money-compare-net ${net >= 0 ? 'is-profit' : 'is-loss'}`}>
        <span>{t('dashboard.net')}</span>
        <strong>
          {net >= 0 ? '+' : '-'}₹{Math.abs(net).toLocaleString('en-IN')}
        </strong>
      </div>
    </div>
  );
}

export default MoneyFlowChart;
