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
  getFarmExpenses,
  getFarmIncomes,
  getFarms,
  getQuickLogTargets,
} from '../services/farm_service';
import { formatMoneyDate } from '../utils/format_date';
import {
  ALL_TIME,
  comparisonPeriod,
  currentSeason,
  isWithinRange,
  periodOptions,
  periodRange,
  periodYear,
  previousSeason,
} from '../utils/finance_period';

const FILTERS = ['all', 'expense', 'income'];
const DEFAULT_PERIOD = 'this_season';

function formatAmount(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

function buildLedger(farms, expense_lists, income_lists) {
  const farm_names = Object.fromEntries(farms.map((farm) => [farm.id, farm.name]));
  const expenses = expense_lists.flatMap((group, index) => {
    const farm_id = farms[index]?.id;
    return (group || []).map((row) => ({
      id: `expense-${row.id}`,
      kind: 'expense',
      title: row.title,
      amount: Number(row.amount || 0),
      date: row.expense_date || row.created_at,
      farm_name: farm_names[farm_id] || '',
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
      farm_name: farm_names[farm_id] || '',
      category: row.category,
    }));
  });

  return [...expenses, ...incomes].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
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

/** How this period's profit compares with the equivalent earlier one, or null if there is none. */
function comparisonChange(ledger, period, profit) {
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

/** Opens on the current season, unless nothing was logged then — an empty screen helps nobody. */
function bestInitialPeriod(ledger) {
  const candidates = periodOptions(ledger.map((row) => row.date)).map((option) => option.key);
  const found = candidates.find((key) => (
    ledger.some((row) => isWithinRange(row.date, periodRange(key)))
  ));

  return found || DEFAULT_PERIOD;
}

function periodLabel(option_key, t) {
  const year = periodYear(option_key);

  if (year) {
    return String(year);
  }

  if (option_key === ALL_TIME) {
    return t('money.period_all');
  }

  const season = option_key === 'this_season'
    ? currentSeason()
    : previousSeason(currentSeason());

  return t(`crops.season.${season.season}`);
}

function periodSubLabel(option_key, t) {
  const year = periodYear(option_key);

  if (year || option_key === ALL_TIME) {
    return '';
  }

  const season = option_key === 'this_season'
    ? currentSeason()
    : previousSeason(currentSeason());

  return season.season === 'rabi' ? `${season.year}-${String(season.year + 1).slice(2)}` : String(season.year);
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
  const [filter, setFilter] = useState('all');
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
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
      const [expense_lists, income_lists] = await Promise.all([
        Promise.all(farms.map((farm) => getFarmExpenses(farm.id).then((res) => res.data || []))),
        Promise.all(farms.map((farm) => getFarmIncomes(farm.id).then((res) => res.data || []))),
      ]);

      const rows = buildLedger(farms, expense_lists, income_lists);
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

  const period_choices = useMemo(
    () => periodOptions(ledger.map((row) => row.date)),
    [ledger],
  );

  const period_rows = useMemo(() => {
    const range = periodRange(period);
    return ledger.filter((row) => isWithinRange(row.date, range));
  }, [ledger, period]);

  const visible_rows = useMemo(
    () => period_rows.filter((row) => filter === 'all' || row.kind === filter),
    [filter, period_rows],
  );

  const { spent, earned } = useMemo(() => sumLedger(period_rows), [period_rows]);
  const profit = earned - spent;
  const net_change = useMemo(
    () => comparisonChange(ledger, period, profit),
    [ledger, period, profit],
  );

  if (is_loading) {
    return <LoadingState />;
  }

  if (error_message && ledger.length === 0) {
    return <ErrorState message={error_message} on_retry={loadMoney} />;
  }

  return (
    <div className="money-page page-stack">
      <PageHeader title={t('nav.money')} subtitle={t('money.subtitle')} />

      <div className="money-period-bar" role="tablist" aria-label={t('money.period_label')}>
        {period_choices.map((option) => (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={period === option.key}
            className={`money-period-chip${period === option.key ? ' is-active' : ''}`}
            onClick={() => setPeriod(option.key)}
          >
            <span>{periodLabel(option.key, t)}</span>
            {periodSubLabel(option.key, t) && <em>{periodSubLabel(option.key, t)}</em>}
          </button>
        ))}
      </div>

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
        <div className="money-filters" role="tablist" aria-label={t('money.filters')}>
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
                    {row.farm_name}
                    {row.farm_name ? ' · ' : ''}
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
