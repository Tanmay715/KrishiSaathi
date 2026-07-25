import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMandiRates } from '../services/farm_service';
import { normalizeLanguage } from '../utils/language';
import { localizeCropName, localizePlaceLabel } from '../utils/localize_names';
import LoadingState from './LoadingState';
import SectionIcon from './SectionIcon';

function formatRate(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '—';
  }

  return `₹${Number(value).toLocaleString('en-IN')}`;
}

function buildSaleEstimate(summary, expense_total, quantity) {
  if (!summary || !(quantity > 0)) {
    return null;
  }

  const modal = summary.modal_median || summary.modal_avg;
  if (!(modal > 0)) {
    return null;
  }

  const estimated_revenue = Math.round(modal * quantity);
  const has_expense = expense_total > 0;

  return {
    modal_per_quintal: modal,
    estimated_revenue,
    break_even_per_quintal: has_expense ? Math.round(expense_total / quantity) : null,
    estimated_profit: has_expense ? Math.round(estimated_revenue - expense_total) : null,
  };
}

function MandiPricePanel({
  crop_name,
  farm_id = null,
  expense_total = 0,
  default_open = false,
  compact = false,
  crop_options = [],
  embedded = false,
}) {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  const [is_open, setIsOpen] = useState(default_open || embedded);
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
    if (embedded || default_open) {
      setIsOpen(true);
    }
  }, [embedded, default_open]);

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
  const sale_estimate = buildSaleEstimate(
    summary,
    Number(expense_total || 0),
    Number(quantity || 0),
  );
  const farm_place_label = localizePlaceLabel(rates?.farm, language);
  const disclaimer = rates?.source === 'reference'
    ? t('mandi.disclaimer_reference')
    : t('mandi.disclaimer');

  return (
    <section className={`mandi-panel is-quick-action${compact || embedded ? ' is-compact' : ' card'}${embedded ? ' is-embedded' : ''}`}>
      {!embedded && (
        <div className="quick-action-head">
          <div className="quick-action-copy">
            <div className="section-title-row">
              <SectionIcon name="mandi" tone="accent" />
              <h3>{t('mandi.title')}</h3>
            </div>
            {!is_open && (
              <p className="section-note is-one-line">
                {crop_name
                  ? t('mandi.collapsed_hint_crop', { crop: localizeCropName(crop_name, language) })
                  : t('mandi.collapsed_hint')}
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-expanded={is_open}
            onClick={() => setIsOpen((prev) => !prev)}
          >
            {is_open ? t('common.hide') : t('common.show')}
          </button>
        </div>
      )}

      {is_open && (
        <div className={`section-panel-body${compact || embedded ? ' is-compact' : ''}${embedded ? ' is-embedded' : ''}`}>
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
                  <option key={name} value={name}>{localizeCropName(name, language)}</option>
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
            <p className="section-note" style={{ marginTop: 6 }}>
              {t('mandi.quantity_hint')}
            </p>
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
                {t('mandi.unit_note')}
                {rates.source ? ` · ${t(`mandi_source.${rates.source}`, { defaultValue: rates.source_label || '' })}` : ''}
                {farm_place_label ? ` · ${farm_place_label}` : ''}
              </p>

              {sale_estimate && (
                <div className="mandi-break-even">
                  <strong>{t('mandi.est_sale')}</strong>
                  <p className="mandi-estimate-big">
                    ₹{sale_estimate.estimated_revenue.toLocaleString('en-IN')}
                  </p>
                  <p className="section-note" style={{ margin: '4px 0 8px' }}>
                    {t('mandi.est_sale_math', {
                      qty: Number(quantity),
                      price: formatRate(sale_estimate.modal_per_quintal),
                    })}
                  </p>
                  {sale_estimate.estimated_profit != null && (
                    <div className="farm-meta">
                      <span>
                        {t('mandi.break_even_hint', {
                          cost: sale_estimate.break_even_per_quintal.toLocaleString('en-IN'),
                          modal: sale_estimate.modal_per_quintal.toLocaleString('en-IN'),
                        })}
                      </span>
                      <span className={sale_estimate.estimated_profit >= 0 ? 'is-profit' : 'is-loss'}>
                        {t('finance.profit')}: {sale_estimate.estimated_profit >= 0 ? '+' : '-'}₹
                        {Math.abs(sale_estimate.estimated_profit).toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
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
