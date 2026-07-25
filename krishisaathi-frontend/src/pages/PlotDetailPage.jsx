import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import PendingIncomeSection from '../components/PendingIncomeSection';
import { formatMoneyDate } from '../utils/format_date';
import {
  EXPENSE_CATEGORIES,
  applyExpenseCategoryChange,
  getExpenseCategoryConfig,
} from '../config/expense_category_fields';
import {
  buildExpensePayload,
  expenseToForm,
  getExpenseFormDefaults,
} from '../config/expense_form_helpers';
import {
  INCOME_CATEGORIES,
  applyIncomeCategoryChange,
  buildIncomePayload,
  getIncomeCategoryConfig,
  getIncomeFormDefaults,
  incomeToForm,
} from '../config/income_category_fields';
import {
  createCropCycle,
  createExpense,
  createIncome,
  deleteCropCycle,
  deleteExpense,
  deleteIncome,
  getCropTemplates,
  getPlotDetail,
  getWeather,
  harvestCrop,
  updateCropCycle,
  updateExpense,
  updateIncome,
  updatePlot,
} from '../services/farm_service';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import DiseaseScanPanel from '../components/DiseaseScanPanel';
import MandiPricePanel from '../components/MandiPricePanel';
import CropLivingPanel from '../components/CropLivingPanel';
import OverflowMenu from '../components/OverflowMenu';
import SectionIcon from '../components/SectionIcon';
import { loadPlotDetail, savePlotDetail } from '../utils/offline_store';
import { buildWeatherAdvice } from '../utils/dashboard_insights';
import { onDataChanged } from '../utils/app_events';

const SEASON_OPTIONS = ['rabi', 'kharif', 'zaid', 'custom'];

const EMPTY_CROP = {
  crop_template_id: '',
  crop_name: '',
  season_type: 'kharif',
  sowing_date: '',
  expected_harvest_date: '',
  notes: '',
};

function getFinanceInsight({ t, profit, spending, earned }) {
  if (spending === 0 && earned === 0) {
    return t('finance.insight_empty');
  }

  if (earned === 0 && spending > 0) {
    return t('finance.insight_only_spend');
  }

  if (profit > 0) {
    return t('finance.insight_profit', { amount: profit.toLocaleString('en-IN') });
  }

  if (profit < 0) {
    return t('finance.insight_loss', { amount: Math.abs(profit).toLocaleString('en-IN') });
  }

  return t('finance.insight_break_even');
}

