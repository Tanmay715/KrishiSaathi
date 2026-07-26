import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { INDIAN_STATES } from '../config/indian_states';
import { getDistrictsForState, normalizeDistrictOption } from '../config/indian_districts';
import { getMandiBoard } from '../services/farm_service';
import { normalizeLanguage } from '../utils/language';
import { localizeCropName, localizePlaceLabel } from '../utils/localize_names';
import CropMark from './CropMark';

const BOARD_CROPS = [
  'Potato', 'Wheat', 'Onion', 'Rice', 'Tomato', 'Mustard', 'Moong', 'Chana', 'Cotton',
];

const MANDI_LOCATION_SESSION_KEY = 'ks_mandi_location_override';

function readSessionOverride() {
  try {
    const raw = sessionStorage.getItem(MANDI_LOCATION_SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed?.state) {
      return null;
    }
    return {
      state: String(parsed.state),
      district: parsed.district ? String(parsed.district) : '',
      state_code: parsed.state_code || '',
    };
  } catch (_error) {
    return null;
  }
}

function writeSessionOverride(value) {
  try {
    if (!value) {
      sessionStorage.removeItem(MANDI_LOCATION_SESSION_KEY);
      return;
    }
    sessionStorage.setItem(MANDI_LOCATION_SESSION_KEY, JSON.stringify(value));
  } catch (_error) {
    // ignore
  }
}

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

function isUsefulLabel(value) {
  const text = String(value || '').trim();
  if (!text) {
    return false;
  }
  const lowered = text.toLowerCase();
  return lowered !== 'other' && lowered !== 'faq' && lowered !== '-' && lowered !== 'n/a';
}

function formatMarketMeta(market) {
  const parts = [];
  if (market.district) {
    parts.push(market.district);
  }
  if (isUsefulLabel(market.variety)) {
    parts.push(market.variety);
  } else if (isUsefulLabel(market.grade)) {
    parts.push(market.grade);
  }
  return parts.join(' · ');
}

function pickGlanceCrops(preferred_crops = [], board_rows = []) {
  const preferred = preferred_crops
    .map((name) => String(name || '').trim())
    .filter(Boolean);
  const board_names = board_rows.map((row) => row.crop);
  const ordered = [...new Set([...preferred, ...BOARD_CROPS, ...board_names])];
  const priced = new Set(
    board_rows
      .filter((row) => row.modal != null)
      .map((row) => row.crop),
  );
  // Show crops with live rates first so price + trend arrows are useful at a glance.
  return [
    ...ordered.filter((name) => priced.has(name)),
    ...ordered.filter((name) => !priced.has(name)),
  ].slice(0, 6);
}

function ChangePill({ change_pct, label = null, compact = false }) {
  const text = formatChange(change_pct);
  if (!text) {
    return null;
  }

  const tone = change_pct > 0 ? 'up' : change_pct < 0 ? 'down' : 'flat';
  const arrow = change_pct > 0 ? '↑' : change_pct < 0 ? '↓' : '→';

  return (
    <span className={`mandi-change-pill is-${tone}${compact ? ' is-compact' : ''}`}>
      <span className="mandi-change-arrow" aria-hidden="true">{arrow}</span>
      <span>{text}{label ? ` ${label}` : ''}</span>
    </span>
  );
}

