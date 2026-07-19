import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMandiRates } from '../services/farm_service';

const DEFAULT_CROPS = ['Potato', 'Wheat', 'Onion'];

function formatRate(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '—';
  }

  return `₹${Number(value).toLocaleString('en-IN')}`;
}

function pickGlanceCrops(preferred_crops = []) {
  const preferred = preferred_crops
    .map((name) => String(name || '').trim())
    .filter(Boolean);
  const merged = [...new Set([...preferred, ...DEFAULT_CROPS])];
  return merged.slice(0, 3);
}

function MandiGlanceStrip({
  farm_id = null,
  preferred_crops = [],
  is_expanded = false,
  on_view_all,
}) {
  const { t } = useTranslation();
  const preferred_key = preferred_crops.join('|');
  const crops = useMemo(
    () => pickGlanceCrops(preferred_crops),
    [preferred_key],
  );
  const crops_key = crops.join('|');
  const [rows, setRows] = useState([]);
  const [place_label, setPlaceLabel] = useState('');
  const [is_loading, setIsLoading] = useState(true);
  const [has_error, setHasError] = useState(false);

  useEffect(() => {
    let is_cancelled = false;

    async function loadGlance() {
      setIsLoading(true);
      setHasError(false);

      try {
        const responses = await Promise.all(
          crops.map((crop) => getMandiRates({ crop, farm_id }).catch(() => null)),
        );

        if (is_cancelled) {
          return;
        }

        const next_rows = crops.map((crop, index) => {
          const payload = responses[index]?.data || null;
          const summary = payload?.summary;
          const modal = summary?.modal_median ?? summary?.modal_avg ?? null;

          return {
            crop,
            price: modal,
            change_label: '—',
            change_tone: 'flat',
          };
        });

        const located = responses.find((item) => item?.data?.farm)?.data?.farm;
        const place = located
          ? [located.district, located.state].filter(Boolean).join(', ')
          : '';

        setRows(next_rows);
        setPlaceLabel(place);
        setHasError(next_rows.every((row) => row.price == null));
      } catch (error) {
        console.error(error);
        if (!is_cancelled) {
          setRows([]);
          setHasError(true);
        }
      } finally {
        if (!is_cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadGlance();

    return () => {
      is_cancelled = true;
    };
  }, [farm_id, crops_key]);

  return (
    <div className="mandi-glance-strip">
      <div className="mandi-glance-head">
        <div>
          <p className="surface-kicker">{t('dashboard.market_insights')}</p>
          <h3 className="mandi-glance-title">{t('mandi.nearby_rates')}</h3>
          {place_label ? (
            <p className="mandi-glance-place">{place_label}</p>
          ) : (
            <p className="mandi-glance-place">{t('mandi.unit_note')}</p>
          )}
        </div>
        <button
          type="button"
          className="mandi-glance-cta"
          onClick={on_view_all}
        >
          {is_expanded ? t('common.hide') : t('mandi.view_all')}
          <span aria-hidden="true">{is_expanded ? '↑' : '→'}</span>
        </button>
      </div>

      {is_loading && (
        <p className="mandi-glance-status">{t('common.loading')}</p>
      )}

      {!is_loading && has_error && (
        <p className="mandi-glance-status">{t('mandi.glance_empty')}</p>
      )}

      {!is_loading && !has_error && (
        <ul className="mandi-price-list">
          {rows.map((row) => (
            <li key={row.crop} className="mandi-price-row">
              <span className="mandi-price-crop">{row.crop}</span>
              <span className="mandi-price-value">{formatRate(row.price)}</span>
              <span className={`mandi-price-change is-${row.change_tone}`}>
                {row.change_label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default MandiGlanceStrip;
