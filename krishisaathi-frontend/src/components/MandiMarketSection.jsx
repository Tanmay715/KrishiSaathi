import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMandiBoard } from '../services/farm_service';
import CropMark from './CropMark';
import Modal from './Modal';

const BOARD_CROPS = [
  'Potato', 'Wheat', 'Onion', 'Rice', 'Tomato', 'Mustard', 'Moong', 'Chana', 'Cotton',
];

function formatRate(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '—';
  }
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

function formatChange(change_pct) {
  if (change_pct == null || Number.isNaN(Number(change_pct))) {
    return null;
  }
  const value = Number(change_pct);
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function pickGlanceCrops(preferred_crops = [], board_rows = []) {
  const preferred = preferred_crops
    .map((name) => String(name || '').trim())
    .filter(Boolean);
  const board_names = board_rows.map((row) => row.crop);
  return [...new Set([...preferred, ...BOARD_CROPS, ...board_names])].slice(0, 3);
}

function ChangePill({ change_pct, label = null }) {
  const text = formatChange(change_pct);
  if (!text) {
    return null;
  }

  const tone = change_pct > 0 ? 'up' : change_pct < 0 ? 'down' : 'flat';
  const arrow = change_pct > 0 ? '↑' : change_pct < 0 ? '↓' : '→';

  return (
    <span className={`mandi-change-pill is-${tone}`}>
      {arrow} {text}{label ? ` ${label}` : ''}
    </span>
  );
}

function PriceSparkline({ points = [] }) {
  if (!points || points.length < 2) {
    return null;
  }

  const values = points.map((point) => point.modal);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const width = 280;
  const height = 88;
  const pad = 8;

  const coords = values.map((value, index) => {
    const x = pad + (index * (width - pad * 2)) / Math.max(values.length - 1, 1);
    const y = height - pad - ((value - min) / span) * (height - pad * 2);
    return `${x},${y}`;
  });

  const area = `M${coords[0]} L${coords.join(' L')} L${width - pad},${height - pad} L${pad},${height - pad} Z`;

  return (
    <svg className="mandi-sparkline" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={area} className="mandi-sparkline-fill" />
      <polyline points={coords.join(' ')} className="mandi-sparkline-line" />
      {coords.map((point, index) => {
        const [x, y] = point.split(',');
        return <circle key={`${points[index].date}-${index}`} cx={x} cy={y} r="3.2" />;
      })}
    </svg>
  );
}

function MandiMarketSection({ farm_id = null, preferred_crops = [] }) {
  const { t } = useTranslation();
  const preferred_key = preferred_crops.join('|');
  const [board, setBoard] = useState(null);
  const [is_loading, setIsLoading] = useState(true);
  const [has_error, setHasError] = useState(false);
  const [is_board_open, setIsBoardOpen] = useState(false);
  const [selected_crop, setSelectedCrop] = useState('Wheat');
  const [quantity, setQuantity] = useState('5');

  useEffect(() => {
    let is_cancelled = false;

    async function loadBoard() {
      setIsLoading(true);
      setHasError(false);

      try {
        const response = await getMandiBoard({
          farm_id,
          crops: BOARD_CROPS,
        });
        if (is_cancelled) {
          return;
        }

        const data = response.data || null;
        setBoard(data);
        const first_priced = data?.crops?.find((row) => row.modal != null);
        if (first_priced) {
          setSelectedCrop(first_priced.crop);
        }
      } catch (error) {
        console.error(error);
        if (!is_cancelled) {
          setBoard(null);
          setHasError(true);
        }
      } finally {
        if (!is_cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadBoard();
    return () => {
      is_cancelled = true;
    };
  }, [farm_id]);

  const crop_rows = board?.crops || [];
  const glance_names = useMemo(
    () => pickGlanceCrops(preferred_crops, crop_rows),
    [preferred_key, crop_rows.map((row) => row.crop).join('|')],
  );

  const glance_rows = glance_names
    .map((name) => crop_rows.find((row) => row.crop === name)
      || { crop: name, modal: null, change_pct: null })
    .filter(Boolean);

  const selected_row = crop_rows.find((row) => row.crop === selected_crop) || null;
  const modal_price = selected_row?.modal ?? null;
  const qty_value = Number(quantity || 0);
  const estimated_sale = modal_price != null && qty_value > 0
    ? Math.round(modal_price * qty_value)
    : null;
  const other_rows = crop_rows.filter((row) => row.crop !== selected_crop);
  const trend_points = selected_row?.trend || [];

  function openBoard(crop_name) {
    if (crop_name) {
      setSelectedCrop(crop_name);
    }
    setQuantity((prev) => (prev === '' ? '5' : prev));
    setIsBoardOpen(true);
  }

  function selectCrop(crop_name) {
    setSelectedCrop(crop_name);
  }

  function stepQuantity(delta) {
    setQuantity((prev) => {
      const next = Math.max(0, Math.round((Number(prev || 0) + delta) * 10) / 10);
      return String(next);
    });
  }

  return (
    <section className="field-secondary surface-panel is-muted mandi-market-section is-premium">
      <div className="mandi-glance-strip">
        <div className="mandi-glance-head is-stack">
          <p className="surface-kicker">{t('dashboard.market_insights')}</p>
          <h3 className="mandi-glance-title">{t('mandi.nearby_rates')}</h3>
          <p className="mandi-glance-place">
            {board?.place_label || t('mandi.unit_note')}
          </p>
        </div>

        {is_loading && (
          <p className="mandi-glance-status">{t('common.loading')}</p>
        )}

        {!is_loading && has_error && (
          <p className="mandi-glance-status">{t('mandi.glance_empty')}</p>
        )}

        {!is_loading && !has_error && (
          <>
            <ul className="mandi-price-list is-premium">
              {glance_rows.map((row, index) => (
                <li key={row.crop}>
                  <button
                    type="button"
                    className="mandi-price-row is-button is-premium"
                    style={{ animationDelay: `${index * 60}ms` }}
                    onClick={() => openBoard(row.crop)}
                  >
                    <span className="mandi-price-identity">
                      <CropMark crop={row.crop} size={44} shape="circle" />
                      <span className="mandi-price-crop">{row.crop}</span>
                    </span>
                    <span className="mandi-price-meta">
                      <span className="mandi-price-value">{formatRate(row.modal)}</span>
                      <ChangePill change_pct={row.change_pct} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              className="mandi-view-all-link"
              onClick={() => openBoard(selected_crop)}
            >
              {t('mandi.view_all_prices')}
              <span aria-hidden="true">›</span>
            </button>
          </>
        )}
      </div>

      {is_board_open && (
        <Modal
          title={t('mandi.board_title')}
          subtitle={board?.place_label || t('mandi.unit_note')}
          size="lg"
          variant="sheet"
          header_style="bar"
          close_label={t('mandi.back_to_dashboard')}
          on_close={() => setIsBoardOpen(false)}
        >
          <div className="mandi-board-sheet is-premium">
            <div className="mandi-crop-picker is-top">
              <div className="mandi-crop-scroller" role="list">
                {crop_rows.map((row) => {
                  const is_active = row.crop === selected_crop;
                  return (
                    <button
                      key={row.crop}
                      type="button"
                      role="listitem"
                      className={`mandi-crop-tile${is_active ? ' is-active' : ''}`}
                      onClick={() => selectCrop(row.crop)}
                    >
                      <CropMark crop={row.crop} size={40} shape="circle" />
                      <strong>{row.crop}</strong>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mandi-hero-card">
              <div className="mandi-hero-visual">
                <CropMark crop={selected_crop} size={86} shape="circle" />
              </div>
              <div className="mandi-hero-copy">
                <p className="mandi-hero-label">{t('mandi.today_rate')}</p>
                <strong className="mandi-hero-price">{formatRate(modal_price)}</strong>
                <span className="mandi-hero-unit">/ {t('mandi.quintal')}</span>
                {selected_row?.min != null && selected_row?.max != null && (
                  <p className="mandi-hero-range">
                    {t('mandi.range_line', {
                      min: formatRate(selected_row.min),
                      max: formatRate(selected_row.max),
                    })}
                  </p>
                )}
                <ChangePill
                  change_pct={selected_row?.change_pct}
                  label={t('mandi.from_yesterday')}
                />
              </div>
            </div>

            <div className="mandi-calc-card">
              <label htmlFor="mandi-board-qty">{t('mandi.quantity_label')}</label>
              <div className="mandi-stepper">
                <button type="button" onClick={() => stepQuantity(-1)} aria-label="-">−</button>
                <input
                  id="mandi-board-qty"
                  type="number"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
                <button type="button" onClick={() => stepQuantity(1)} aria-label="+">+</button>
              </div>
              {estimated_sale != null ? (
                <p className="mandi-calc-result">
                  {t('mandi.est_sale_math', {
                    qty: qty_value,
                    price: formatRate(modal_price),
                  })}
                  {' = '}
                  <strong>₹{estimated_sale.toLocaleString('en-IN')}</strong>
                </p>
              ) : (
                <p className="mandi-calc-idle">{t('mandi.est_sale_idle')}</p>
              )}
            </div>

            {other_rows.length > 0 && (
              <div className="mandi-other-block">
                <div className="mandi-crop-picker-head">
                  <strong>{t('mandi.other_crops')}</strong>
                  <span>{t('mandi.swipe_more')}</span>
                </div>
                <div className="mandi-crop-scroller" role="list">
                  {other_rows.map((row) => (
                    <button
                      key={row.crop}
                      type="button"
                      role="listitem"
                      className="mandi-mini-card"
                      onClick={() => selectCrop(row.crop)}
                    >
                      <CropMark crop={row.crop} size={34} shape="circle" />
                      <span>
                        <strong>{row.crop}</strong>
                        <em>{formatRate(row.modal)}</em>
                      </span>
                      <ChangePill change_pct={row.change_pct} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {trend_points.length >= 2 && (
              <div className="mandi-trend-card">
                <strong>{t('mandi.trend_title')}</strong>
                <PriceSparkline points={trend_points} />
                <div className="mandi-trend-labels">
                  <span>{trend_points[0]?.date?.slice(5)}</span>
                  <span>{trend_points[trend_points.length - 1]?.date?.slice(5)}</span>
                </div>
              </div>
            )}

            <p className="mandi-disclaimer-box">
              {selected_row?.source === 'reference'
                ? t('mandi.disclaimer_reference')
                : t('mandi.disclaimer')}
            </p>
          </div>
        </Modal>
      )}
    </section>
  );
}

export default MandiMarketSection;
