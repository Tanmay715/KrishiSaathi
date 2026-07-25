import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import {
  ALL_TIME,
  CUSTOM,
  QUICK_RANGES,
  quickRange,
  rangeLabel,
  seasonChipLabel,
} from '../utils/finance_period';

const FALLBACK_PERIOD = 'this_season';

/**
 * Date + place filters for the Money page. Choices are held as a draft so the
 * farmer can line everything up and commit once with the apply button.
 */
function MoneyFilterSheet({ value, scope_tree = [], on_apply, on_close }) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState(() => ({ ...value }));

  const base_period = value.period === CUSTOM || value.period === ALL_TIME
    ? FALLBACK_PERIOD
    : value.period;
  const selected_farm = scope_tree.find((farm) => farm.id === draft.farm_id) || null;
  const selected_plot = selected_farm?.plots.find((plot) => plot.id === draft.plot_id) || null;
  const active_quick = QUICK_RANGES.find((key) => isQuickRangeActive(key, draft)) || '';

  function patchDraft(patch) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function handleQuickRange(key) {
    if (active_quick === key) {
      patchDraft({ period: base_period, custom_from: '', custom_to: '' });
      return;
    }

    const range = quickRange(key);
    patchDraft({ period: CUSTOM, custom_from: range.from, custom_to: range.to });
  }

  function handleAllTime() {
    const is_all = draft.period === ALL_TIME;
    patchDraft({ period: is_all ? base_period : ALL_TIME, custom_from: '', custom_to: '' });
  }

  function handleDate(field, next_value) {
    const dates = { custom_from: draft.custom_from, custom_to: draft.custom_to, [field]: next_value };
    const has_date = Boolean(dates.custom_from || dates.custom_to);
    patchDraft({ ...dates, period: has_date ? CUSTOM : base_period });
  }

  function handleFarm(farm_id) {
    patchDraft({ farm_id, plot_id: '', crop_id: '' });
  }

  function handlePlot(plot_id) {
    patchDraft({ plot_id, crop_id: '' });
  }

  function handleClear() {
    setDraft({
      period: base_period,
      custom_from: '',
      custom_to: '',
      farm_id: '',
      plot_id: '',
      crop_id: '',
    });
  }

  return (
    <Modal
      title={t('money.filters_title')}
      subtitle={summaryLine(draft, { t, language: i18n.language, selected_farm, selected_plot })}
      on_close={on_close}
      footer={(
        <div className="modal-actions is-pinned">
          <button type="button" className="btn btn-secondary" onClick={handleClear}>
            {t('money.filters_clear')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => on_apply(draft)}>
            {t('money.filters_apply')}
          </button>
        </div>
      )}
    >
      <div className="money-filter-sheet">
        <section className="sheet-section">
          <p className="sheet-section-label">{t('money.quick_ranges')}</p>
          <div className="money-filter-chips">
            {QUICK_RANGES.map((key) => (
              <button
                key={key}
                type="button"
                className={`money-filter-chip${active_quick === key ? ' is-active' : ''}`}
                onClick={() => handleQuickRange(key)}
              >
                {t(`money.range_${key}`)}
              </button>
            ))}
            <button
              type="button"
              className={`money-filter-chip${draft.period === ALL_TIME ? ' is-active' : ''}`}
              onClick={handleAllTime}
            >
              {t('money.period_all')}
            </button>
          </div>
        </section>

        <section className="sheet-section">
          <p className="sheet-section-label">{t('money.date_section')}</p>
          <div className="form-row">
            <div className="form-group">
              <label>{t('money.date_from')}</label>
              <input
                className="form-input"
                type="date"
                value={draft.custom_from}
                max={draft.custom_to || undefined}
                onChange={(event) => handleDate('custom_from', event.target.value)}
              />
            </div>
            <div className="form-group">
              <label>{t('money.date_to')}</label>
              <input
                className="form-input"
                type="date"
                value={draft.custom_to}
                min={draft.custom_from || undefined}
                onChange={(event) => handleDate('custom_to', event.target.value)}
              />
            </div>
          </div>
          <p className="money-filter-hint">{t('money.date_hint')}</p>
        </section>

        {scope_tree.length > 0 && (
          <section className="sheet-section">
            <p className="sheet-section-label">{t('money.scope_section')}</p>
            <div className="form-group">
              <label>{t('money.scope_farm')}</label>
              <select
                className="form-select"
                value={draft.farm_id}
                onChange={(event) => handleFarm(event.target.value)}
              >
                <option value="">{t('money.scope_all_farms')}</option>
                {scope_tree.map((farm) => (
                  <option key={farm.id} value={farm.id}>{farm.name}</option>
                ))}
              </select>
            </div>

            {selected_farm && (selected_farm.plots || []).length > 0 && (
              <div className="form-group">
                <label>{t('money.scope_plot')}</label>
                <select
                  className="form-select"
                  value={draft.plot_id}
                  onChange={(event) => handlePlot(event.target.value)}
                >
                  <option value="">{t('money.scope_all_plots')}</option>
                  {selected_farm.plots.map((plot) => (
                    <option key={plot.id} value={plot.id}>{plot.name}</option>
                  ))}
                </select>
              </div>
            )}

            {selected_plot && (selected_plot.crops || []).length > 0 && (
              <div className="form-group">
                <label>{t('money.scope_crop')}</label>
                <select
                  className="form-select"
                  value={draft.crop_id}
                  onChange={(event) => patchDraft({ crop_id: event.target.value })}
                >
                  <option value="">{t('money.scope_all_crops')}</option>
                  {selected_plot.crops.map((crop) => (
                    <option key={crop.id} value={crop.id}>{crop.name}</option>
                  ))}
                </select>
              </div>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}

function summaryLine(draft, { t, language, selected_farm, selected_plot }) {
  const parts = [periodLabel(draft, t, language)];

  if (selected_farm) {
    parts.push(selected_farm.name);
  }

  if (selected_plot) {
    parts.push(selected_plot.name);
  }

  return parts.filter(Boolean).join(' · ');
}

function periodLabel(draft, t, language) {
  if (draft.period === ALL_TIME) {
    return t('money.period_all');
  }

  if (draft.period === CUSTOM) {
    return rangeLabel(draft.custom_from, draft.custom_to, language) || t('money.period_custom');
  }

  return seasonChipLabel(draft.period, t);
}

function isQuickRangeActive(key, draft) {
  if (draft.period !== CUSTOM) {
    return false;
  }

  const range = quickRange(key);
  return range.from === draft.custom_from && range.to === draft.custom_to;
}

export default MoneyFilterSheet;