function PlotDetailPage() {
  const { farm_id, plot_id } = useParams();
  const [search_params, setSearchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const [plot, setPlot] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [is_loading, setIsLoading] = useState(true);
  const [show_crop_modal, setShowCropModal] = useState(false);
  const [show_expense_modal, setShowExpenseModal] = useState(false);
  const [show_income_modal, setShowIncomeModal] = useState(false);
  const [show_plot_modal, setShowPlotModal] = useState(false);
  const [editing_expense, setEditingExpense] = useState(null);
  const [editing_income, setEditingIncome] = useState(null);
  const [income_crop_context, setIncomeCropContext] = useState(null);
  const [harvest_success_crop, setHarvestSuccessCrop] = useState(null);
  const [crop_to_delete, setCropToDelete] = useState(null);
  const [is_saving, setIsSaving] = useState(false);
  const [error_message, setErrorMessage] = useState('');
  const [confirm_delete, setConfirmDelete] = useState(null);
  const [expanded_history_id, setExpandedHistoryId] = useState('');
  const [is_expenses_open, setIsExpensesOpen] = useState(true);
  const [is_incomes_open, setIsIncomesOpen] = useState(true);
  const [is_history_open, setIsHistoryOpen] = useState(false);
  const [is_cached_view, setIsCachedView] = useState(false);
  const [weather_tip, setWeatherTip] = useState('');
  const [crop_form, setCropForm] = useState(EMPTY_CROP);
  const [expense_form, setExpenseForm] = useState(getExpenseFormDefaults());
  const [income_form, setIncomeForm] = useState(getIncomeFormDefaults());
  const [plot_form, setPlotForm] = useState({ name: '', area: '', soil_type: '', notes: '' });

  const land_unit_label = t(`common.${user?.preferred_land_unit || 'acre'}`);

  useEffect(() => {
    loadPlot();
  }, [farm_id, plot_id, i18n.language]);

  useEffect(() => onDataChanged((detail) => {
    if (['expense', 'income', 'create_plot', 'create_farm'].includes(detail.intent)) {
      loadPlot();
    }
  }), [farm_id, plot_id]);

  async function loadPlot() {
    setIsLoading(true);

      try {
      const [plot_response, templates_response, weather_response] = await Promise.all([
        getPlotDetail(farm_id, plot_id),
        getCropTemplates(i18n.language),
        getWeather().catch(() => null),
      ]);
      const plot_data = plot_response.data;
      setPlot(plot_data);
      setTemplates(templates_response.data || []);
      const tips = buildWeatherAdvice(t, weather_response?.data || null);
      setWeatherTip(tips[0] || '');
      setIsCachedView(false);
      savePlotDetail(farm_id, plot_id, {
        plot: plot_data,
        templates: templates_response.data || [],
      });
    } catch (error) {
      const cached = loadPlotDetail(farm_id, plot_id);
      if (cached?.plot) {
        setPlot(cached.plot);
        setTemplates(cached.templates || []);
        setIsCachedView(true);
      } else {
        console.error(error);
      }
    } finally {
      setIsLoading(false);
    }
  }

  function handleTemplateChange(template_id) {
    const template = templates.find((item) => item.id === template_id);
    setCropForm((prev) => ({
      ...prev,
      crop_template_id: template_id,
      crop_name: template?.name || prev.crop_name,
    }));
  }

  async function handleStartCrop(event) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage('');

    try {
      await createCropCycle(farm_id, plot_id, {
        crop_template_id: crop_form.crop_template_id || undefined,
        crop_name: crop_form.crop_name,
        season_type: crop_form.season_type,
        sowing_date: crop_form.sowing_date || undefined,
        expected_harvest_date: crop_form.expected_harvest_date || undefined,
        notes: crop_form.notes || undefined,
      });
      setShowCropModal(false);
      setCropForm(EMPTY_CROP);
      await loadPlot();
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleStage(stage_index) {
    if (!plot?.active_crop) {
      return;
    }

    const updated_stages = plot.active_crop.lifecycle_stages.map((stage, index) => {
      if (index === stage_index) {
        return { ...stage, completed: !stage.completed };
      }
      return stage;
    });

    try {
      await updateCropCycle(farm_id, plot_id, plot.active_crop.id, {
        lifecycle_stages: updated_stages,
      });
      await loadPlot();
    } catch (error) {
      console.error(error);
    }
  }

  async function handleHarvest() {
    if (!plot?.active_crop) {
      return;
    }

    const harvested_crop_id = plot.active_crop.id;
    const harvested_crop_name = plot.active_crop.crop_name;

    setIsSaving(true);

    try {
      await harvestCrop(farm_id, plot_id, harvested_crop_id, {
        actual_harvest_date: new Date().toISOString().slice(0, 10),
      });
      await loadPlot();
      setExpandedHistoryId(harvested_crop_id);
      setHarvestSuccessCrop({
        id: harvested_crop_id,
        crop_name: harvested_crop_name,
        expense_total: Number(plot.expense_total || 0),
      });
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAbandon() {
    if (!plot?.active_crop) {
      return;
    }

    setConfirmDelete({
      type: 'abandon',
      message: t('crops.abandon_confirm'),
    });
  }

  async function runConfirmDelete() {
    if (!confirm_delete) {
      return;
    }

    setIsSaving(true);

    try {
      if (confirm_delete.type === 'abandon') {
        await updateCropCycle(farm_id, plot_id, plot.active_crop.id, { status: 'abandoned' });
      } else if (confirm_delete.type === 'expense') {
        await deleteExpense(farm_id, confirm_delete.item.id);
      } else if (confirm_delete.type === 'income') {
        await deleteIncome(farm_id, confirm_delete.item.id);
      }

      setConfirmDelete(null);
      await loadPlot();
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
      setConfirmDelete(null);
    } finally {
      setIsSaving(false);
    }
  }

  function openCreateExpense() {
    setEditingExpense(null);
    setExpenseForm(getExpenseFormDefaults());
    setErrorMessage('');
    setIsExpensesOpen(true);
    setShowExpenseModal(true);
  }

  function openEditExpense(expense) {
    setEditingExpense(expense);
    setExpenseForm(expenseToForm(expense));
    setErrorMessage('');
    setIsExpensesOpen(true);
    setShowExpenseModal(true);
  }

  function handleHarvestSuccessLater() {
    setHarvestSuccessCrop(null);
  }

  function handleHarvestSuccessLogIncome() {
    if (!harvest_success_crop) {
      return;
    }

    const crop = harvest_success_crop;
    setHarvestSuccessCrop(null);
    openCreateIncomeForCrop(crop);
  }

  function closeIncomeModal() {
    setShowIncomeModal(false);
    setEditingIncome(null);
    setIncomeCropContext(null);
  }

  function openCreateIncome() {
    if (plot.active_crop?.id) {
      openCreateIncomeForCrop({
        id: plot.active_crop.id,
        crop_name: plot.active_crop.crop_name,
      });
      return;
    }

    setEditingIncome(null);
    setIncomeCropContext(null);
    setIncomeForm(getIncomeFormDefaults('subsidy'));
    setErrorMessage('');
    setIsIncomesOpen(true);
    setShowIncomeModal(true);
  }

  function openCreateIncomeForCrop(crop) {
    setEditingIncome(null);
    setIncomeCropContext({ id: crop.id, crop_name: crop.crop_name });
    setIncomeForm(getIncomeFormDefaults('harvest'));
    setErrorMessage('');
    setIsIncomesOpen(true);
    setShowIncomeModal(true);
  }

  function openEditIncome(income) {
    const crop_name = getCropNameById(income.crop_cycle_id);

    setEditingIncome(income);
    setIncomeForm(incomeToForm(income));
    setIncomeCropContext({ id: income.crop_cycle_id, crop_name });
    setErrorMessage('');
    setIsIncomesOpen(true);
    setShowIncomeModal(true);
  }

  function getCropNameById(crop_cycle_id) {
    if (plot.active_crop?.id === crop_cycle_id) {
      return plot.active_crop.crop_name;
    }

    const history_crop = plot.crop_history?.find((crop) => crop.id === crop_cycle_id);
    return history_crop?.crop_name || '';
  }

  useEffect(() => {
    const log_income_id = search_params.get('log_income');
    if (!plot || !log_income_id) {
      return;
    }

    const crop = plot.crop_history?.find((item) => item.id === log_income_id);
    if (!crop) {
      return;
    }

    setExpandedHistoryId(log_income_id);
    openCreateIncomeForCrop({
      id: crop.id,
      crop_name: crop.crop_name,
    });
    setSearchParams({}, { replace: true });
  }, [plot, search_params, setSearchParams]);

  async function handleSaveExpense(event) {
    event.preventDefault();

    const crop_cycle_id = editing_expense?.crop_cycle_id || plot.active_crop?.id || null;

    setIsSaving(true);
    setErrorMessage('');

    try {
      const payload = buildExpensePayload(expense_form, plot_id, crop_cycle_id);

      if (editing_expense) {
        await updateExpense(farm_id, editing_expense.id, payload);
      } else {
        await createExpense(farm_id, payload);
      }

      setShowExpenseModal(false);
      setEditingExpense(null);
      setExpenseForm(getExpenseFormDefaults());
      await loadPlot();
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  function handleDeleteExpense(expense) {
    setConfirmDelete({
      type: 'expense',
      item: expense,
      message: t('expenses.delete_confirm', { title: expense.title }),
    });
  }

  async function handleSaveIncome(event) {
    event.preventDefault();

    const crop_cycle_id = editing_income?.crop_cycle_id || income_crop_context?.id || plot.active_crop?.id || null;

    setIsSaving(true);
    setErrorMessage('');

    try {
      const payload = buildIncomePayload(income_form, plot_id, crop_cycle_id);

      if (editing_income) {
        await updateIncome(farm_id, editing_income.id, payload);
      } else {
        await createIncome(farm_id, payload);
      }

      closeIncomeModal();
      setIncomeForm(getIncomeFormDefaults());
      await loadPlot();
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  function handleDeleteIncome(income) {
    setConfirmDelete({
      type: 'income',
      item: income,
      message: t('incomes.delete_confirm', { title: income.title }),
    });
  }

  function openDeleteCropModal(crop) {
    setCropToDelete(crop);
    setErrorMessage('');
  }

  async function handleConfirmDeleteCrop() {
    if (!crop_to_delete) {
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      await deleteCropCycle(farm_id, plot_id, crop_to_delete.id);
      if (expanded_history_id === crop_to_delete.id) {
        setExpandedHistoryId('');
      }
      setCropToDelete(null);
      await loadPlot();
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  function openEditPlot() {
    setPlotForm({
      name: plot.name || '',
      area: plot.area != null ? String(plot.area) : '',
      soil_type: plot.soil_type || '',
      notes: plot.notes || '',
    });
    setErrorMessage('');
    setShowPlotModal(true);
  }

  async function handleSavePlot(event) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage('');

    try {
      await updatePlot(farm_id, plot_id, {
        ...plot_form,
        area: Number(plot_form.area),
      });
      setShowPlotModal(false);
      await loadPlot();
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  if (is_loading) {
    return <LoadingState />;
  }

  if (!plot) {
    return <ErrorState message={t('common.error')} on_retry={loadPlot} />;
  }

  const spending = Number(plot.expense_total || 0);
  const earned = Number(plot.income_total || 0);
  const profit = earned - spending;
  const expense_field_config = getExpenseCategoryConfig(expense_form.category);
  const income_field_config = getIncomeCategoryConfig(income_form.category);
  const finance_insight = getFinanceInsight({
    t,
    profit,
    spending,
    earned,
  });
  const pending_income_crops = (plot.crop_history || [])
    .filter((crop) => (
      crop.status === 'harvested'
      && !crop.skip_sale_income
      && Number(crop.income_total || 0) === 0
    ))
    .map((crop) => ({
      id: crop.id,
      crop_name: crop.crop_name,
      actual_harvest_date: crop.actual_harvest_date,
      expense_total: crop.expense_total,
      farm_id,
      plot_id,
      plot_name: plot.name,
    }));

  return (
    <div className="plot-detail-page is-crafted">
      <div className="page-header">
        <Link to={`/farms/${farm_id}`} className="back-link">
          ← {t('farms.plots')}
        </Link>
        <div className="page-header-row">
          <div>
            <h2>{plot.name}</h2>
            <p>
              {plot.area} {land_unit_label}
              {plot.soil_type ? ` · ${plot.soil_type}` : ''}
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={openEditPlot}>
            {t('farms.edit_plot')}
          </button>
        </div>
      </div>

      {is_cached_view && (
        <div className="info-banner no-print">{t('pwa.cached_data')}</div>
      )}

      {error_message && !show_crop_modal && !show_expense_modal && !show_income_modal && !show_plot_modal && (
        <div className="error-banner">{error_message}</div>
      )}

      <div className="farm-detail-stats">
        <div className="farm-detail-stat">
          <span>{t('farms.plot_area')}</span>
          <strong>{plot.area}</strong>
          <small>{land_unit_label}</small>
        </div>
        <div className="farm-detail-stat">
          <span>{t('expenses.crop_total')}</span>
          <strong>₹{spending.toLocaleString('en-IN')}</strong>
          <small>{t('farms.summary_estimated')}</small>
        </div>
        <div className="farm-detail-stat">
          <span>{t('incomes.crop_total')}</span>
          <strong>₹{earned.toLocaleString('en-IN')}</strong>
          <small>{t('farms.summary_estimated')}</small>
        </div>
        <div className="farm-detail-stat">
          <span>{profit >= 0 ? t('finance.status_profit') : t('finance.status_loss')}</span>
          <strong>
            {profit >= 0 ? '+' : '-'}₹{Math.abs(profit).toLocaleString('en-IN')}
          </strong>
          <small>{t('farms.finance_summary')}</small>
        </div>
      </div>

      {!plot.active_crop ? (
        <div className="crop-invite surface-panel">
          <div className="crop-invite-art" aria-hidden="true">
            <svg viewBox="0 0 160 120" className="crop-invite-svg">
              <ellipse cx="80" cy="102" rx="54" ry="10" fill="rgba(30,92,64,0.12)" />
              <path d="M80 98 V48" stroke="#3db872" strokeWidth="3.5" strokeLinecap="round" fill="none" />
              <path d="M80 72 C58 64, 46 48, 50 30 C64 42, 74 56, 80 66" fill="#2f9e5f" opacity="0.9" />
              <path d="M80 66 C102 56, 116 40, 112 22 C98 36, 88 50, 80 60" fill="#3db872" opacity="0.85" />
              <circle cx="80" cy="40" r="9" fill="#f0c419" />
              <circle cx="118" cy="28" r="3" fill="#fde68a" opacity="0.8" />
              <circle cx="42" cy="36" r="2.5" fill="#fde68a" opacity="0.7" />
            </svg>
          </div>
          <div className="crop-invite-copy">
            <p className="surface-kicker">{t('crops.current_crop')}</p>
            <h2>{t('crops.start_crop_title')}</h2>
            <p>{t('crops.no_active_crop')}</p>
            <div className="crop-invite-actions">
              <button type="button" className="btn btn-primary" onClick={() => setShowCropModal(true)}>
                {t('crops.start_crop')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={openCreateExpense}>
                {t('expenses.add')}
              </button>
            </div>
            <p className="section-note crop-invite-note">{t('expenses.plot_level_hint')}</p>
          </div>
        </div>
      ) : (
        <CropLivingPanel
          crop={plot.active_crop}
          weather_tip={weather_tip}
          is_saving={is_saving}
          on_toggle_stage={toggleStage}
          on_harvest={handleHarvest}
          on_abandon={handleAbandon}
        />
      )}

      <div className="plot-flow">
      {plot.active_crop && (
        <div className="money-strip is-dense surface-panel is-summary">
          <div className="money-strip-head">
            <p className="surface-kicker">{t('farms.finance_summary')}</p>
            <p className="finance-insight is-inline">{finance_insight}</p>
          </div>
          <div className="money-strip-grid">
            <div>
              <div className="stat-label">{t('expenses.crop_total')}</div>
              <strong>₹{spending.toLocaleString('en-IN')}</strong>
            </div>
            <div>
              <div className="stat-label">{t('incomes.crop_total')}</div>
              <strong>₹{earned.toLocaleString('en-IN')}</strong>
            </div>
            <div>
              <div className="stat-label">
                {profit >= 0 ? t('finance.status_profit') : t('finance.status_loss')}
              </div>
              <strong className={profit >= 0 ? 'is-profit' : 'is-loss'}>
                {profit >= 0 ? '+' : '-'}₹{Math.abs(profit).toLocaleString('en-IN')}
              </strong>
            </div>
          </div>
        </div>
      )}

      {plot.active_crop && (
        <div className="plot-flow-block is-soft">
          <DiseaseScanPanel
            farm_id={farm_id}
            plot_id={plot_id}
            crop_cycle_id={plot.active_crop.id}
            crop_name={plot.active_crop.crop_name}
          />
        </div>
      )}

      {plot.active_crop && (
        <div className="plot-flow-block is-soft">
          <MandiPricePanel
            crop_name={plot.active_crop.crop_name}
            farm_id={farm_id}
            expense_total={spending}
          />
        </div>
      )}

      {plot.active_crop && (
        <>
          <section className="surface-panel is-expandable">
            <div className="collapsible-header">
              <button
                type="button"
                className="section-toggle"
                onClick={() => setIsExpensesOpen((prev) => !prev)}
                aria-expanded={is_expenses_open}
              >
                <div>
                  <div className="section-title-row">
                    <SectionIcon name="expense" tone="danger" />
                    <h3 style={{ margin: 0 }}>{t('expenses.title')}</h3>
                  </div>
                  <p className="section-note" style={{ margin: '4px 0 0' }}>
                    {t('expenses.collapsed_hint', {
                      count: plot.expenses?.length || 0,
                      amount: spending.toLocaleString('en-IN'),
                    })}
                  </p>
                </div>
                <span className="chevron-badge">{is_expenses_open ? '▾' : '▸'}</span>
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={openCreateExpense}>
                {t('expenses.add')}
              </button>
            </div>

            {is_expenses_open && (
              <div className="section-panel-body">
                <p className="section-note" style={{ marginTop: 0 }}>
                  {t('expenses.for_crop', { crop: plot.active_crop.crop_name })}
                </p>
                {!plot.expenses?.length ? (
                  <div className="empty-state" style={{ padding: '8px 0' }}>
                    <p>{t('expenses.empty')}</p>
                  </div>
                ) : (
                  <ul className="txn-list">
                    {plot.expenses.map((expense) => (
                      <li key={expense.id} className="txn-row">
                        <div className="txn-main">
                          <strong>{expense.title}</strong>
                          <span className="txn-meta">
                            {t(`expenses.category.${expense.category}`)}
                            {' · '}
                            {formatMoneyDate(expense.expense_date, i18n.language)}
                            {!expense.crop_cycle_id ? ` · ${t('expenses.unlinked_crop')}` : ''}
                            {expense.quantity != null
                              ? ` · ${expense.quantity} ${expense.unit || ''}`.trim()
                              : ''}
                          </span>
                        </div>
                        <div className="txn-aside">
                          <span className="txn-amount">₹{Number(expense.amount).toLocaleString('en-IN')}</span>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEditExpense(expense)}
                          >
                            {t('common.edit')}
                          </button>
                          <OverflowMenu
                            label={t('common.more')}
                            quiet
                            items={[
                              {
                                id: 'delete',
                                label: t('common.delete'),
                                danger: true,
                                onClick: () => handleDeleteExpense(expense),
                              },
                            ]}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          <section className="surface-panel is-expandable is-soft">
            <div className="collapsible-header">
              <button
                type="button"
                className="section-toggle"
                onClick={() => setIsIncomesOpen((prev) => !prev)}
                aria-expanded={is_incomes_open}
              >
                <div>
                  <div className="section-title-row">
                    <SectionIcon name="income" tone="success" />
                    <h3 style={{ margin: 0 }}>{t('incomes.title')}</h3>
                  </div>
                  <p className="section-note" style={{ margin: '4px 0 0' }}>
                    {t('incomes.collapsed_hint', {
                      count: plot.incomes?.length || 0,
                      amount: earned.toLocaleString('en-IN'),
                    })}
                  </p>
                </div>
                <span className="chevron-badge">{is_incomes_open ? '▾' : '▸'}</span>
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={openCreateIncome}>
                {t('incomes.add')}
              </button>
            </div>

            {is_incomes_open && (
              <div className="section-panel-body">
                <p className="section-note" style={{ marginTop: 0 }}>
                  {t('incomes.for_crop', { crop: plot.active_crop.crop_name })}
                </p>
                {!plot.incomes?.length ? (
                  <div className="empty-state" style={{ padding: '8px 0' }}>
                    <p>{t('incomes.empty')}</p>
                  </div>
                ) : (
                  <ul className="txn-list">
                    {plot.incomes.map((income) => (
                      <li key={income.id} className="txn-row">
                        <div className="txn-main">
                          <strong>{income.title}</strong>
                          <span className="txn-meta">
                            {t(`incomes.category.${income.category}`)}
                            {' · '}
                            {formatMoneyDate(income.income_date, i18n.language)}
                            {income.quantity != null
                              ? ` · ${income.quantity} ${income.unit || ''}`.trim()
                              : ''}
                          </span>
                        </div>
                        <div className="txn-aside">
                          <span className="txn-amount is-income">₹{Number(income.amount).toLocaleString('en-IN')}</span>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEditIncome(income)}
                          >
                            {t('common.edit')}
                          </button>
                          <OverflowMenu
                            label={t('common.more')}
                            quiet
                            items={[
                              {
                                id: 'delete',
                                label: t('common.delete'),
                                danger: true,
                                onClick: () => handleDeleteIncome(income),
                              },
                            ]}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </>
      )}



      <PendingIncomeSection
        crops={pending_income_crops}
        on_log_income={(crop) => {
          setIsHistoryOpen(true);
          setExpandedHistoryId(crop.id);
          openCreateIncomeForCrop(crop);
        }}
        on_changed={loadPlot}
      />

      {plot.crop_history?.length > 0 && (
        <section className="surface-panel is-expandable">
          <button
            type="button"
            className="section-toggle"
            onClick={() => setIsHistoryOpen((prev) => !prev)}
            aria-expanded={is_history_open}
          >
            <div>
              <div className="section-title-row">
                <SectionIcon name="history" tone="default" />
                <h3 style={{ margin: 0 }}>{t('crops.history')}</h3>
              </div>
              <p className="section-note" style={{ margin: '4px 0 0' }}>
                {t('crops.history_collapsed_hint', { count: plot.crop_history.length })}
              </p>
            </div>
            <span className="chevron-badge">{is_history_open ? '▾' : '▸'}</span>
          </button>

          {is_history_open && (
            <div className="section-panel-body">
              <p className="section-note" style={{ marginTop: 0 }}>{t('crops.history_hint')}</p>
              <ul className="history-list">
                {plot.crop_history.map((crop) => {
                  const is_expanded = expanded_history_id === crop.id;
                  const crop_profit = Number(crop.profit || 0);

                  return (
                    <li key={crop.id} className="history-item">
                      <button
                        type="button"
                        className="history-toggle"
                        onClick={() => setExpandedHistoryId(is_expanded ? '' : crop.id)}
                      >
                        <div className="farm-card-top">
                          <div>
                            <strong>{crop.crop_name}</strong>
                            <div className="farm-meta">
                              <span>{t(`crops.status.${crop.status}`)}</span>
                              <span>
                                {formatMoneyDate(crop.sowing_date)} →{' '}
                                {formatMoneyDate(crop.actual_harvest_date) !== '—'
                                  ? formatMoneyDate(crop.actual_harvest_date)
                                  : t(`crops.status.${crop.status}`)}
                              </span>
                            </div>
                          </div>
                          <div className="action-row">
                            <span className={`badge ${crop_profit >= 0 ? 'badge-green' : 'badge-loss'}`}>
                              {crop_profit >= 0 ? '+' : '-'}₹{Math.abs(crop_profit).toLocaleString('en-IN')}
                            </span>
                            <span className="badge">
                              {is_expanded ? t('crops.hide_details') : t('crops.view_details')}
                            </span>
                          </div>
                        </div>
                        <div className="history-finance">
                          <span>
                            {t('expenses.crop_total')}: ₹{Number(crop.expense_total || 0).toLocaleString('en-IN')}
                          </span>
                          <span>
                            {t('incomes.crop_total')}: ₹{Number(crop.income_total || 0).toLocaleString('en-IN')}
                          </span>
                          <span>
                            {t('finance.profit')}: ₹{crop_profit.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </button>

                      {is_expanded && (
                        <div className="history-details">
                          <h4>{t('expenses.title')}</h4>
                          {!crop.expenses?.length ? (
                            <p className="section-note">{t('expenses.empty')}</p>
                          ) : (
                            <ul className="activity-list">
                              {crop.expenses.map((expense) => (
                                <li key={expense.id} className="activity-item">
                                  <span className="activity-dot" />
                                  <div className="expense-body">
                                    <div className="farm-card-top">
                                      <div>
                                        <strong>{expense.title}</strong>
                                        <div className="farm-meta">
                                          <span>{t(`expenses.category.${expense.category}`)}</span>
                                          <span>{formatMoneyDate(expense.expense_date)}</span>
                                          {expense.quantity != null && (
                                            <span>
                                              {expense.quantity} {expense.unit || ''}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <span className="expense-amount">
                                        ₹{Number(expense.amount).toLocaleString('en-IN')}
                                      </span>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}

                          <div className="page-header-row" style={{ marginTop: 16 }}>
                            <h4 style={{ margin: 0 }}>{t('incomes.title')}</h4>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => openCreateIncomeForCrop(crop)}
                            >
                              {t('incomes.add')}
                            </button>
                          </div>
                          {!crop.incomes?.length ? (
                            <p className="section-note">{t('incomes.empty')}</p>
                          ) : (
                            <ul className="activity-list">
                              {crop.incomes.map((income) => (
                                <li key={income.id} className="activity-item">
                                  <span className="activity-dot" />
                                  <div className="expense-body">
                                    <div className="farm-card-top">
                                      <div>
                                        <strong>{income.title}</strong>
                                        <div className="farm-meta">
                                          <span>{t(`incomes.category.${income.category}`)}</span>
                                          <span>{formatMoneyDate(income.income_date)}</span>
                                          {income.quantity != null && (
                                            <span>
                                              {income.quantity} {income.unit || ''}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="action-row">
                                        <span className="expense-amount">
                                          ₹{Number(income.amount).toLocaleString('en-IN')}
                                        </span>
                                        <button
                                          type="button"
                                          className="btn btn-secondary btn-sm"
                                          onClick={() => openEditIncome(income)}
                                        >
                                          {t('common.edit')}
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-danger btn-sm"
                                          onClick={() => handleDeleteIncome(income)}
                                        >
                                          {t('common.delete')}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}

                          <div className="history-delete-row">
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => openDeleteCropModal(crop)}
                            >
                              {t('crops.delete_history')}
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      )}
      </div>

      {crop_to_delete && (
        <Modal
          title={t('crops.delete_history')}
          on_close={() => setCropToDelete(null)}
          footer={(
            <div className="modal-actions is-pinned">
              <button type="button" className="btn btn-secondary" onClick={() => setCropToDelete(null)}>
                {t('farms.cancel')}
              </button>
              <button type="button" className="btn btn-danger" onClick={handleConfirmDeleteCrop} disabled={is_saving}>
                {is_saving ? t('common.loading') : t('crops.delete_history_confirm_btn')}
              </button>
            </div>
          )}
        >
          <div className="sheet-section">
            <p className="delete-crop-name">{crop_to_delete.crop_name}</p>
            <p className="confirm-dialog-message">
              {(crop_to_delete.expenses?.length || 0) + (crop_to_delete.incomes?.length || 0) > 0
                ? t('crops.delete_history_with_money', {
                    crop: crop_to_delete.crop_name,
                    expenses: crop_to_delete.expenses?.length || 0,
                    incomes: crop_to_delete.incomes?.length || 0,
                  })
                : t('crops.delete_history_confirm', { crop: crop_to_delete.crop_name })}
            </p>
            {error_message && <div className="error-banner">{error_message}</div>}
          </div>
        </Modal>
      )}

      {show_crop_modal && (
        <Modal
          title={t('crops.start_crop')}
          on_close={() => setShowCropModal(false)}
          footer={(
            <div className="modal-actions is-pinned">
              <button type="button" className="btn btn-secondary" onClick={() => setShowCropModal(false)}>
                {t('farms.cancel')}
              </button>
              <button type="submit" form="start-crop-form" className="btn btn-primary" disabled={is_saving}>
                {is_saving ? t('common.loading') : t('farms.save')}
              </button>
            </div>
          )}
        >
          {error_message && <div className="error-banner">{error_message}</div>}
          <form id="start-crop-form" className="sheet-form" onSubmit={handleStartCrop}>
            <section className="sheet-section">
              <p className="sheet-section-label">{t('common.sheet_basics')}</p>
              <div className="form-group">
                <label>{t('crops.template')}</label>
                <select
                  className="form-select"
                  value={crop_form.crop_template_id}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                >
                  <option value="">{t('crops.custom_crop')}</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>{t('crops.crop_name')}</label>
                <input
                  className="form-input"
                  value={crop_form.crop_name}
                  onChange={(e) => setCropForm((p) => ({ ...p, crop_name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('crops.season_label')}</label>
                <div className="choice-chips">
                  {SEASON_OPTIONS.map((season) => (
                    <button
                      key={season}
                      type="button"
                      className={`choice-chip${crop_form.season_type === season ? ' is-active' : ''}`}
                      onClick={() => setCropForm((p) => ({ ...p, season_type: season }))}
                    >
                      {t(`crops.season.${season}`)}
                    </button>
                  ))}
                </div>
              </div>
            </section>
            <section className="sheet-section">
              <p className="sheet-section-label">{t('common.sheet_details')}</p>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('crops.sowing_date')}</label>
                  <input
                    className="form-input"
                    type="date"
                    value={crop_form.sowing_date}
                    onChange={(e) => setCropForm((p) => ({ ...p, sowing_date: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>{t('crops.expected_harvest')}</label>
                  <input
                    className="form-input"
                    type="date"
                    value={crop_form.expected_harvest_date}
                    onChange={(e) => setCropForm((p) => ({ ...p, expected_harvest_date: e.target.value }))}
                  />
                </div>
              </div>
            </section>
          </form>
        </Modal>
      )}

      {show_expense_modal && (
        <Modal
          title={editing_expense ? t('expenses.edit') : t('expenses.add')}
          on_close={() => {
            setShowExpenseModal(false);
            setEditingExpense(null);
          }}
          footer={(
            <div className="modal-actions is-pinned">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowExpenseModal(false);
                  setEditingExpense(null);
                }}
              >
                {t('farms.cancel')}
              </button>
              <button type="submit" form="plot-expense-form" className="btn btn-primary" disabled={is_saving}>
                {is_saving ? t('common.loading') : t('farms.save')}
              </button>
            </div>
          )}
        >
          {error_message && <div className="error-banner">{error_message}</div>}
          <form id="plot-expense-form" className="sheet-form" onSubmit={handleSaveExpense}>
            <section className="sheet-section">
              <p className="sheet-section-label">{t('common.sheet_category')}</p>
              <div className="choice-chips">
                {EXPENSE_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={`choice-chip${expense_form.category === category ? ' is-active' : ''}`}
                    onClick={() => setExpenseForm((p) => applyExpenseCategoryChange(p, category))}
                  >
                    {t(`expenses.category.${category}`)}
                  </button>
                ))}
              </div>
              <div className="form-group">
                <label>{t('expenses.title_label')}</label>
                <input
                  className="form-input"
                  value={expense_form.title}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, title: e.target.value }))}
                  required
                />
              </div>
            </section>
            <section className="sheet-section">
              <p className="sheet-section-label">{t('common.sheet_amount')}</p>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('expenses.amount')}</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={expense_form.amount}
                    onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{t('expenses.date')}</label>
                  <input
                    className="form-input"
                    type="date"
                    value={expense_form.expense_date}
                    onChange={(e) => setExpenseForm((p) => ({ ...p, expense_date: e.target.value }))}
                    required
                  />
                </div>
              </div>
              {expense_field_config.show_quantity && (
                <div className="form-row">
                  <div className="form-group">
                    <label>{t(`expenses.quantity_labels.${expense_field_config.quantity_key}`)}</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={expense_form.quantity}
                      onChange={(e) => setExpenseForm((p) => ({ ...p, quantity: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('expenses.unit')}</label>
                    {expense_field_config.unit_options ? (
                      <select
                        className="form-select"
                        value={expense_form.unit}
                        onChange={(e) => setExpenseForm((p) => ({ ...p, unit: e.target.value }))}
                      >
                        {expense_field_config.unit_options.map((unit) => (
                          <option key={unit} value={unit}>
                            {t(`expenses.units.${unit}`, { defaultValue: unit })}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="form-input"
                        value={expense_form.unit}
                        onChange={(e) => setExpenseForm((p) => ({ ...p, unit: e.target.value }))}
                        placeholder={t('expenses.unit_placeholder')}
                      />
                    )}
                  </div>
                </div>
              )}
              {!expense_field_config.show_quantity && (
                <p className="section-note">{t('expenses.amount_only_hint')}</p>
              )}
            </section>
            <section className="sheet-section">
              <p className="sheet-section-label">{t('common.sheet_optional')}</p>
              <div className="form-group">
                <label>{t('farms.notes')}</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={expense_form.notes}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </section>
          </form>
        </Modal>
      )}

      {harvest_success_crop && (
        <Modal
          title={t('crops.harvest_success_title')}
          on_close={handleHarvestSuccessLater}
          footer={(
            <div className="modal-actions is-pinned">
              <button type="button" className="btn btn-secondary" onClick={handleHarvestSuccessLater}>
                {t('crops.harvest_success_later')}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleHarvestSuccessLogIncome}>
                {t('crops.harvest_success_log_income')}
              </button>
            </div>
          )}
        >
          <div className="sheet-section" style={{ textAlign: 'center' }}>
            <div className="harvest-success-icon" aria-hidden="true">✓</div>
            <p className="harvest-success-crop">{harvest_success_crop.crop_name}</p>
            <p className="harvest-success-body">{t('crops.harvest_success_body')}</p>
            <p className="section-note">{t('crops.harvest_success_hint')}</p>
          </div>
          <div className="sheet-section">
            <MandiPricePanel
              crop_name={harvest_success_crop.crop_name}
              farm_id={farm_id}
              expense_total={Number(harvest_success_crop.expense_total || 0)}
              default_open
              compact
            />
          </div>
        </Modal>
      )}

      {show_income_modal && (
        <Modal
          title={editing_income ? t('incomes.edit') : t('incomes.add')}
          on_close={closeIncomeModal}
          footer={(
            <div className="modal-actions is-pinned">
              <button type="button" className="btn btn-secondary" onClick={closeIncomeModal}>
                {t('farms.cancel')}
              </button>
              <button type="submit" form="plot-income-form" className="btn btn-primary" disabled={is_saving}>
                {is_saving ? t('common.loading') : t('farms.save')}
              </button>
            </div>
          )}
        >
          {income_crop_context?.crop_name && (
            <p className="section-note">{t('incomes.for_crop', { crop: income_crop_context.crop_name })}</p>
          )}
          {error_message && <div className="error-banner">{error_message}</div>}
          <form id="plot-income-form" className="sheet-form" onSubmit={handleSaveIncome}>
            <section className="sheet-section">
              <p className="sheet-section-label">{t('common.sheet_category')}</p>
              <div className="choice-chips">
                {INCOME_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={`choice-chip${income_form.category === category ? ' is-active' : ''}`}
                    onClick={() => setIncomeForm((p) => applyIncomeCategoryChange(p, category))}
                  >
                    {t(`incomes.category.${category}`)}
                  </button>
                ))}
              </div>
              <div className="form-group">
                <label>{t('incomes.title_label')}</label>
                <input
                  className="form-input"
                  value={income_form.title}
                  onChange={(e) => setIncomeForm((p) => ({ ...p, title: e.target.value }))}
                  required
                />
              </div>
            </section>
            <section className="sheet-section">
              <p className="sheet-section-label">{t('common.sheet_amount')}</p>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('incomes.amount')}</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={income_form.amount}
                    onChange={(e) => setIncomeForm((p) => ({ ...p, amount: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{t('incomes.date')}</label>
                  <input
                    className="form-input"
                    type="date"
                    value={income_form.income_date}
                    onChange={(e) => setIncomeForm((p) => ({ ...p, income_date: e.target.value }))}
                    required
                  />
                </div>
              </div>
              {income_field_config.show_quantity && (
                <div className="form-row">
                  <div className="form-group">
                    <label>{t(`incomes.quantity_labels.${income_field_config.quantity_key}`)}</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={income_form.quantity}
                      onChange={(e) => setIncomeForm((p) => ({ ...p, quantity: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('expenses.unit')}</label>
                    {income_field_config.unit_options ? (
                      <select
                        className="form-select"
                        value={income_form.unit}
                        onChange={(e) => setIncomeForm((p) => ({ ...p, unit: e.target.value }))}
                      >
                        {income_field_config.unit_options.map((unit) => (
                          <option key={unit} value={unit}>
                            {t(`incomes.units.${unit}`, { defaultValue: unit })}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="form-input"
                        value={income_form.unit}
                        onChange={(e) => setIncomeForm((p) => ({ ...p, unit: e.target.value }))}
                        placeholder={t('expenses.unit_placeholder')}
                      />
                    )}
                  </div>
                </div>
              )}
              {!income_field_config.show_quantity && (
                <p className="section-note">{t('incomes.amount_only_hint')}</p>
              )}
            </section>
            <section className="sheet-section">
              <p className="sheet-section-label">{t('common.sheet_optional')}</p>
              <div className="form-group">
                <label>{t('farms.notes')}</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={income_form.notes}
                  onChange={(e) => setIncomeForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </section>
          </form>
        </Modal>
      )}

      {show_plot_modal && (
        <Modal
          title={t('farms.edit_plot')}
          on_close={() => setShowPlotModal(false)}
          footer={(
            <div className="modal-actions is-pinned">
              <button type="button" className="btn btn-secondary" onClick={() => setShowPlotModal(false)}>
                {t('farms.cancel')}
              </button>
              <button type="submit" form="edit-plot-form" className="btn btn-primary" disabled={is_saving}>
                {is_saving ? t('common.loading') : t('farms.save')}
              </button>
            </div>
          )}
        >
          {error_message && <div className="error-banner">{error_message}</div>}
          <form id="edit-plot-form" className="sheet-form" onSubmit={handleSavePlot}>
            <section className="sheet-section">
              <p className="sheet-section-label">{t('common.sheet_basics')}</p>
              <div className="form-group">
                <label>{t('farms.plot_name')}</label>
                <input
                  className="form-input"
                  value={plot_form.name}
                  onChange={(e) => setPlotForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>
                  {t('farms.plot_area')} ({land_unit_label})
                </label>
                <input
                  className="form-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={plot_form.area}
                  onChange={(e) => setPlotForm((p) => ({ ...p, area: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('farms.soil_type')}</label>
                <input
                  className="form-input"
                  value={plot_form.soil_type}
                  onChange={(e) => setPlotForm((p) => ({ ...p, soil_type: e.target.value }))}
                />
              </div>
            </section>
          </form>
        </Modal>
      )}

      {confirm_delete && (
        <ConfirmDialog
          title={t('common.confirm')}
          message={confirm_delete.message}
          is_danger
          is_loading={is_saving}
          on_confirm={runConfirmDelete}
          on_cancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

export default PlotDetailPage;