function CropSquareContent({ crop, language, modal = null, change_pct = null, show_price = false }) {
  return (
    <>
      <CropMark crop={crop} size={show_price ? 34 : 36} shape="circle" />
      <strong>{localizeCropName(crop, language)}</strong>
      {show_price && (
        <span className="mandi-crop-square-price">{formatRate(modal)}</span>
      )}
      <ChangePill change_pct={change_pct} compact />
    </>
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

function MandiMarketsList({ markets = [], as_of = null, t }) {
  if (!markets.length) {
    return null;
  }

  return (
    <div className="mandi-markets-card">
      <div className="mandi-markets-head">
        <strong>{t('mandi.markets_title')}</strong>
        {as_of && (
          <span>{t('mandi.markets_as_of', { date: as_of })}</span>
        )}
      </div>
      <ul className="mandi-markets-list">
        {markets.map((market, index) => {
          const meta = formatMarketMeta(market);
          const key = `${market.market}-${market.district || ''}-${market.modal}-${index}`;
          return (
            <li key={key} className="mandi-markets-row">
              <div className="mandi-markets-identity">
                <strong>{market.market}</strong>
                {meta ? <span>{meta}</span> : null}
              </div>
              <div className="mandi-markets-price">
                <strong>{formatRate(market.modal)}</strong>
                {market.min != null && market.max != null && (
                  <span>
                    {formatRate(market.min)}–{formatRate(market.max)}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MandiBoardBody({
  board,
  crop_rows,
  selected_crop,
  selected_row,
  modal_price,
  quantity,
  qty_value,
  estimated_sale,
  trend_points,
  on_select_crop,
  on_quantity_change,
  on_step_quantity,
  t,
  language,
}) {
  const markets = selected_row?.markets || [];
  const place_label = localizePlaceLabel(board?.place, language, board?.place_label || '');

  return (
    <div className="mandi-board-sheet is-premium is-vertical">
      <p className="mandi-board-subtitle">
        {place_label
          ? t('mandi.board_subtitle_place', { place: place_label })
          : t('mandi.board_subtitle')}
      </p>

      <div className="mandi-crop-square-grid" role="list">
        {crop_rows.map((row) => {
          const is_active = row.crop === selected_crop;
          return (
            <button
              key={row.crop}
              type="button"
              role="listitem"
              className={`mandi-crop-square${is_active ? ' is-active' : ''}`}
              onClick={() => on_select_crop(row.crop)}
            >
              <CropSquareContent
                crop={row.crop}
                language={language}
                modal={row.modal}
                change_pct={row.change_pct}
                show_price
              />
            </button>
          );
        })}
      </div>

      <div className="mandi-hero-card">
        <div className="mandi-hero-visual">
          <CropMark crop={selected_crop} size={64} shape="circle" />
        </div>
        <div className="mandi-hero-copy">
          <p className="mandi-hero-label">{t('mandi.today_rate')}</p>
          <div className="mandi-hero-price-row">
            <strong className="mandi-hero-price">{formatRate(modal_price)}</strong>
            <span className="mandi-hero-unit">/ {t('mandi.quintal')}</span>
          </div>
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

      <MandiMarketsList
        markets={markets}
        as_of={selected_row?.as_of}
        t={t}
      />

      <div className="mandi-calc-card">
        <label htmlFor="mandi-board-qty">{t('mandi.quantity_label')}</label>
        <div className="mandi-stepper">
          <button type="button" onClick={() => on_step_quantity(-1)} aria-label="-">−</button>
          <input
            id="mandi-board-qty"
            type="number"
            min="0"
            step="0.1"
            inputMode="decimal"
            value={quantity}
            onChange={(event) => on_quantity_change(event.target.value)}
          />
          <button type="button" onClick={() => on_step_quantity(1)} aria-label="+">+</button>
        </div>
        {estimated_sale != null ? (
          <p className="mandi-calc-result">
            <span>
              {t('mandi.est_sale_math', {
                qty: qty_value,
                price: formatRate(modal_price),
              })}
            </span>
            <strong>₹{estimated_sale.toLocaleString('en-IN')}</strong>
          </p>
        ) : (
          <p className="mandi-calc-idle">{t('mandi.est_sale_idle')}</p>
        )}
      </div>

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
          : selected_row?.source === 'unavailable'
            ? t('mandi.disclaimer_unavailable')
            : selected_row?.place_scope === 'state'
              ? t('mandi.disclaimer_state')
              : t('mandi.disclaimer')}
      </p>
    </div>
  );
}

function MandiLocationPicker({
  draft,
  home_label,
  is_override,
  applied_label,
  on_change_state,
  on_change_district,
  on_apply,
  on_reset,
  t,
  state_label_key,
}) {
  const district_options = getDistrictsForState(draft.state_code);
  const has_custom_district = Boolean(
    draft.district && !district_options.includes(draft.district),
  );

  return (
    <div className={`mandi-location-card${is_override ? ' is-override' : ''}`}>
      <div className="mandi-location-head">
        <div>
          <p className="mandi-location-kicker">{t('mandi.location_showing')}</p>
          <strong>{applied_label || home_label || t('mandi.location_unknown')}</strong>
          {is_override ? (
            <span className="mandi-location-badge">{t('mandi.location_custom')}</span>
          ) : (
            <span className="mandi-location-badge is-home">{t('mandi.location_mine')}</span>
          )}
        </div>
        {is_override && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={on_reset}>
            {t('mandi.location_reset')}
          </button>
        )}
      </div>

      <p className="mandi-location-hint">{t('mandi.location_hint')}</p>

      <div className="mandi-location-form">
        <div className="form-group">
          <label htmlFor="mandi-state">{t('profile.state_label')}</label>
          <select
            id="mandi-state"
            className="form-select"
            value={draft.state_code}
            onChange={(event) => on_change_state(event.target.value)}
          >
            <option value="">{t('profile.state_placeholder')}</option>
            {INDIAN_STATES.map((state) => (
              <option key={state.code} value={state.code}>
                {state[state_label_key]}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="mandi-district">{t('profile.district_label')}</label>
          <select
            id="mandi-district"
            className="form-select"
            value={draft.district}
            disabled={!draft.state_code}
            onChange={(event) => on_change_district(event.target.value)}
          >
            <option value="">
              {draft.state_code
                ? t('profile.district_placeholder')
                : t('profile.district_select_state')}
            </option>
            {has_custom_district && (
              <option value={draft.district}>{draft.district}</option>
            )}
            {district_options.map((district) => (
              <option key={district} value={district}>{district}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!draft.state_code}
          onClick={on_apply}
        >
          {t('mandi.location_apply')}
        </button>
      </div>
    </div>
  );
}

function MandiMarketSection({
  farm_id = null,
  preferred_crops = [],
  layout = 'glance',
  initial_crop = null,
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const preferred_key = preferred_crops.join('|');
  const app_language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  const state_label_key = app_language === 'hi' ? 'label_hi' : 'label_en';

  const [board, setBoard] = useState(null);
  const [is_loading, setIsLoading] = useState(true);
  const [has_error, setHasError] = useState(false);
  const [selected_crop, setSelectedCrop] = useState(initial_crop || 'Wheat');
  const [quantity, setQuantity] = useState('5');
  const [location_tick, setLocationTick] = useState(0);
  const [override, setOverride] = useState(() => (
    layout === 'page' ? readSessionOverride() : null
  ));
  const [draft, setDraft] = useState(() => {
    const saved = layout === 'page' ? readSessionOverride() : null;
    return {
      state_code: saved?.state_code || '',
      district: saved?.district || '',
    };
  });

  useEffect(() => {
    function onLocationUpdated() {
      setLocationTick((prev) => prev + 1);
    }
    window.addEventListener('ks-location-updated', onLocationUpdated);
    return () => window.removeEventListener('ks-location-updated', onLocationUpdated);
  }, []);

  useEffect(() => {
    let is_cancelled = false;

    async function loadBoard() {
      setIsLoading(true);
      setHasError(false);

      try {
        const response = await getMandiBoard({
          farm_id: override ? undefined : farm_id,
          state: override?.state || undefined,
          district: override?.district || undefined,
          crops: BOARD_CROPS,
        });
        if (is_cancelled) {
          return;
        }

        const data = response.data || null;
        setBoard(data);
        const preferred = initial_crop
          && data?.crops?.find((row) => row.crop === initial_crop);
        const first_live = data?.crops?.find((row) => (
          row.source === 'agmarknet' && row.modal != null
        ));
        const first_priced = preferred || first_live || data?.crops?.find((row) => row.modal != null);
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
  }, [farm_id, initial_crop, location_tick, override?.state, override?.district]);

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
  const trend_points = selected_row?.trend || [];
  const is_override = Boolean(override?.state);
  const applied_label = localizePlaceLabel(board?.place, app_language, board?.place_label || '') || null;

  function openMarket(crop_name) {
    const params = crop_name ? `?crop=${encodeURIComponent(crop_name)}` : '';
    navigate(`/market${params}`);
  }

  function stepQuantity(delta) {
    setQuantity((prev) => {
      const next = Math.max(0, Math.round((Number(prev || 0) + delta) * 10) / 10);
      return String(next);
    });
  }

  function handleDraftState(state_code) {
    setDraft({
      state_code,
      district: normalizeDistrictOption(state_code, ''),
    });
  }

  function handleApplyLocation() {
    const state = INDIAN_STATES.find((item) => item.code === draft.state_code);
    if (!state) {
      return;
    }
    const next = {
      state: state.label_en,
      district: draft.district || '',
      state_code: draft.state_code,
    };
    writeSessionOverride(next);
    setOverride(next);
  }

  function handleResetLocation() {
    writeSessionOverride(null);
    setOverride(null);
    setDraft({ state_code: '', district: '' });
  }

  const board_props = {
    board,
    crop_rows,
    selected_crop,
    selected_row,
    modal_price,
    quantity,
    qty_value,
    estimated_sale,
    trend_points,
    on_select_crop: setSelectedCrop,
    on_quantity_change: setQuantity,
    on_step_quantity: stepQuantity,
    t,
    language: app_language,
  };

  if (layout === 'page') {
    return (
      <section className="mandi-market-page">
        <MandiLocationPicker
          draft={draft}
          home_label={null}
          is_override={is_override}
          applied_label={applied_label}
          on_change_state={handleDraftState}
          on_change_district={(district) => setDraft((prev) => ({ ...prev, district }))}
          on_apply={handleApplyLocation}
          on_reset={handleResetLocation}
          t={t}
          state_label_key={state_label_key}
        />
        {is_loading && <p className="mandi-glance-status">{t('common.loading')}</p>}
        {!is_loading && has_error && (
          <p className="mandi-glance-status">{t('mandi.glance_empty')}</p>
        )}
        {!is_loading && !has_error && <MandiBoardBody {...board_props} />}
      </section>
    );
  }

  return (
    <section className="home-section mandi-market-section">
      <div className="home-section-head">
        <h3 className="home-section-title">{t('mandi.nearby_rates')}</h3>
        {!is_loading && !has_error && crop_rows.length > 0 && (
          <Link to="/market" className="home-section-link">
            {t('mandi.view_all_count', { count: crop_rows.length })} →
          </Link>
        )}
      </div>

      <div className="mandi-glance-strip">
        <p className="mandi-glance-place">
          {[applied_label, t('mandi.unit_note')].filter(Boolean).join(' · ')}
        </p>

        {is_loading && (
          <p className="mandi-glance-status">{t('common.loading')}</p>
        )}

        {!is_loading && has_error && (
          <p className="mandi-glance-status">{t('mandi.glance_empty')}</p>
        )}

        {!is_loading && !has_error && (
          <div className="mandi-glance-square-grid">
            {glance_rows.map((row, index) => (
              <button
                key={row.crop}
                type="button"
                className="mandi-crop-square is-glance"
                style={{ animationDelay: `${index * 60}ms` }}
                onClick={() => openMarket(row.crop)}
              >
                <CropSquareContent
                  crop={row.crop}
                  language={app_language}
                  modal={row.modal}
                  change_pct={row.change_pct}
                  show_price
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default MandiMarketSection;
