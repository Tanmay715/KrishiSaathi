import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  createPlot,
  deleteFarm,
  deletePlot,
  getFarm,
  getFarmSeasonFinance,
  getPendingIncomeCrops,
  linkOrphanMoney,
  updateFarm,
  updatePlot,
} from '../services/farm_service';
import { useAuth } from '../hooks/useAuth';
import { CACHE_KEYS, loadOfflineData, saveFarmDetail, saveOfflineData } from '../utils/offline_store';
import FarmFinanceSummary from '../components/FarmFinanceSummary';
import PendingIncomeSection from '../components/PendingIncomeSection';
import SeasonFinanceToolbar from '../components/SeasonFinanceToolbar';
import SeasonReportSheet from '../components/SeasonReportSheet';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import RemindersPanel from '../components/RemindersPanel';
import MandiPricePanel from '../components/MandiPricePanel';
import { INDIAN_STATES } from '../config/indian_states';

const EMPTY_PLOT = { name: '', area: '', soil_type: '', notes: '' };

function FarmDetailPage() {
  const { farm_id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [farm, setFarm] = useState(null);
  const [is_loading, setIsLoading] = useState(true);
  const [show_plot_modal, setShowPlotModal] = useState(false);
  const [show_farm_modal, setShowFarmModal] = useState(false);
  const [editing_plot, setEditingPlot] = useState(null);
  const [confirm_action, setConfirmAction] = useState(null);
  const [is_saving, setIsSaving] = useState(false);
  const [error_message, setErrorMessage] = useState('');
  const state_label_key = i18n.language === 'hi' ? 'label_hi' : 'label_en';
  const [plot_form, setPlotForm] = useState(EMPTY_PLOT);
  const [farm_form, setFarmForm] = useState({
    name: '',
    state: '',
    district: '',
    village: '',
    total_area: '',
    notes: '',
  });
  const [pending_income_crops, setPendingIncomeCrops] = useState([]);
  const [season_finance, setSeasonFinance] = useState(null);
  const [season_filter, setSeasonFilter] = useState('all');
  const [year_filter, setYearFilter] = useState('all');
  const [orphan_notice, setOrphanNotice] = useState('');
  const [is_cached_view, setIsCachedView] = useState(false);

  const land_unit_label = t(`common.${user?.preferred_land_unit || 'acre'}`);

  useEffect(() => {
    loadFarmPage();
  }, [farm_id]);

  useEffect(() => {
    if (farm) {
      loadSeasonFinance(season_filter, year_filter);
    }
  }, [season_filter, year_filter, farm?.id]);

  async function loadFarmPage() {
    setIsLoading(true);

    try {
      const link_response = await linkOrphanMoney();
      if (link_response.data?.total_linked > 0) {
        setOrphanNotice(
          t('season.orphans_linked', { count: link_response.data.total_linked }),
        );
      }

      const [farm_response, pending_response] = await Promise.all([
        getFarm(farm_id),
        getPendingIncomeCrops(),
      ]);
      setFarm(farm_response.data);
      saveFarmDetail(farm_id, farm_response.data);
      saveOfflineData(CACHE_KEYS.farms, farm_response.data);
      setIsCachedView(false);
      const farm_pending = (pending_response.data || []).filter((crop) => crop.farm_id === farm_id);
      setPendingIncomeCrops(farm_pending);
    } catch (error) {
      console.error(error);
      const cached_farm = loadOfflineData(`${CACHE_KEYS.farm_detail}${farm_id}`)
        || loadOfflineData(CACHE_KEYS.farms);
      if (cached_farm && cached_farm.id === farm_id) {
        setFarm(cached_farm);
        setIsCachedView(true);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSeasonFinance(season, year) {
    try {
      const response = await getFarmSeasonFinance(farm_id, { season, year });
      setSeasonFinance(response.data);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadFarm() {
    await loadFarmPage();
    await loadSeasonFinance(season_filter, year_filter);
  }

  function handleSeasonFilterChange(next) {
    setSeasonFilter(next.season);
    setYearFilter(next.year);
  }

  function handlePrintReport() {
    window.print();
  }

  function getSeasonFilterLabel() {
    if (!season_finance) {
      return '';
    }

    const season = season_finance.filters?.season || 'all';
    const year = season_finance.filters?.year || 'all';
    const season_label = season === 'all' ? t('season.all_seasons') : t(`crops.season.${season}`);
    const year_label = year === 'all' ? t('season.all_years') : year;
    return `${season_label} · ${year_label}`;
  }

  function openCreatePlot() {
    setEditingPlot(null);
    setPlotForm(EMPTY_PLOT);
    setErrorMessage('');
    setShowPlotModal(true);
  }

  function openEditPlot(event, plot) {
    event.preventDefault();
    event.stopPropagation();
    setEditingPlot(plot);
    setPlotForm({
      name: plot.name || '',
      area: plot.area != null ? String(plot.area) : '',
      soil_type: plot.soil_type || '',
      notes: plot.notes || '',
    });
    setErrorMessage('');
    setShowPlotModal(true);
  }

  function openEditFarm() {
    setFarmForm({
      name: farm.name || '',
      state: farm.state || '',
      district: farm.district || '',
      village: farm.village || '',
      total_area: farm.total_area != null ? String(farm.total_area) : '',
      notes: farm.notes || '',
    });
    setErrorMessage('');
    setShowFarmModal(true);
  }

  async function handleSavePlot(event) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage('');

    const payload = {
      ...plot_form,
      area: Number(plot_form.area),
    };

    try {
      if (editing_plot) {
        await updatePlot(farm_id, editing_plot.id, payload);
      } else {
        await createPlot(farm_id, payload);
      }
      setShowPlotModal(false);
      setEditingPlot(null);
      setPlotForm(EMPTY_PLOT);
      await loadFarm();
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveFarm(event) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage('');

    try {
      await updateFarm(farm_id, {
        ...farm_form,
        total_area: farm_form.total_area ? Number(farm_form.total_area) : 0,
      });
      setShowFarmModal(false);
      await loadFarm();
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  function handleDeletePlot(event, plot) {
    event.preventDefault();
    event.stopPropagation();
    setConfirmAction({ type: 'plot', plot });
  }

  function handleDeleteFarm() {
    setConfirmAction({ type: 'farm' });
  }

  async function runConfirmAction() {
    if (!confirm_action) {
      return;
    }

    setIsSaving(true);

    try {
      if (confirm_action.type === 'plot') {
        await deletePlot(farm_id, confirm_action.plot.id);
        setConfirmAction(null);
        await loadFarm();
      } else {
        await deleteFarm(farm_id);
        setConfirmAction(null);
        navigate('/farms');
      }
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
      setConfirmAction(null);
    } finally {
      setIsSaving(false);
    }
  }

  if (is_loading) {
    return <LoadingState />;
  }

  if (!farm) {
    return <ErrorState message={t('common.error')} on_retry={loadFarm} />;
  }

  return (
    <div>
      <div className="page-header">
        <Link to="/farms" className="back-link">
          ← {t('farms.title')}
        </Link>
        <div className="page-header-row">
          <div>
            <h2>{farm.name}</h2>
            <p>{[farm.village, farm.district, farm.state].filter(Boolean).join(', ') || '—'}</p>
          </div>
          <div className="action-row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={openEditFarm}>
              {t('farms.edit_farm')}
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={handleDeleteFarm}>
              {t('common.delete')}
            </button>
          </div>
        </div>
      </div>

      {error_message && !show_plot_modal && !show_farm_modal && (
        <div className="error-banner">{error_message}</div>
      )}

      {orphan_notice && (
        <div className="info-banner no-print">{orphan_notice}</div>
      )}

      {is_cached_view && (
        <div className="info-banner no-print">{t('pwa.cached_data')}</div>
      )}

      <PendingIncomeSection crops={pending_income_crops} show_location />

      <div className="no-print" style={{ marginTop: 16 }}>
        <MandiPricePanel
          farm_id={farm_id}
          crop_options={['Wheat', 'Rice', 'Cotton', 'Mustard', 'Potato', 'Moong', 'Chana', 'Onion', 'Tomato']}
        />
      </div>

      <div className="section-header page-header-row">
        <h3 style={{ margin: 0 }}>{t('farms.plots')}</h3>
        <button type="button" className="btn btn-primary" onClick={openCreatePlot}>
          {t('farms.add_plot')}
        </button>
      </div>

      {!farm.plots?.length ? (
        <div className="card empty-state">
          <p>{t('farms.no_plots')}</p>
          <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={openCreatePlot}>
            {t('farms.add_plot')}
          </button>
        </div>
      ) : (
        <div className="farm-list">
          {farm.plots.map((plot) => (
            <div key={plot.id} className="card farm-card">
              <Link to={`/farms/${farm_id}/plots/${plot.id}`} className="farm-card-link">
                <div className="farm-card-top">
                  <h3 style={{ margin: '0 0 8px' }}>{plot.name}</h3>
                  <span className="badge">{t('farms.view_plot')} →</span>
                </div>
                <div className="farm-meta">
                  <span>
                    {plot.area} {land_unit_label}
                  </span>
                  {plot.soil_type && <span>{plot.soil_type}</span>}
                  {plot.active_crop && (
                    <span className="badge badge-green">
                      {t('farms.active_crop')}: {plot.active_crop.crop_name}
                    </span>
                  )}
                  {(plot.expense_total > 0 || plot.income_total > 0) && (
                    <span className={`badge ${plot.profit >= 0 ? 'badge-green' : 'badge-loss'}`}>
                      {t('farms.plot_profit')}: {plot.profit >= 0 ? '+' : '-'}₹
                      {Math.abs(Number(plot.profit || 0)).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
              </Link>
              <div className="action-row">
                <button type="button" className="btn btn-secondary btn-sm" onClick={(e) => openEditPlot(e, plot)}>
                  {t('common.edit')}
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={(e) => handleDeletePlot(e, plot)}>
                  {t('common.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="season-finance-section no-print" style={{ marginTop: 28 }}>
        <SeasonFinanceToolbar
          season={season_filter}
          year={year_filter}
          filter_options={season_finance?.filter_options}
          on_change={handleSeasonFilterChange}
          on_print={handlePrintReport}
        />
        <FarmFinanceSummary
          finance={season_finance?.finance || farm.finance}
          plots={season_finance?.plots || farm.plots || []}
          crops={season_finance?.crops || []}
          filter_label={getSeasonFilterLabel()}
        />
      </div>

      <SeasonReportSheet
        farm={season_finance?.farm || farm}
        finance={season_finance?.finance || farm.finance}
        plots={season_finance?.plots || farm.plots || []}
        crops={season_finance?.crops || []}
        season={season_filter}
        year={year_filter}
      />

      <div className="no-print" style={{ marginTop: 20, marginBottom: 24 }}>
        <RemindersPanel farm_id={farm_id} compact />
      </div>

      {show_plot_modal && (
        <div className="modal-overlay" onClick={() => setShowPlotModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing_plot ? t('farms.edit_plot') : t('farms.add_plot')}</h3>
            {error_message && <div className="error-banner">{error_message}</div>}
            <form onSubmit={handleSavePlot}>
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
              <div className="form-group">
                <label>{t('farms.notes')}</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={plot_form.notes}
                  onChange={(e) => setPlotForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPlotModal(false)}>
                  {t('farms.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={is_saving}>
                  {is_saving ? t('common.loading') : t('farms.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {show_farm_modal && (
        <div className="modal-overlay" onClick={() => setShowFarmModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('farms.edit_farm')}</h3>
            {error_message && <div className="error-banner">{error_message}</div>}
            <form onSubmit={handleSaveFarm}>
              <div className="form-group">
                <label>{t('farms.name')}</label>
                <input
                  className="form-input"
                  value={farm_form.name}
                  onChange={(e) => setFarmForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('farms.state')}</label>
                  <select
                    className="form-select"
                    value={farm_form.state}
                    onChange={(e) => setFarmForm((p) => ({ ...p, state: e.target.value }))}
                  >
                    <option value="">—</option>
                    {INDIAN_STATES.map((state) => (
                      <option key={state.code} value={state.label_en}>
                        {state[state_label_key]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('farms.district')}</label>
                  <input
                    className="form-input"
                    value={farm_form.district}
                    onChange={(e) => setFarmForm((p) => ({ ...p, district: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('farms.village')}</label>
                  <input
                    className="form-input"
                    value={farm_form.village}
                    onChange={(e) => setFarmForm((p) => ({ ...p, village: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>{t('farms.total_area')}</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={farm_form.total_area}
                    onChange={(e) => setFarmForm((p) => ({ ...p, total_area: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowFarmModal(false)}>
                  {t('farms.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={is_saving}>
                  {is_saving ? t('common.loading') : t('farms.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirm_action && (
        <ConfirmDialog
          title={t('common.delete')}
          message={
            confirm_action.type === 'plot'
              ? t('farms.delete_plot_confirm', { name: confirm_action.plot.name })
              : t('farms.delete_confirm', { name: farm.name })
          }
          is_danger
          is_loading={is_saving}
          on_confirm={runConfirmAction}
          on_cancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

export default FarmDetailPage;
