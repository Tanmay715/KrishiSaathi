import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import OverflowMenu from '../components/OverflowMenu';
import { INDIAN_STATES } from '../config/indian_states';
import { getDistrictsForState, normalizeDistrictOption } from '../config/indian_districts';
import { normalizeLanguage } from '../utils/language';
import { formatArea, formatShortDate } from '../utils/format_date';

const EMPTY_PLOT = { name: '', area: '', soil_type: '', notes: '' };

function formatAmount(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

function FarmDetailPage() {
  const { farm_id } = useParams();
  const navigate = useNavigate();
  const [search_params, setSearchParams] = useSearchParams();
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
  const [coming_soon, setComingSoon] = useState('');
  const app_language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  const state_label_key = app_language === 'hi' ? 'label_hi' : 'label_en';
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

  const farm_district_options = getDistrictsForState(farm_form.state);
  const has_custom_farm_district = Boolean(
    farm_form.district && !farm_district_options.includes(farm_form.district),
  );
  const land_unit_label = t(`common.${user?.preferred_land_unit || 'acre'}`);

  function handleFarmStateChange(state) {
    setFarmForm((prev) => {
      const next_district = normalizeDistrictOption(state, prev.district);
      const options = getDistrictsForState(state);
      return {
        ...prev,
        state,
        district: options.includes(next_district) ? next_district : '',
      };
    });
  }

  useEffect(() => {
    loadFarmPage();
  }, [farm_id]);

  useEffect(() => {
    if (farm) {
      loadSeasonFinance(season_filter, year_filter);
    }
  }, [season_filter, year_filter, farm?.id]);

  useEffect(() => {
    if (search_params.get('add_plot') !== '1' || !farm) {
      return;
    }
    openCreatePlot();
    const next = new URLSearchParams(search_params);
    next.delete('add_plot');
    setSearchParams(next, { replace: true });
  }, [search_params, farm, setSearchParams]);

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
    const state = farm.state || '';
    setFarmForm({
      name: farm.name || '',
      state,
      district: normalizeDistrictOption(state, farm.district || ''),
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

  const stats = useMemo(() => {
    if (!farm) {
      return { crops: 0, plots: 0, area: 0, cost: 0 };
    }
    const plots = farm.plots || [];
    return {
      plots: plots.length,
      crops: plots.filter((plot) => plot.active_crop).length,
      area: Number(farm.total_area || 0),
      cost: Number(farm.finance?.expense_total || 0),
    };
  }, [farm]);

  if (is_loading) {
    return <LoadingState />;
  }

  if (!farm) {
    return <ErrorState message={t('common.error')} on_retry={loadFarm} />;
  }

  return (
    <div className="farm-detail-hub page-stack">
      <div className="farm-detail-top">
        <Link to="/farms" className="farm-detail-back">
          <span aria-hidden="true">←</span>
          <em>{t('farms.title')}</em>
        </Link>
        <div className="farm-detail-heading">
          <h2>{t('farms.detail_title')}</h2>
          <p>{t('farms.detail_subtitle')}</p>
        </div>
        <OverflowMenu
          label={t('common.more')}
          quiet
          items={[
            { id: 'edit-farm', label: t('farms.edit_farm'), onClick: openEditFarm },
            {
              id: 'delete-farm',
              label: t('common.delete'),
              danger: true,
              onClick: handleDeleteFarm,
            },
          ]}
        />
      </div>

      {error_message && !show_plot_modal && !show_farm_modal && (
        <div className="error-banner">{error_message}</div>
      )}
      {orphan_notice && <div className="info-banner no-print">{orphan_notice}</div>}
      {is_cached_view && <div className="info-banner no-print">{t('pwa.cached_data')}</div>}

      <article className="farm-hub-card is-detail">
        <div className="farm-hub-card-main">
          <span className="farm-hub-mark" aria-hidden="true">
            {(farm.name || '?').trim().charAt(0).toUpperCase()}
          </span>
          <div className="farm-hub-card-copy">
            <h3>{farm.name}</h3>
            {(farm.village || farm.district || farm.state) && (
              <p>{[farm.village, farm.district, farm.state].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          <button
            type="button"
            className="farm-detail-edit"
            onClick={openEditFarm}
            aria-label={t('farms.edit_farm')}
          >
            ✎
          </button>
        </div>
      </article>

      <div className="farm-detail-stats">
        <div className="farm-detail-stat">
          <span>{t('farms.stat_area')}</span>
          <strong>{formatArea(stats.area)}</strong>
          <small>{land_unit_label}</small>
        </div>
        <div className="farm-detail-stat">
          <span>{t('farms.stat_plots')}</span>
          <strong>{stats.plots}</strong>
          <small>{t('farms.plots_unit')}</small>
        </div>
        <div className="farm-detail-stat">
          <span>{t('farms.stat_crops')}</span>
          <strong>{stats.crops}</strong>
          <small>{t('farms.crops_unit')}</small>
        </div>
        <div className="farm-detail-stat">
          <span>{t('farms.stat_cost')}</span>
          <strong>₹{formatAmount(stats.cost)}</strong>
          <small>{t('farms.summary_estimated')}</small>
        </div>
      </div>

      <PendingIncomeSection crops={pending_income_crops} show_location />

      <section className="farms-hub-section">
        <div className="farms-hub-section-head">
          <h3 className="farms-hub-section-title">{t('farms.plots_list')}</h3>
          <button type="button" className="home-section-link" onClick={openCreatePlot}>
            + {t('farms.add_plot')}
          </button>
        </div>

        {!farm.plots?.length ? (
          <EmptyState
            message={t('farms.no_plots')}
            action={(
              <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={openCreatePlot}>
                {t('farms.add_plot')}
              </button>
            )}
          />
        ) : (
          <div className="plot-hub-list">
            {farm.plots.map((plot) => {
              const crop = plot.active_crop;
              const is_active = Boolean(crop);
              return (
                <article key={plot.id} className="plot-hub-card">
                  <div className="plot-hub-head">
                    <span className="plot-hub-mark" aria-hidden="true">
                      {(plot.name || '?').trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="plot-hub-title">
                      <div className="plot-hub-name-row">
                        <h3>{plot.name}</h3>
                        <span className={`plot-status-pill${is_active ? ' is-active' : ''}`}>
                          {is_active ? t('farms.plot_active') : t('farms.plot_idle')}
                        </span>
                      </div>
                      <p>
                        {formatArea(plot.area)} {land_unit_label}
                        {plot.soil_type ? ` · ${plot.soil_type}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="plot-hub-grid">
                    <div>
                      <span>{t('crops.current_crop')}</span>
                      <strong>{crop?.crop_name || '—'}</strong>
                    </div>
                    <div>
                      <span>{t('farms.crop_status')}</span>
                      <strong>
                        {crop
                          ? t(`crops.status.${crop.status}`, { defaultValue: t('farms.status_good') })
                          : '—'}
                      </strong>
                    </div>
                    <div>
                      <span>{t('farms.start_date')}</span>
                      <strong>{formatShortDate(crop?.sowing_date, app_language)}</strong>
                    </div>
                    <div>
                      <span>{t('farms.est_harvest')}</span>
                      <strong>{formatShortDate(crop?.expected_harvest_date, app_language)}</strong>
                    </div>
                  </div>

                  <div className="plot-hub-actions">
                    <Link to={`/farms/${farm_id}/plots/${plot.id}`} className="plot-action is-view">
                      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
                        <circle cx="12" cy="12" r="2.5" />
                      </svg>
                      {t('farms.view_details')}
                    </Link>
                    <button type="button" className="plot-action is-edit" onClick={(e) => openEditPlot(e, plot)}>
                      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
                        <path d="M13.5 5.5l3 3" />
                      </svg>
                      {t('common.edit')}
                    </button>
                    <button
                      type="button"
                      className="plot-action is-delete"
                      onClick={(e) => {
                        e.preventDefault();
                        setConfirmAction({ type: 'plot', plot });
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M5 7h14M10 11v6M14 11v6M9 7l1-2h4l1 2M8 7l1 12h6l1-12" />
                      </svg>
                      {t('common.delete')}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <button
        type="button"
        className="farms-link-card is-button"
        onClick={() => setComingSoon('crop_plan')}
      >
        <span className="farms-link-icon tone-purple" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="4" y="5" width="16" height="15" rx="2" />
            <path d="M8 3v4M16 3v4M4 10h16" />
          </svg>
        </span>
        <div>
          <strong>{t('farms.crop_plan')}</strong>
          <p>{t('farms.crop_plan_body')}</p>
        </div>
        <span className="farms-link-chevron" aria-hidden="true">›</span>
      </button>

      <button
        type="button"
        className="farms-link-card is-button is-report"
        onClick={() => setComingSoon('farm_report')}
      >
        <span className="farms-link-icon tone-amber" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 19V10M10 19V5M15 19v-7M20 19V8" />
          </svg>
        </span>
        <div>
          <strong>{t('farms.farm_report')}</strong>
          <p>{t('farms.farm_report_body')}</p>
        </div>
        <span className="farms-link-chevron" aria-hidden="true">›</span>
      </button>

      <div className="season-finance-section no-print" id="farm-finance">
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

      {coming_soon && (
        <Modal title={t(`farms.${coming_soon}_title`)} on_close={() => setComingSoon('')}>
          <p className="section-note" style={{ marginTop: 0 }}>{t('farms.coming_soon')}</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" onClick={() => setComingSoon('')}>
              {t('common.close')}
            </button>
          </div>
        </Modal>
      )}

      {show_plot_modal && (
        <Modal
          title={editing_plot ? t('farms.edit_plot') : t('farms.add_plot')}
          on_close={() => setShowPlotModal(false)}
          variant="sheet"
          footer={(
            <div className="modal-actions is-pinned">
              <button type="button" className="btn btn-secondary" onClick={() => setShowPlotModal(false)}>
                {t('farms.cancel')}
              </button>
              <button type="submit" form="plot-form" className="btn btn-primary" disabled={is_saving}>
                {is_saving ? t('common.loading') : t('farms.save')}
              </button>
            </div>
          )}
        >
          {error_message && <div className="error-banner">{error_message}</div>}
          <form id="plot-form" className="form-compact" onSubmit={handleSavePlot}>
            <div className="form-group">
              <label>{t('farms.plot_name')}</label>
              <input
                className="form-input"
                value={plot_form.name}
                onChange={(e) => setPlotForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="form-row">
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
          </form>
        </Modal>
      )}

      {show_farm_modal && (
        <Modal
          title={t('farms.edit_farm')}
          on_close={() => setShowFarmModal(false)}
          variant="sheet"
          footer={(
            <div className="modal-actions is-pinned">
              <button type="button" className="btn btn-secondary" onClick={() => setShowFarmModal(false)}>
                {t('farms.cancel')}
              </button>
              <button type="submit" form="edit-farm-form" className="btn btn-primary" disabled={is_saving}>
                {is_saving ? t('common.loading') : t('farms.save')}
              </button>
            </div>
          )}
        >
          {error_message && <div className="error-banner">{error_message}</div>}
          <form id="edit-farm-form" className="form-compact" onSubmit={handleSaveFarm}>
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
                  onChange={(e) => handleFarmStateChange(e.target.value)}
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
                <select
                  className="form-select"
                  value={farm_form.district}
                  disabled={!farm_form.state}
                  onChange={(e) => setFarmForm((p) => ({ ...p, district: e.target.value }))}
                >
                  <option value="">
                    {farm_form.state
                      ? t('profile.district_placeholder')
                      : t('profile.district_select_state')}
                  </option>
                  {has_custom_farm_district && (
                    <option value={farm_form.district}>{farm_form.district}</option>
                  )}
                  {farm_district_options.map((district) => (
                    <option key={district} value={district}>{district}</option>
                  ))}
                </select>
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
          </form>
        </Modal>
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
