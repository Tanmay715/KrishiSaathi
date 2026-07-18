import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createDiseaseScan,
  getDiseaseScans,
} from '../services/farm_service';
import LoadingState from './LoadingState';
import EmptyState from './EmptyState';
import { formatShortDate } from '../utils/format_date';

function DiseaseScanPanel({ farm_id, plot_id, crop_cycle_id, crop_name, default_open = false }) {
  const { t, i18n } = useTranslation();
  const [is_open, setIsOpen] = useState(default_open);
  const [scans, setScans] = useState([]);
  const [is_loading, setIsLoading] = useState(false);
  const [is_scanning, setIsScanning] = useState(false);
  const [error_message, setErrorMessage] = useState('');
  const [latest, setLatest] = useState(null);
  const [has_loaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!farm_id || !is_open || has_loaded) {
      return;
    }

    loadScans();
  }, [farm_id, is_open, has_loaded]);

  async function loadScans() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await getDiseaseScans(farm_id);
      let rows = response.data || [];
      if (plot_id) {
        rows = rows.filter((scan) => !scan.plot_id || scan.plot_id === plot_id);
      }
      setScans(rows);
      setLatest(rows[0] || null);
      setHasLoaded(true);
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsOpen(true);
    setIsScanning(true);
    setErrorMessage('');

    try {
      const form_data = new FormData();
      form_data.append('image', file);
      if (plot_id) {
        form_data.append('plot_id', plot_id);
      }
      if (crop_cycle_id) {
        form_data.append('crop_cycle_id', crop_cycle_id);
      }

      const response = await createDiseaseScan(farm_id, form_data);
      const scan = response.data;
      setLatest(scan);
      setScans((prev) => [scan, ...prev]);
      setHasLoaded(true);
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
    } finally {
      setIsScanning(false);
      event.target.value = '';
    }
  }

  const diagnosis = latest?.diagnosis_json;

  return (
    <section className="card disease-panel is-quick-action">
      <div className="quick-action-head">
        <div className="quick-action-copy">
          <h3>{t('disease.title')}</h3>
          {!is_open && (
            <p className="section-note is-one-line">
              {crop_name
                ? t('disease.collapsed_hint_crop', { crop: crop_name })
                : t('disease.collapsed_hint')}
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          aria-expanded={is_open}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          {is_open ? t('common.hide') : t('disease.check')}
        </button>
      </div>

      {is_open && (
        <div className="section-panel-body is-compact">
          <div className="quick-action-toolbar">
            <p className="section-note" style={{ margin: 0 }}>{t('disease.subtitle')}</p>
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
              {is_scanning ? t('disease.scanning') : t('disease.upload')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                hidden
                disabled={is_scanning}
                onChange={handleFileChange}
              />
            </label>
          </div>

          {error_message && <div className="error-banner">{error_message}</div>}

          <div className="info-banner disease-disclaimer">
            {t('disease.disclaimer')}
          </div>

          {is_scanning && <LoadingState label={t('disease.scanning')} />}

          {diagnosis && !is_scanning && (
            <div className="disease-result-card">
              <strong>{diagnosis.disease}</strong>
              <div className="reminder-meta">
                {t('disease.possible_match')} · {t('disease.confidence')}:{' '}
                {Math.round((diagnosis.confidence || 0) * 100)}%
              </div>
              <div className="disease-confidence-track">
                <div
                  className="disease-confidence-fill"
                  style={{ width: `${Math.round((diagnosis.confidence || 0) * 100)}%` }}
                />
              </div>
              <p>{diagnosis.explanation}</p>
              <h4>{t('disease.treatment')}</h4>
              <p>{diagnosis.treatment}</p>
              {diagnosis.products?.length > 0 && (
                <>
                  <h4>{t('disease.products')}</h4>
                  <p className="section-note">{t('disease.products_hint')}</p>
                  <ul>
                    {diagnosis.products.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </>
              )}
              <h4>{t('disease.prevention')}</h4>
              <p>{diagnosis.prevention}</p>
            </div>
          )}

          <h4 style={{ marginTop: 20 }}>{t('disease.history')}</h4>
          {is_loading ? (
            <LoadingState />
          ) : scans.length === 0 ? (
            <EmptyState message={t('disease.empty')} />
          ) : (
            <ul className="reminder-list">
              {scans.slice(0, 5).map((scan) => (
                <li key={scan.id} className="reminder-item">
                  <div>
                    <strong>{scan.diagnosis_json?.disease || '—'}</strong>
                    <div className="reminder-meta">
                      {formatShortDate(scan.created_at, i18n.language)}
                      {scan.confidence != null && ` · ${Math.round(Number(scan.confidence) * 100)}%`}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setLatest(scan)}
                  >
                    {t('common.view')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export default DiseaseScanPanel;
