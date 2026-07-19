import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import { skipSaleIncome } from '../services/farm_service';
import { formatMoneyDate } from '../utils/format_date';

function PendingIncomeSection({ crops, show_location = false, on_log_income, on_changed }) {
  const { t } = useTranslation();
  const [skip_crop, setSkipCrop] = useState(null);
  const [is_skipping, setIsSkipping] = useState(false);
  const [skip_error, setSkipError] = useState('');

  async function confirmSkip(track_expenses) {
    if (!skip_crop) {
      return;
    }

    setIsSkipping(true);
    setSkipError('');

    try {
      await skipSaleIncome(skip_crop.farm_id, skip_crop.plot_id, skip_crop.id, {
        track_expenses,
      });
      setSkipCrop(null);
      if (on_changed) {
        await on_changed();
      }
    } catch (error) {
      setSkipError(error.response?.data?.message || t('common.error'));
    } finally {
      setIsSkipping(false);
    }
  }

  if (!crops?.length && !skip_crop) {
    return null;
  }

  return (
    <>
      {crops?.length > 0 && (
        <div className="card pending-income-card surface-panel">
          <div className="page-header-row surface-panel-head">
            <div>
              <p className="surface-kicker">{t('incomes.pending_title')}</p>
              <p className="section-note">{t('incomes.pending_hint')}</p>
            </div>
            <span className="badge badge-pending">{crops.length}</span>
          </div>
          <ul className="pending-income-list">
            {crops.map((crop) => (
              <li key={crop.id} className="pending-income-item">
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
                  <div className="pending-income-actions">
                    {on_log_income ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => on_log_income(crop)}
                      >
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
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setSkipError('');
                        setSkipCrop(crop);
                      }}
                    >
                      {t('incomes.skip_sale')}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {skip_crop && (
        <Modal
          title={t('incomes.skip_sale_title')}
          on_close={() => !is_skipping && setSkipCrop(null)}
          variant="sheet"
          footer={(
            <div className="modal-actions is-pinned is-stack">
              <button
                type="button"
                className="btn btn-primary"
                disabled={is_skipping}
                onClick={() => confirmSkip(true)}
              >
                {t('incomes.keep_expense_tracking')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={is_skipping}
                onClick={() => confirmSkip(false)}
              >
                {t('incomes.stop_expense_tracking')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={is_skipping}
                onClick={() => setSkipCrop(null)}
              >
                {t('common.cancel')}
              </button>
            </div>
          )}
        >
          <p className="section-note" style={{ marginTop: 0 }}>
            {t('incomes.skip_sale_body', { crop: skip_crop.crop_name })}
          </p>
          {skip_error && <div className="error-banner">{skip_error}</div>}
        </Modal>
      )}
    </>
  );
}

export default PendingIncomeSection;
