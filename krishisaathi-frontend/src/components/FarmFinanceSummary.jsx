import { useState } from 'react';
import { useTranslation } from 'react-i18next';

function formatAmount(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

function FarmFinanceSummary({ finance, plots = [], crops = [], filter_label = '', default_open = false }) {
  const { t } = useTranslation();
  const [is_open, setIsOpen] = useState(default_open);

  if (!finance) {
    return null;
  }

  const spent = Number(finance.expense_total || 0);
  const earned = Number(finance.income_total || 0);
  const profit = Number(finance.profit ?? earned - spent);
  const is_profit = profit > 0;
  const is_loss = profit < 0;
  const flow_total = spent + earned;
  const spent_share = flow_total > 0 ? Math.max(4, (spent / flow_total) * 100) : 50;
  const earned_share = flow_total > 0 ? Math.max(4, 100 - spent_share) : 50;
  const margin = spent > 0 ? (profit / spent) * 100 : earned > 0 ? 100 : 0;
  const plots_with_money = plots.filter(
    (plot) => Number(plot.expense_total || 0) > 0 || Number(plot.income_total || 0) > 0,
  );
  const has_money = flow_total > 0;
  const net_label = `${profit >= 0 ? '+' : '-'}₹${formatAmount(Math.abs(profit))}`;

  return (
    <section className={`farm-finance-panel${is_open ? ' is-open' : ' is-collapsed'}`}>
      <div className="farm-finance-summary-card">
        <div className="farm-finance-intro">
          <span className="farm-finance-eyebrow">{t('farms.finance_summary')}</span>
          <span
            className={`farm-finance-status ${
              is_profit ? 'is-profit' : is_loss ? 'is-loss' : 'is-even'
            }`}
          >
            {is_profit
              ? t('finance.status_profit')
              : is_loss
                ? t('finance.status_loss')
                : t('finance.status_even')}
          </span>
        </div>

        <p className="farm-finance-subtitle">
          {filter_label || t('finance.farm_summary_plots', { count: plots.length })}
        </p>

        <div className="farm-finance-glance">
          <div>
            <span className="stat-label">{t('dashboard.total_spent')}</span>
            <strong>₹{formatAmount(spent)}</strong>
          </div>
          <div>
            <span className="stat-label">{t('dashboard.total_earned')}</span>
            <strong>₹{formatAmount(earned)}</strong>
          </div>
          <div>
            <span className="stat-label">{t('dashboard.net')}</span>
            <strong className={is_profit ? 'is-profit' : is_loss ? 'is-loss' : ''}>
              {net_label}
            </strong>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm farm-finance-expand-btn"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={is_open}
        >
          {is_open ? t('finance.hide_details') : t('finance.show_details')}
        </button>
      </div>

      {is_open && (
        <div className="section-panel-body farm-finance-details">
          <div className="farm-finance-hero">
            <div className="farm-finance-net-block">
              <span className="farm-finance-net-label">{t('dashboard.net')}</span>
              <strong className={`farm-finance-net-value ${is_profit ? 'is-profit' : is_loss ? 'is-loss' : ''}`}>
                {net_label}
              </strong>
              {spent > 0 && (
                <span className="farm-finance-margin">
                  {t('finance.margin')}: {margin.toFixed(0)}%
                </span>
              )}
            </div>

            {has_money ? (
              <div className="farm-finance-flow">
                <div className="farm-finance-flow-labels">
                  <span>{t('dashboard.total_spent')}</span>
                  <span>{t('dashboard.total_earned')}</span>
                </div>
                <div className="farm-finance-flow-track">
                  <div className="farm-finance-flow-spent" style={{ width: `${spent_share}%` }} />
                  <div className="farm-finance-flow-earned" style={{ width: `${earned_share}%` }} />
                </div>
                <div className="farm-finance-legend">
                  <span>{t('analytics.spent')}: ₹{formatAmount(spent)}</span>
                  <span>{t('analytics.earned')}: ₹{formatAmount(earned)}</span>
                </div>
              </div>
            ) : (
              <div className="farm-finance-empty">{t('analytics.no_money_data')}</div>
            )}
          </div>

          <div className="farm-finance-metrics">
            <div className="farm-finance-metric is-spent">
              <span className="farm-finance-metric-label">{t('dashboard.total_spent')}</span>
              <strong className="farm-finance-metric-value">₹{formatAmount(spent)}</strong>
              {finance.expense_count > 0 && (
                <span className="farm-finance-metric-meta">
                  {t('finance.entry_count', { count: finance.expense_count })}
                </span>
              )}
            </div>
            <div className="farm-finance-metric is-earned">
              <span className="farm-finance-metric-label">{t('dashboard.total_earned')}</span>
              <strong className="farm-finance-metric-value">₹{formatAmount(earned)}</strong>
              {finance.income_count > 0 && (
                <span className="farm-finance-metric-meta">
                  {t('finance.entry_count', { count: finance.income_count })}
                </span>
              )}
            </div>
          </div>

          {crops.length > 0 && (
            <div className="farm-finance-plots">
              <span className="farm-finance-plots-title">{t('season.by_crop')}</span>
              <ul className="farm-finance-plot-list">
                {crops.map((crop) => {
                  const crop_profit = Number(crop.profit || 0);
                  return (
                    <li key={crop.id} className="farm-finance-plot-row">
                      <span className="farm-finance-plot-name">
                        {crop.crop_name}
                        <small>{crop.plot_name}</small>
                      </span>
                      <span className="farm-finance-plot-spent">₹{formatAmount(crop.expense_total)}</span>
                      <span className="farm-finance-plot-earned">₹{formatAmount(crop.income_total)}</span>
                      <span
                        className={`farm-finance-plot-net ${crop_profit >= 0 ? 'is-profit' : 'is-loss'}`}
                      >
                        {crop_profit >= 0 ? '+' : '-'}₹{formatAmount(Math.abs(crop_profit))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {plots_with_money.length > 0 && (
            <div className="farm-finance-plots">
              <span className="farm-finance-plots-title">{t('finance.by_plot')}</span>
              <ul className="farm-finance-plot-list">
                {plots_with_money.map((plot) => {
                  const plot_profit = Number(plot.profit || 0);
                  return (
                    <li key={plot.id} className="farm-finance-plot-row">
                      <span className="farm-finance-plot-name">{plot.name}</span>
                      <span className="farm-finance-plot-spent">₹{formatAmount(plot.expense_total)}</span>
                      <span className="farm-finance-plot-earned">₹{formatAmount(plot.income_total)}</span>
                      <span
                        className={`farm-finance-plot-net ${
                          plot_profit >= 0 ? 'is-profit' : 'is-loss'
                        }`}
                      >
                        {plot_profit >= 0 ? '+' : '-'}₹{formatAmount(Math.abs(plot_profit))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default FarmFinanceSummary;
