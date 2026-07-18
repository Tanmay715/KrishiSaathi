import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMandiRates } from '../services/farm_service';
import LoadingState from './LoadingState';

function formatRate(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '—';
  }

  return `₹${Number(value).toLocaleString('en-IN')}`;
}

function buildBreakEven(summary, expense_total, quantity) {
  if (!summary || !(expense_total > 0) || !(quantity > 0)) {
    return null;
  }

  const modal = summary.modal_median || summary.modal_avg;
  const break_even_per_quintal = Math.round(expense_total / quantity);

  return {
    break_even_per_quintal,
    modal_per_quintal: modal,
    estimated_revenue: Math.round(modal * quantity),
    estimated_profit: Math.round(modal * quantity - expense_total),
  };
}

function MandiPricePanel({
  crop_name,
  farm_id = null,
  expense_total = 0,
  default_open = false,
  compact = false,
  crop_options = [],
}) {
  const { t } = useTranslation();
  const [is_open, setIsOpen] = useState(default_open);
  const [selected_crop, setSelectedCrop] = useState(crop_name || crop_options[0] || 'Wheat');
  const [quantity, setQuantity] = useState('');
  const [rates, setRates] = useState(null);
  const [is_loading, setIsLoading] = useState(false);
  const [error_message, setErrorMessage] = useState('');

  useEffect(() => {
    if (crop_name) {
      setSelectedCrop(crop_name);
    }
  }, [crop_name]);

  useEffect(() => {
    if (!is_open || !selected_crop) {
      return;
    }

    let is_cancelled = false;

    async function loadRates() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await getMandiRates({
          crop: selected_crop,
          farm_id,
        });

        if (!is_cancelled) {
          setRates(response.data || null);
        }
      } catch (error) {
        if (!is_cancelled) {
          setRates(null);
          setErrorMessage(error.response?.data?.message || t('common.error'));
        }
      } finally {
        if (!is_cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadRates();

    return () => {
      is_cancelled = true;
    };
  }, [is_open, selected_crop, farm_id, t]);

  const summary = rates?.summary;
  const break_even = buildBreakEven(summary, Number(expense_total || 0), Number(quantity || 0));
  const disclaimer = rates?.source === 'reference'
    ? t('mandi.disclaimer_reference')
    : t('mandi.disclaimer');

  return (
    <section className={`mandi-panel${compact ? ' is-compact' : ' card'}`}>
      <button
        type="button"
        className="section-toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={is_open}
      >
        <div>
          <h3 style={{ margin: 0 }}>{t('mandi.title')}</h3>
          <p className="section-note" style={{ margin: '4px 0 0' }}>
            {crop_name
              ? t('mandi.collapsed_hint_crop', { crop: crop_name })
              : t('mandi.collapsed_hint')}
          </p>
        </div>
        <span className="badge">{is_open ? t('common.hide') : t('common.show')}</span>
      </button>

      {is_open && (
        <div className="section-panel-body">
          {!crop_name && crop_options.length > 0 && (
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label htmlFor="mandi-crop">{t('mandi.crop_label')}</label>
              <select
                id="mandi-crop"
                className="form-select"
                value={selected_crop}
                onChange={(e) => setSelectedCrop(e.target.value)}
              >
                {crop_options.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label htmlFor="mandi-qty">{t('mandi.quantity_label')}</label>
            <input
              id="mandi-qty"
              className="form-input"
              type="number"
              min="0"
              step="0.1"
              placeholder={t('mandi.quantity_placeholder')}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          {is_loading && <LoadingState />}
          {error_message && <div className="error-banner">{error_message}</div>}

          {!is_loading && summary && (
            <>
              <div className="mandi-glance">
                <div>
                  <span className="stat-label">{t('mandi.min')}</span>
                  <strong>{formatRate(summary.min)}</strong>
                </div>
                <div>
                  <span className="stat-label">{t('mandi.modal')}</span>
                  <strong className="is-profit">{formatRate(summary.modal_median || summary.modal_avg)}</strong>
                </div>
                <div>
                  <span className="stat-label">{t('mandi.max')}</span>
                  <strong>{formatRate(summary.max)}</strong>
                </div>
              </div>

              <p className="section-note" style={{ marginTop: 8 }}>
                {t('mandi.unit_note')} · {rates.source_label}
                {rates.farm?.district || rates.farm?.state
                  ? ` · ${[rates.farm.district, rates.farm.state].filter(Boolean).join(', ')}`
                  : ''}
              </p>

              {break_even && (
                <div className="mandi-break-even">
                  <strong>{t('mandi.break_even_title')}</strong>
                  <p className="section-note" style={{ margin: '4px 0 8px' }}>
                    {t('mandi.break_even_hint', {
                      cost: break_even.break_even_per_quintal.toLocaleString('en-IN'),
                      modal: break_even.modal_per_quintal.toLocaleString('en-IN'),
                    })}
                  </p>
                  <div className="farm-meta">
                    <span>
                      {t('mandi.est_revenue')}: ₹{break_even.estimated_revenue.toLocaleString('en-IN')}
                    </span>
                    <span className={break_even.estimated_profit >= 0 ? 'is-profit' : 'is-loss'}>
                      {t('finance.profit')}: {break_even.estimated_profit >= 0 ? '+' : '-'}₹
                      {Math.abs(break_even.estimated_profit).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              )}

              {rates.markets?.length > 0 && (
                <ul className="mandi-market-list">
                  {rates.markets.map((market, index) => (
                    <li key={`${market.market}-${index}`} className="mandi-market-row">
                      <div>
                        <strong>{market.market}</strong>
                        <div className="farm-meta">
                          {market.district && <span>{market.district}</span>}
                          {market.date && <span>{market.date}</span>}
                        </div>
                      </div>
                      <span className="expense-amount">{formatRate(market.modal)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <p className="section-note mandi-disclaimer">{disclaimer}</p>
        </div>
      )}
    </section>
  );
}

export default MandiPricePanel;
