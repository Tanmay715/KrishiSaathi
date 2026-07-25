import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import QuickExpenseModal from '../components/QuickExpenseModal';
import {
  createIncome,
  getFarm,
  getFarmExpenses,
  getFarmIncomes,
  getFarms,
  getQuickLogTargets,
} from '../services/farm_service';
import { formatMoneyDate } from '../utils/format_date';
import {
  ALL_TIME,
  CUSTOM,
  comparisonPeriod,
  isWithinRange,
  periodOptions,
  periodRange,
  seasonChipLabel,
} from '../utils/finance_period';
import { onDataChanged } from '../utils/app_events';

const FILTERS = ['all', 'expense', 'income'];
const DEFAULT_PERIOD = 'this_season';

function formatAmount(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

function buildLedger(farms, expense_lists, income_lists, place_names) {
  const farm_names = Object.fromEntries(farms.map((farm) => [farm.id, farm.name]));
  const expenses = expense_lists.flatMap((group, index) => {
    const farm_id = farms[index]?.id;
    return (group || []).map((row) => ({
      id: `expense-${row.id}`,
      kind: 'expense',
      title: row.title,
      amount: Number(row.amount || 0),
      date: row.expense_date || row.created_at,
      farm_id: farm_id || null,
      plot_id: row.plot_id || null,
      crop_cycle_id: row.crop_cycle_id || null,
      farm_name: farm_names[farm_id] || '',
      plot_name: place_names.plots[row.plot_id] || '',
      crop_name: place_names.crops[row.crop_cycle_id] || '',
      category: row.category,
    }));
  });
  const incomes = income_lists.flatMap((group, index) => {
    const farm_id = farms[index]?.id;
    return (group || []).map((row) => ({
      id: `income-${row.id}`,
      kind: 'income',
      title: row.title,
      amount: Number(row.amount || 0),
      date: row.income_date || row.created_at,
      farm_id: farm_id || null,
      plot_id: row.plot_id || null,
      crop_cycle_id: row.crop_cycle_id || null,
      farm_name: farm_names[farm_id] || '',
      plot_name: place_names.plots[row.plot_id] || '',
      crop_name: place_names.crops[row.crop_cycle_id] || '',
      category: row.category,
    }));
  });

  return [...expenses, ...incomes].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

function buildPlaceNames(farm_details) {
  const plots = {};
  const crops = {};

  farm_details.forEach((farm) => {
    (farm.plots || []).forEach((plot) => {
      plots[plot.id] = plot.name;
      if (plot.active_crop) {
        crops[plot.active_crop.id] = plot.active_crop.crop_name;
      }
      (plot.crop_history || []).forEach((crop) => {
        crops[crop.id] = crop.crop_name;
      });
    });
  });

  return { plots, crops };
}

function buildScopeTree(farm_details) {
  return farm_details.map((farm) => ({
    id: farm.id,
    name: farm.name,
    plots: (farm.plots || []).map((plot) => ({
      id: plot.id,
      name: plot.name,
      crops: [
        ...(plot.active_crop
          ? [{ id: plot.active_crop.id, name: plot.active_crop.crop_name }]
          : []),
        ...(plot.crop_history || []).map((crop) => ({
          id: crop.id,
          name: crop.crop_name,
        })),
      ].filter((crop, index, list) => list.findIndex((row) => row.id === crop.id) === index),
    })),
  }));
}

function sumLedger(rows) {
  return rows.reduce((totals, row) => {
    if (row.kind === 'expense') {
      totals.spent += row.amount;
    } else {
      totals.earned += row.amount;
    }
    return totals;
  }, { spent: 0, earned: 0 });
}

function comparisonChange(ledger, period, profit, custom_range) {
  const comparison = comparisonPeriod(period);

  if (!comparison) {
    return null;
  }

  const previous_rows = ledger.filter((row) => isWithinRange(row.date, comparison.range));

  if (previous_rows.length === 0) {
    return null;
  }

  const previous = sumLedger(previous_rows);
  return profit - (previous.earned - previous.spent);
}

function bestInitialPeriod(ledger) {
  const candidates = ['this_season', 'last_season', ALL_TIME];
  const found = candidates.find((key) => (
    ledger.some((row) => isWithinRange(row.date, periodRange(key)))
  ));

  return found || DEFAULT_PERIOD;
}

function matchesScope(row, { farm_id, plot_id, crop_cycle_id }) {
  if (farm_id && row.farm_id !== farm_id) {
    return false;
  }
  if (plot_id && row.plot_id !== plot_id) {
    return false;
  }
  if (crop_cycle_id && row.crop_cycle_id !== crop_cycle_id) {
    return false;
  }
  return true;
}

function placeLine(row) {
  return [row.farm_name, row.plot_name, row.crop_name].filter(Boolean).join(' · ');
}

function targetLabel(target) {
  if (target.target_type === 'crop') {
    return `${target.farm_name} · ${target.plot_name} · ${target.crop_name}`;
  }
  if (target.target_type === 'plot') {
    return `${target.farm_name} · ${target.plot_name}`;
  }
  return target.farm_name;
}

function MoneyPage() {
  const { t, i18n } = useTranslation();
  const [search_params, setSearchParams] = useSearchParams();
  const [is_loading, setIsLoading] = useState(true);
  const [error_message, setErrorMessage] = useState('');
  const [ledger, setLedger] = useState([]);
  const [scope_tree, setScopeTree] = useState([]);
  const [filter, setFilter] = useState('all');
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [custom_from, setCustomFrom] = useState('');
  const [custom_to, setCustomTo] = useState('');
  const [scope_farm_id, setScopeFarmId] = useState('');
  const [scope_plot_id, setScopePlotId] = useState('');
  const [scope_crop_id, setScopeCropId] = useState('');
  const [show_filters, setShowFilters] = useState(false);
  const [draft_period, setDraftPeriod] = useState(DEFAULT_PERIOD);
  const [draft_from, setDraftFrom] = useState('');
  const [draft_to, setDraftTo] = useState('');
  const [draft_farm_id, setDraftFarmId] = useState('');
  const [draft_plot_id, setDraftPlotId] = useState('');
  const [draft_crop_id, setDraftCropId] = useState('');
  const [show_expense_modal, setShowExpenseModal] = useState(false);
  const [show_income_modal, setShowIncomeModal] = useState(false);
  const [targets, setTargets] = useState([]);
  const [target_key, setTargetKey] = useState('');
  const [income_title, setIncomeTitle] = useState('');
  const [income_amount, setIncomeAmount] = useState('');
  const [income_date, setIncomeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [is_saving_income, setIsSavingIncome] = useState(false);
  const [income_error, setIncomeError] = useState('');

  useEffect(() => {
    loadMoney();
  }, []);

  useEffect(() => onDataChanged((detail) => {
    if (['expense', 'income', 'create_farm', 'create_plot'].includes(detail.intent)) {
      loadMoney();
    }
  }), []);

  useEffect(() => {
    const add = search_params.get('add');
    if (add === 'expense') {
      setShowExpenseModal(true);
    }
    if (add === 'income') {
      openIncomeModal();
    }
  }, [search_params]);

  async function loadMoney() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const farms_response = await getFarms();
      const farms = farms_response.data || [];
      const [expense_lists, income_lists, farm_details] = await Promise.all([
        Promise.all(farms.map((farm) => getFarmExpenses(farm.id).then((res) => res.data || []))),
        Promise.all(farms.map((farm) => getFarmIncomes(farm.id).then((res) => res.data || []))),
        Promise.all(farms.map((farm) => getFarm(farm.id).then((res) => res.data || farm))),
      ]);

      const place_names = buildPlaceNames(farm_details);
      const rows = buildLedger(farms, expense_lists, income_lists, place_names);
      setScopeTree(buildScopeTree(farm_details));
      setLedger(rows);
      setPeriod(bestInitialPeriod(rows));
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }

  async function openIncomeModal() {
    setShowIncomeModal(true);
    setIncomeError('');
    setIncomeTitle('');
    setIncomeAmount('');
    setIncomeDate(new Date().toISOString().slice(0, 10));

    try {
      const response = await getQuickLogTargets();
      const rows = response.data || [];
      setTargets(rows);
      const preferred = rows.find((row) => row.target_type === 'crop') || rows[0];
      setTargetKey(preferred?.target_key || '');
    } catch (error) {
      setIncomeError(error.response?.data?.message || t('common.error'));
    }
  }

  function clearAddParam() {
    if (!search_params.get('add')) {
      return;
    }
    const next = new URLSearchParams(search_params);
    next.delete('add');
    setSearchParams(next, { replace: true });
  }

  async function handleSaveIncome(event) {
    event.preventDefault();
    const target = targets.find((row) => row.target_key === target_key);
    if (!target) {
      setIncomeError(t('quick_log.no_farm'));
      return;
    }

    setIsSavingIncome(true);
    setIncomeError('');

    try {
      await createIncome(target.farm_id, {
        plot_id: target.plot_id || null,
        crop_cycle_id: target.crop_cycle_id || null,
        category: 'sale',
        title: income_title.trim(),
        amount: Number(income_amount),
        income_date,
      });
      setShowIncomeModal(false);
      clearAddParam();
      await loadMoney();
    } catch (error) {
      setIncomeError(error.response?.data?.message || t('common.error'));
    } finally {
      setIsSavingIncome(false);
    }
  }

  function handlePeriodChange(next_period) {
    setPeriod(next_period);
  }

  function openFilters() {
    setDraftPeriod(period === 'this_season' || period === 'last_season' ? period : period);
    setDraftFrom(custom_from);
    setDraftTo(custom_to);
    setDraftFarmId(scope_farm_id);
    setDraftPlotId(scope_plot_id);
    setDraftCropId(scope_crop_id);
    setShowFilters(true);
  }

  function applyFilters() {
    setPeriod(draft_period);
    setCustomFrom(draft_from);
    setCustomTo(draft_to);
    setScopeFarmId(draft_farm_id);
    setScopePlotId(draft_plot_id);
    setScopeCropId(draft_crop_id);
    setShowFilters(false);
  }

  function clearFilters() {
    setDraftPeriod(DEFAULT_PERIOD);
    setDraftFrom('');
    setDraftTo('');
    setDraftFarmId('');
    setDraftPlotId('');
    setDraftCropId('');
    setPeriod(DEFAULT_PERIOD);
    setCustomFrom('');
    setCustomTo('');
    setScopeFarmId('');
    setScopePlotId('');
    setScopeCropId('');
    setShowFilters(false);
  }

  function handleDraftFarm(next_farm_id) {
    setDraftFarmId(next_farm_id);
    setDraftPlotId('');
    setDraftCropId('');
  }

  function handleDraftPlot(next_plot_id) {
    setDraftPlotId(next_plot_id);
    setDraftCropId('');
  }

  const period_choices = useMemo(() => periodOptions(), []);

  const custom_range = useMemo(
    () => ({ from: custom_from, to: custom_to }),
    [custom_from, custom_to],
  );

  const has_extra_filters = period === CUSTOM || period === ALL_TIME
    || Boolean(scope_farm_id || scope_plot_id || scope_crop_id);

  const scoped_ledger = useMemo(
    () => ledger.filter((row) => matchesScope(row, {
      farm_id: scope_farm_id,
      plot_id: scope_plot_id,
      crop_cycle_id: scope_crop_id,
    })),
    [ledger, scope_farm_id, scope_plot_id, scope_crop_id],
  );

  const period_rows = useMemo(() => {
    const range = periodRange(period, new Date(), custom_range);
    return scoped_ledger.filter((row) => isWithinRange(row.date, range));
  }, [scoped_ledger, period, custom_range]);

  const visible_rows = useMemo(
    () => period_rows.filter((row) => filter === 'all' || row.kind === filter),
    [filter, period_rows],
  );

  const { spent, earned } = useMemo(() => sumLedger(period_rows), [period_rows]);
  const profit = earned - spent;
  const net_change = useMemo(
    () => comparisonChange(scoped_ledger, period, profit, custom_range),
    [scoped_ledger, period, profit, custom_range],
  );

  const draft_farm = scope_tree.find((farm) => farm.id === draft_farm_id);
  const draft_plot = draft_farm?.plots.find((plot) => plot.id === draft_plot_id);
  const show_scope = scope_tree.length > 0;

  if (is_loading) {
    return <LoadingState />;
  }

  if (error_message && ledger.length === 0) {
    return <ErrorState message={error_message} on_retry={loadMoney} />;
  }

  return (
    <div className="money-page page-stack">
      <PageHeader title={t('nav.money')} subtitle={t('money.subtitle')} />

      <section className="money-smart-filters" aria-label={t('money.filters')}>
        <div className="money-period-bar" role="tablist" aria-label={t('money.period_label')}>
          {period_choices.map((option) => (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={period === option.key}
              className={`money-period-chip${period === option.key ? ' is-active' : ''}`}
              onClick={() => handlePeriodChange(option.key)}
            >
              {seasonChipLabel(option.key, t)}
            </button>
          ))}
          <button
            type="button"
            className={`money-period-chip is-more${has_extra_filters ? ' is-active' : ''}`}
            onClick={openFilters}
          >
            {t('money.period_more')}
          </button>
        </div>

        {has_extra_filters && (
          <p className="money-filter-note">{t('money.active_filters')}</p>
        )}
      </section>

      <div className="money-summary-grid">
        <div className="money-summary-card tone-spend">
          <span>{t('money.spent_in_period')}</span>
          <strong>₹{formatAmount(spent)}</strong>
        </div>
        <div className="money-summary-card tone-earn">
          <span>{t('money.earned_in_period')}</span>
          <strong>₹{formatAmount(earned)}</strong>
        </div>
        <div className={`money-summary-card tone-net${profit < 0 ? ' is-loss' : ''}`}>
          <span>{profit >= 0 ? t('finance.status_profit') : t('finance.status_loss')}</span>
          <strong>
            {profit >= 0 ? '+' : '-'}₹{formatAmount(Math.abs(profit))}
          </strong>
        </div>
      </div>

      {net_change !== null && (
        <p className={`money-compare${net_change >= 0 ? ' is-up' : ' is-down'}`}>
          {t('money.vs_previous', {
            direction: net_change >= 0 ? t('money.better_by') : t('money.worse_by'),
            amount: `₹${formatAmount(Math.abs(net_change))}`,
          })}
        </p>
      )}

      <div className="money-toolbar">
        <div className="money-filters" role="tablist" aria-label={t('money.kind_filters')}>
          {FILTERS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={`money-filter-btn${filter === key ? ' is-active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {t(`money.filter_${key}`)}
            </button>
          ))}
        </div>
        <div className="money-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowExpenseModal(true)}>
            {t('expenses.add')}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={openIncomeModal}>
            {t('incomes.add')}
          </button>
        </div>
      </div>

      {error_message && <div className="error-banner">{error_message}</div>}

      {visible_rows.length === 0 ? (
        <EmptyState message={ledger.length ? t('money.empty_period') : t('money.empty')} />
      ) : (
        <div className="card money-ledger-card">
          <ul className="money-ledger">
            {visible_rows.map((row) => (
              <li key={row.id} className={`money-ledger-item is-${row.kind}`}>
                <div>
                  <strong>{row.title}</strong>
                  <span>
                    {placeLine(row)}
                    {placeLine(row) ? ' · ' : ''}
                    {formatMoneyDate(row.date, i18n.language)}
                  </span>
                </div>
                <em>
                  {row.kind === 'expense' ? '−' : '+'}₹{formatAmount(row.amount)}
                </em>
              </li>
            ))}
          </ul>
        </div>
      )}

      {show_filters && (
        <Modal
          title={t('money.filters_title')}
          on_close={() => setShowFilters(false)}
          footer={(
            <div className="modal-actions is-pinned">
              <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                {t('money.filters_clear')}
              </button>
              <button type="button" className="btn btn-primary" onClick={applyFilters}>
                {t('money.filters_apply')}
              </button>
            </div>
          )}
        >
          <div className="money-filter-sheet">
            <div className="money-filter-group">
              <p className="sheet-section-label">{t('money.period_label')}</p>
              <div className="money-filter-chips">
                {[...period_choices, { key: CUSTOM }, { key: ALL_TIME }].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`money-period-chip${draft_period === option.key ? ' is-active' : ''}`}
                    onClick={() => setDraftPeriod(option.key)}
                  >
                    {seasonChipLabel(option.key, t)}
                  </button>
                ))}
              </div>
            </div>

            {draft_period === CUSTOM && (
              <div className="money-date-range">
                <label>
                  <span>{t('money.date_from')}</span>
                  <input
                    className="form-input"
                    type="date"
                    value={draft_from}
                    onChange={(event) => setDraftFrom(event.target.value)}
                  />
                </label>
                <label>
                  <span>{t('money.date_to')}</span>
                  <input
                    className="form-input"
                    type="date"
                    value={draft_to}
                    min={draft_from || undefined}
                    onChange={(event) => setDraftTo(event.target.value)}
                  />
                </label>
              </div>
            )}

            {show_scope && (
              <div className="money-scope-row">
                <label className="money-scope-field">
                  <span>{t('money.scope_farm')}</span>
                  <select
                    className="form-select"
                    value={draft_farm_id}
                    onChange={(event) => handleDraftFarm(event.target.value)}
                  >
                    <option value="">{t('money.scope_all_farms')}</option>
                    {scope_tree.map((farm) => (
                      <option key={farm.id} value={farm.id}>{farm.name}</option>
                    ))}
                  </select>
                </label>

                {draft_farm_id && (
                  <label className="money-scope-field">
                    <span>{t('money.scope_plot')}</span>
                    <select
                      className="form-select"
                      value={draft_plot_id}
                      onChange={(event) => handleDraftPlot(event.target.value)}
                    >
                      <option value="">{t('money.scope_all_plots')}</option>
                      {(draft_farm?.plots || []).map((plot) => (
                        <option key={plot.id} value={plot.id}>{plot.name}</option>
                      ))}
                    </select>
                  </label>
                )}

                {draft_plot_id && (draft_plot?.crops || []).length > 0 && (
                  <label className="money-scope-field">
                    <span>{t('money.scope_crop')}</span>
                    <select
                      className="form-select"
                      value={draft_crop_id}
                      onChange={(event) => setDraftCropId(event.target.value)}
                    >
                      <option value="">{t('money.scope_all_crops')}</option>
                      {draft_plot.crops.map((crop) => (
                        <option key={crop.id} value={crop.id}>{crop.name}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      <QuickExpenseModal
        is_open={show_expense_modal}
        on_close={() => {
          setShowExpenseModal(false);
          clearAddParam();
        }}
        on_saved={() => {
          clearAddParam();
          loadMoney();
        }}
      />

      {show_income_modal && (
        <Modal
          title={t('incomes.add')}
          on_close={() => {
            setShowIncomeModal(false);
            clearAddParam();
          }}
          footer={(
            <div className="modal-actions is-pinned">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowIncomeModal(false);
                  clearAddParam();
                }}
              >
                {t('farms.cancel')}
              </button>
              <button type="submit" form="income-form" className="btn btn-primary" disabled={is_saving_income}>
                {is_saving_income ? t('common.loading') : t('incomes.add')}
              </button>
            </div>
          )}
        >
          <form id="income-form" className="sheet-form" onSubmit={handleSaveIncome}>
            {income_error && <div className="error-banner">{income_error}</div>}
            <section className="sheet-section">
              <p className="sheet-section-label">{t('common.sheet_where')}</p>
              <div className="form-group">
                <label>{t('quick_log.where')}</label>
                <select
                  className="form-select"
                  value={target_key}
                  onChange={(event) => setTargetKey(event.target.value)}
                  required
                >
                  {targets.map((target) => (
                    <option key={target.target_key} value={target.target_key}>
                      {targetLabel(target)}
                    </option>
                  ))}
                </select>
              </div>
            </section>
            <section className="sheet-section">
              <p className="sheet-section-label">{t('common.sheet_details')}</p>
              <div className="form-group">
                <label>{t('incomes.title_label')}</label>
                <input
                  className="form-input"
                  value={income_title}
                  onChange={(event) => setIncomeTitle(event.target.value)}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('incomes.amount')}</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={income_amount}
                    onChange={(event) => setIncomeAmount(event.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{t('incomes.date')}</label>
                  <input
                    className="form-input"
                    type="date"
                    value={income_date}
                    onChange={(event) => setIncomeDate(event.target.value)}
                    required
                  />
                </div>
              </div>
            </section>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default MoneyPage;
