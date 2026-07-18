import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatMoneyDate } from '../utils/format_date';
import MandiPricePanel from './MandiPricePanel';

function PendingIncomeSection({ crops, show_location = false, on_log_income }) {
  const { t } = useTranslation();

  if (!crops?.length) {
    return null;
  }

  return (
    <div className="card pending-income-card">
      <div className="page-header-row" style={{ marginBottom: 8 }}>
        <div>
          <h3 style={{ margin: 0 }}>{t('incomes.pending_title')}</h3>
          <p className="section-note">{t('incomes.pending_hint')}</p>
        </div>
        <span className="badge badge-pending">{crops.length}</span>
      </div>
      <ul className="pending-income-list">
        {crops.map((crop) => (
          <li key={crop.id} className="pending-income-item pending-income-item-stack">
            <div className="pending-income-row">
              <div className="pending-income-body">
                <strong>{crop.crop_name}</strong>
                <div className="farm-meta">
                  {show_location && (
                    <span>
                      {crop.farm_name} · {crop.plot_name}
                    </span>
                  )}
                  <span>
                    {t('crops.harvested_on')}: {formatMoneyDate(crop.actual_harvest_date)}
                  </span>
                  {Number(crop.expense_total || 0) > 0 && (
                    <span>
                      {t('expenses.crop_total')}: ₹{Number(crop.expense_total).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
              </div>
              {on_log_income ? (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => on_log_income(crop)}>
                  {t('incomes.add')}
                </button>
              ) : (
                <Link
                  to={`/farms/${crop.farm_id}/plots/${crop.plot_id}?log_income=${crop.id}`}
                  className="btn btn-primary btn-sm"
                >
                  {t('incomes.add')}
                </Link>
              )}
            </div>
            <MandiPricePanel
              crop_name={crop.crop_name}
              farm_id={crop.farm_id}
              expense_total={Number(crop.expense_total || 0)}
              compact
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PendingIncomeSection;
