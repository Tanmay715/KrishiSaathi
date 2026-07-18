import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createFarm, deleteFarm, getFarms, updateFarm } from '../services/farm_service';
import { CACHE_KEYS, loadOfflineData, saveOfflineData } from '../utils/offline_store';
import { INDIAN_STATES } from '../config/indian_states';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { normalizeLanguage } from '../utils/language';

const EMPTY_FORM = {
  name: '',
  state: '',
  district: '',
  village: '',
  total_area: '',
  notes: '',
};

function FarmsPage() {
  const { t, i18n } = useTranslation();
  const [search_params, setSearchParams] = useSearchParams();
  const [farms, setFarms] = useState([]);
  const [is_loading, setIsLoading] = useState(true);
  const [show_modal, setShowModal] = useState(false);
  const [editing_farm, setEditingFarm] = useState(null);
  const [farm_to_delete, setFarmToDelete] = useState(null);
  const [is_saving, setIsSaving] = useState(false);
  const [is_deleting, setIsDeleting] = useState(false);
  const [error_message, setErrorMessage] = useState('');
  const [load_error, setLoadError] = useState('');
  const [is_cached_view, setIsCachedView] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const state_label_key = normalizeLanguage(i18n.resolvedLanguage || i18n.language) === 'hi'
    ? 'label_hi'
    : 'label_en';

  useEffect(() => {
    loadFarms();
  }, []);

  useEffect(() => {
    if (search_params.get('add') !== '1') {
      return;
    }

    setEditingFarm(null);
    setForm(EMPTY_FORM);
    setErrorMessage('');
    setShowModal(true);

    const next = new URLSearchParams(search_params);
    next.delete('add');
    setSearchParams(next, { replace: true });
  }, [search_params, setSearchParams]);

  async function loadFarms() {
    setIsLoading(true);
    setLoadError('');

    try {
      const response = await getFarms();
      const rows = response.data || [];
      setFarms(rows);
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
    setForm((prev) => ({ ...prev, [field]: value }));
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

  function openEditModal(event, farm) {
    event.preventDefault();
    event.stopPropagation();
    setEditingFarm(farm);
    setForm({
      name: farm.name || '',
      state: farm.state || '',
      district: farm.district || '',
      village: farm.village || '',
      total_area: farm.total_area != null ? String(farm.total_area) : '',
      notes: farm.notes || '',
    });
    setErrorMessage('');
    setShowModal(true);
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

  async function confirmDeleteFarm() {
    if (!farm_to_delete) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteFarm(farm_to_delete.id);
      setFarmToDelete(null);
      await loadFarms();
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
      setFarmToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  }

  if (is_loading) {
    return <LoadingState />;
  }

  if (load_error) {
    return <ErrorState message={load_error} on_retry={loadFarms} />;
  }

  const has_farms = farms.length > 0;

  return (
    <div>
      <PageHeader
        title={t('farms.title')}
        subtitle={t('farms.subtitle')}
        action={has_farms ? (
          <button type="button" className="btn btn-primary" onClick={openCreateModal}>
            {t('farms.add_farm')}
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
        <div className="farm-list">
          {farms.map((farm) => (
            <div key={farm.id} className="card farm-card">
              <Link to={`/farms/${farm.id}`} className="farm-card-link">
                <div className="farm-card-top">
                  <h3>{farm.name}</h3>
                  <span className="badge">{t('farms.manage_farm')} →</span>
                </div>
                <div className="farm-meta">
                  {farm.district && <span>{farm.district}</span>}
                  {farm.state && <span>{farm.state}</span>}
                  <span>{t('farms.plot_count', { count: farm.plot_count || 0 })}</span>
                  {farm.total_area > 0 && <span>{farm.total_area} {t('farms.area_unit')}</span>}
                </div>
              </Link>
              <div className="action-row">
                <button type="button" className="btn btn-secondary btn-sm" onClick={(e) => openEditModal(e, farm)}>
                  {t('common.edit')}
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setFarmToDelete(farm);
                  }}
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {show_modal && (
        <Modal
          title={editing_farm ? t('farms.edit_farm') : t('farms.add_farm')}
          on_close={closeModal}
        >
          {error_message && <div className="error-banner">{error_message}</div>}
          <form onSubmit={handleSaveFarm}>
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
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="farm-district">{t('farms.district')}</label>
                <input
                  id="farm-district"
                  className="form-input"
                  value={form.district}
                  onChange={(e) => updateForm('district', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="farm-village">{t('farms.village')}</label>
                <input
                  id="farm-village"
                  className="form-input"
                  value={form.village}
                  onChange={(e) => updateForm('village', e.target.value)}
                />
              </div>
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
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closeModal}>
                {t('farms.cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={is_saving}>
                {is_saving ? t('common.loading') : t('farms.save')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {farm_to_delete && (
        <ConfirmDialog
          title={t('common.delete')}
          message={t('farms.delete_confirm', { name: farm_to_delete.name })}
          confirm_label={t('common.delete')}
          is_danger
          is_loading={is_deleting}
          on_confirm={confirmDeleteFarm}
          on_cancel={() => setFarmToDelete(null)}
        />
      )}
    </div>
  );
}

export default FarmsPage;
