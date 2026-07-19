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
  getExpenseSummary,
  getFarmExpenses,
  getFarmIncomes,
  getFarms,
  getIncomeSummary,
  getQuickLogTargets,
} from '../services/farm_service';
import { formatMoneyDate } from '../utils/format_date';

const FILTERS = ['all', 'expense', 'income'];

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
  const [spent, setSpent] = useState(0);
  const [earned, setEarned] = useState(0);
  const [ledger, setLedger] = useState([]);
  const [filter, setFilter] = useState('all');
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
      const [farms_response, expense_summary, income_summary] = await Promise.all([
        getFarms(),
        getExpenseSummary(),
        getIncomeSummary(),
      ]);
      const farms = farms_response.data || [];
      const [expense_lists, income_lists] = await Promise.all([
        Promise.all(farms.map((farm) => getFarmExpenses(farm.id).then((res) => res.data || []))),
        Promise.all(farms.map((farm) => getFarmIncomes(farm.id).then((res) => res.data || []))),
      ]);

      setSpent(Number(expense_summary.data?.total_spent || 0));
      setEarned(Number(income_summary.data?.total_earned || 0));
      setLedger(buildLedger(farms, expense_lists, income_lists));
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

  const visible_rows = useMemo(() => {
    if (filter === 'all') {
      return ledger;
    }
    return ledger.filter((row) => row.kind === filter);
  }, [filter, ledger]);

  const profit = earned - spent;

  if (is_loading) {
    return <LoadingState />;
  }

  if (error_message && ledger.length === 0) {
    return <ErrorState message={error_message} on_retry={loadMoney} />;
  }

  return (
    <div className="money-page page-stack">
      <PageHeader title={t('nav.money')} subtitle={t('money.subtitle')} />

      <div className="money-summary-grid">
        <div className="money-summary-card tone-spend">
          <span>{t('dashboard.total_spent')}</span>
          <strong>₹{formatAmount(spent)}</strong>
        </div>
        <div className="money-summary-card tone-earn">
          <span>{t('dashboard.total_earned')}</span>
          <strong>₹{formatAmount(earned)}</strong>
        </div>
        <div className={`money-summary-card tone-net${profit < 0 ? ' is-loss' : ''}`}>
          <span>{t('dashboard.net')}</span>
          <strong>
            {profit >= 0 ? '+' : '-'}₹{formatAmount(Math.abs(profit))}
          </strong>
        </div>
      </div>

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
        <EmptyState message={t('money.empty')} />
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
          variant="sheet"
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
          <form id="income-form" className="form-compact" onSubmit={handleSaveIncome}>
            {income_error && <div className="error-banner">{income_error}</div>}
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
          </form>
        </Modal>
      )}
    </div>
  );
}

export default MoneyPage;
