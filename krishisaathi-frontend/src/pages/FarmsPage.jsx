import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createFarm, getExpenseSummary, getFarms, getIncomeSummary, updateFarm } from '../services/farm_service';
import { CACHE_KEYS, loadOfflineData, saveOfflineData } from '../utils/offline_store';
import { INDIAN_STATES } from '../config/indian_states';
import { getDistrictsForState, normalizeDistrictOption } from '../config/indian_districts';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { normalizeLanguage } from '../utils/language';
import { formatArea } from '../utils/format_date';
import { onDataChanged } from '../utils/app_events';

const EMPTY_FORM = {
  name: '',
  state: '',
  district: '',
  village: '',
  total_area: '',
  notes: '',
};

function formatAmount(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

function FarmsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search_params, setSearchParams] = useSearchParams();
  const [farms, setFarms] = useState([]);
  const [spent, setSpent] = useState(0);
  const [earned, setEarned] = useState(0);
  const [is_loading, setIsLoading] = useState(true);
  const [show_modal, setShowModal] = useState(false);
  const [editing_farm, setEditingFarm] = useState(null);
  const [is_saving, setIsSaving] = useState(false);
  const [error_message, setErrorMessage] = useState('');
  const [load_error, setLoadError] = useState('');
  const [is_cached_view, setIsCachedView] = useState(false);
  const [coming_soon, setComingSoon] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const state_label_key = normalizeLanguage(i18n.resolvedLanguage || i18n.language) === 'hi'
    ? 'label_hi'
    : 'label_en';
  const farm_district_options = getDistrictsForState(form.state);
  const has_custom_farm_district = Boolean(
    form.district && !farm_district_options.includes(form.district),
  );
  const land_unit = t(`common.${user?.preferred_land_unit || 'acre'}`);

  useEffect(() => {
    loadFarms();
  }, []);

  useEffect(() => onDataChanged((detail) => {
    if (['create_farm', 'create_plot', 'expense', 'income'].includes(detail.intent)) {
      loadFarms();
    }
  }), []);

  useEffect(() => {
    if (search_params.get('add') !== '1') {
      return;
    }

    openCreateModal();
    const next = new URLSearchParams(search_params);
    next.delete('add');
    setSearchParams(next, { replace: true });
  }, [search_params, setSearchParams]);

  async function loadFarms() {
    setIsLoading(true);
    setLoadError('');

    try {
      const [farms_response, expense_response, income_response] = await Promise.all([
        getFarms(),
        getExpenseSummary(),
        getIncomeSummary(),
      ]);
      const rows = farms_response.data || [];
      setFarms(rows);
      setSpent(Number(expense_response.data?.total_spent || 0));
      setEarned(Number(income_response.data?.total_earned || 0));
      setIsCachedView(false);
      saveOfflineData(CACHE_KEYS.farms, rows);
    } catch (error) {
      const cached = loadOfflineData(CACHE_KEYS.farms);
      if (cached) {
        setFarms(cached);
        setIsCachedView(true);
        setLoadError('');
      } else {
        setLoadError(error.response?.data?.message || t('common.error'));
      }
    } finally {
      setIsLoading(false);
    }
  }

  function updateForm(field, value) {
    setForm((prev) => {
      if (field !== 'state') {
        return { ...prev, [field]: value };
      }

      const next_district = normalizeDistrictOption(value, prev.district);
      const options = getDistrictsForState(value);
      return {
        ...prev,
        state: value,
        district: options.includes(next_district) ? next_district : '',
      };
    });
  }

  function openCreateModal() {
    setEditingFarm(null);
    setForm(EMPTY_FORM);
    setErrorMessage('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingFarm(null);
    setErrorMessage('');
  }

  function handleAddPlotQuick() {
    if (!farms.length) {
      openCreateModal();
      return;
    }
    navigate(`/farms/${farms[0].id}?add_plot=1`);
  }

  async function handleSaveFarm(event) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage('');

    const payload = {
      ...form,
      total_area: form.total_area ? Number(form.total_area) : 0,
    };

    try {
      if (editing_farm) {
        await updateFarm(editing_farm.id, payload);
      } else {
        await createFarm(payload);
      }
      closeModal();
      setForm(EMPTY_FORM);
      await loadFarms();
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  const totals = useMemo(() => {
    const area = farms.reduce((sum, farm) => sum + Number(farm.total_area || 0), 0);
    const plots = farms.reduce((sum, farm) => sum + Number(farm.plot_count || 0), 0);
    return { area, plots, count: farms.length };
  }, [farms]);

  if (is_loading) {
    return <LoadingState />;
  }

  if (load_error) {
    return <ErrorState message={load_error} on_retry={loadFarms} />;
  }

  const has_farms = farms.length > 0;

  return (
    <div className="farms-hub page-stack">
      <PageHeader
        title={t('farms.title')}
        subtitle={t('farms.subtitle')}
        action={has_farms ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreateModal}>
            + {t('farms.add_farm')}
          </button>
        ) : null}
      />

      {is_cached_view && (
        <div className="info-banner">{t('pwa.cached_data')}</div>
      )}

      {error_message && !show_modal && <div className="error-banner">{error_message}</div>}

      {!has_farms ? (
        <EmptyState
          title={t('farms.no_farms')}
          message={t('farms.create_first')}
          action={(
            <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={openCreateModal}>
              {t('farms.add_farm')}
            </button>
          )}
        />
      ) : (
        <>
          <section className="farms-hub-section">
            <div className="farm-detail-stats">
              <div className="farm-detail-stat">
                <span>{t('farms.summary_farms')}</span>
                <strong>{totals.count}</strong>
                <small>{t('farms.summary_active')}</small>
              </div>
              <div className="farm-detail-stat">
                <span>{t('farms.summary_area')}</span>
                <strong>{formatArea(totals.area)}</strong>
                <small>{land_unit}</small>
              </div>
              <div className="farm-detail-stat">
                <span>{t('farms.summary_spent')}</span>
                <strong>₹{formatAmount(spent)}</strong>
                <small>{t('farms.summary_estimated')}</small>
              </div>
              <div className="farm-detail-stat">
                <span>{t('farms.summary_income')}</span>
                <strong>₹{formatAmount(earned)}</strong>
                <small>{t('farms.summary_estimated')}</small>
              </div>
            </div>
          </section>

          <div className="farms-hub-list">
            {farms.map((farm) => (
              <Link key={farm.id} to={`/farms/${farm.id}`} className="farm-hub-card is-link">
                <div className="farm-hub-card-main">
                  <span className="farm-hub-mark" aria-hidden="true">
                    {(farm.name || '?').trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="farm-hub-card-copy">
                    <h3>{farm.name}</h3>
                    {(farm.village || farm.district || farm.state) && (
                      <p>
                        {[farm.village, farm.district, farm.state].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <span className="farm-hub-chevron" aria-hidden="true">›</span>
                </div>
                <div className="farm-hub-chips">
                  <span>{t('farms.plot_count', { count: farm.plot_count || 0 })}</span>
                  {Number(farm.total_area) > 0 && (
                    <span>
                      {formatArea(farm.total_area)} {land_unit}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          <section className="farms-hub-section">
            <h3 className="farms-hub-section-title">{t('farms.quick_title')}</h3>
            <div className="farms-quick-grid">
              <button type="button" className="farms-quick-tile tone-green" onClick={openCreateModal}>
                <span aria-hidden="true">＋</span>
                {t('farms.add_farm')}
              </button>
              <button type="button" className="farms-quick-tile tone-blue" onClick={handleAddPlotQuick}>
                <span aria-hidden="true">▤</span>
                {t('farms.add_plot')}
              </button>
              <button
                type="button"
                className="farms-quick-tile tone-purple"
                onClick={() => setComingSoon('crop_plan')}
              >
                <span aria-hidden="true">▤</span>
                {t('farms.crop_plan')}
              </button>
              <Link to="/money?add=expense" className="farms-quick-tile tone-orange">
                <span aria-hidden="true">₹</span>
                {t('farms.log_expense')}
              </Link>
            </div>
          </section>

          <Link to="/market" className="farms-link-card">
            <span className="farms-link-icon tone-green" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M4 8.5 6.2 4.8h11.6L20 8.5v1.2a2.3 2.3 0 0 1-4.6 0 2.3 2.3 0 0 1-4.6 0 2.3 2.3 0 1 1-4.6 0 2.3 2.3 0 0 1-2.2-1.2V8.5z" />
                <path d="M6.2 11.8h11.6V19a1.2 1.2 0 0 1-1.2 1.2H7.4A1.2 1.2 0 0 1 6.2 19v-7.2z" />
              </svg>
            </span>
            <div>
              <strong>{t('farms.mandi_hint_title')}</strong>
              <p>{t('farms.mandi_hint_body')}</p>
            </div>
            <span className="farms-link-chevron" aria-hidden="true">›</span>
          </Link>

          <button
            type="button"
            className="farms-link-card is-button"
            onClick={() => setComingSoon('tip')}
          >
            <span className="farms-link-icon tone-amber" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 18h6M10 21h4" />
                <path d="M12 3a6 6 0 0 1 3.6 10.8c-.7.5-1.1 1.2-1.2 2H9.6c-.1-.8-.5-1.5-1.2-2A6 6 0 0 1 12 3z" />
              </svg>
            </span>
            <div>
              <strong>{t('farms.tip_title')}</strong>
              <p>{t('farms.tip_body')}</p>
            </div>
            <span className="farms-link-chevron" aria-hidden="true">›</span>
          </button>
        </>
      )}

      {show_modal && (
        <Modal
          title={editing_farm ? t('farms.edit_farm') : t('farms.add_farm')}
          on_close={closeModal}
          footer={(
            <div className="modal-actions is-pinned">
              <button type="button" className="btn btn-secondary" onClick={closeModal}>
                {t('farms.cancel')}
              </button>
              <button type="submit" form="farm-form" className="btn btn-primary" disabled={is_saving}>
                {is_saving ? t('common.loading') : t('farms.save')}
              </button>
            </div>
          )}
        >
          {error_message && <div className="error-banner">{error_message}</div>}
          <form id="farm-form" className="sheet-form" onSubmit={handleSaveFarm}>
            <section className="sheet-section">
              <p className="sheet-section-label">{t('common.sheet_basics')}</p>
              <div className="form-group">
                <label htmlFor="farm-name">{t('farms.name')}</label>
                <input
                  id="farm-name"
                  className="form-input"
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </section>

            <section className="sheet-section">
              <p className="sheet-section-label">{t('common.sheet_location')}</p>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="farm-state">{t('farms.state')}</label>
                  <select
                    id="farm-state"
                    className="form-select"
                    value={form.state}
                    onChange={(e) => updateForm('state', e.target.value)}
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
                  <label htmlFor="farm-district">{t('farms.district')}</label>
                  <select
                    id="farm-district"
                    className="form-select"
                    value={form.district}
                    disabled={!form.state}
                    onChange={(e) => updateForm('district', e.target.value)}
                  >
                    <option value="">
                      {form.state ? t('profile.district_placeholder') : t('profile.district_select_state')}
                    </option>
                    {has_custom_farm_district && (
                      <option value={form.district}>{form.district}</option>
                    )}
                    {farm_district_options.map((district) => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="farm-village">{t('farms.village')}</label>
                  <input
                    id="farm-village"
                    className="form-input"
                    value={form.village}
                    onChange={(e) => updateForm('village', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="farm-area">{t('farms.total_area')}</label>
                  <input
                    id="farm-area"
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.total_area}
                    onChange={(e) => updateForm('total_area', e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="sheet-section">
              <p className="sheet-section-label">{t('common.sheet_optional')}</p>
              <div className="form-group">
                <label htmlFor="farm-notes">{t('farms.notes')}</label>
                <textarea
                  id="farm-notes"
                  className="form-textarea"
                  value={form.notes}
                  onChange={(e) => updateForm('notes', e.target.value)}
                  rows={3}
                />
              </div>
            </section>
          </form>
        </Modal>
      )}

      {coming_soon && (
        <Modal
          title={t(`farms.${coming_soon}_title`)}
          on_close={() => setComingSoon('')}
          footer={(
            <div className="modal-actions is-pinned">
              <button type="button" className="btn btn-primary" onClick={() => setComingSoon('')}>
                {t('common.close')}
              </button>
            </div>
          )}
        >
          <div className="sheet-section">
            <p className="section-note" style={{ margin: 0 }}>{t('farms.coming_soon')}</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default FarmsPage;
