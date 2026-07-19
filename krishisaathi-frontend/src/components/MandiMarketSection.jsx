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

function pickGlanceCrops(preferred_crops = [], board_rows = []) {
  const preferred = preferred_crops
    .map((name) => String(name || '').trim())
    .filter(Boolean);
  const board_names = board_rows.map((row) => row.crop);
  return [...new Set([...preferred, ...BOARD_CROPS, ...board_names])].slice(0, 3);
}

function MandiMarketSection({ farm_id = null, preferred_crops = [] }) {
  const { t } = useTranslation();
  const preferred_key = preferred_crops.join('|');
  const [board, setBoard] = useState(null);
  const [is_loading, setIsLoading] = useState(true);
  const [has_error, setHasError] = useState(false);
  const [is_board_open, setIsBoardOpen] = useState(false);
  const [selected_crop, setSelectedCrop] = useState('Wheat');
  const [quantity, setQuantity] = useState('');

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
      || { crop: name, modal: null })
    .filter(Boolean);

  const selected_row = crop_rows.find((row) => row.crop === selected_crop) || null;
  const modal_price = selected_row?.modal ?? null;
  const qty_value = Number(quantity || 0);
  const estimated_sale = modal_price != null && qty_value > 0
    ? Math.round(modal_price * qty_value)
    : null;

  function openBoard(crop_name) {
    if (crop_name) {
      setSelectedCrop(crop_name);
    }
    setIsBoardOpen(true);
  }

  function selectCrop(crop_name) {
    setSelectedCrop(crop_name);
    setQuantity('');
  }

  return (
    <section className="field-secondary surface-panel is-muted mandi-market-section">
      <div className="mandi-glance-strip">
        <div className="mandi-glance-head">
          <div>
            <p className="surface-kicker">{t('dashboard.market_insights')}</p>
            <h3 className="mandi-glance-title">{t('mandi.nearby_rates')}</h3>
            <p className="mandi-glance-place">
              {board?.place_label || t('mandi.unit_note')}
            </p>
          </div>
          {!is_loading && !has_error && crop_rows.length > 0 && (
            <button
              type="button"
              className="mandi-glance-cta"
              onClick={() => openBoard(selected_crop)}
            >
              {t('mandi.view_all_count', { count: crop_rows.length })}
              <span aria-hidden="true">→</span>
            </button>
          )}
        </div>

        {is_loading && (
          <p className="mandi-glance-status">{t('common.loading')}</p>
        )}

        {!is_loading && has_error && (
          <p className="mandi-glance-status">{t('mandi.glance_empty')}</p>
        )}

        {!is_loading && !has_error && (
          <ul className="mandi-price-list">
            {glance_rows.map((row, index) => (
              <li key={row.crop}>
                <button
                  type="button"
                  className="mandi-price-row is-button"
                  style={{ animationDelay: `${index * 60}ms` }}
                  onClick={() => openBoard(row.crop)}
                >
                  <span className="mandi-price-identity">
                    <CropMark crop={row.crop} size={36} />
                    <span className="mandi-price-crop">{row.crop}</span>
                  </span>
                  <span className="mandi-price-value">{formatRate(row.modal)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {is_board_open && (
        <Modal
          title={t('mandi.board_title')}
          size="lg"
          variant="sheet"
          close_label={t('mandi.back_to_dashboard')}
          on_close={() => setIsBoardOpen(false)}
        >
          <div className="mandi-board-sheet">
            <p className="mandi-board-subtitle">
              {board?.place_label
                ? t('mandi.board_subtitle_place', { place: board.place_label })
                : t('mandi.board_subtitle')}
            </p>

            <div className="mandi-estimate-card is-lead">
              <div className="mandi-estimate-head">
                <CropMark crop={selected_crop} size={44} />
                <div>
                  <strong>{selected_crop}</strong>
                  <p>
                    {t('mandi.modal_rate_line', {
                      price: formatRate(modal_price),
                    })}
                  </p>
                  {selected_row?.min != null && selected_row?.max != null && (
                    <p className="mandi-range-line">
                      {t('mandi.range_line', {
                        min: formatRate(selected_row.min),
                        max: formatRate(selected_row.max),
                      })}
                    </p>
                  )}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 10 }}>
                <label htmlFor="mandi-board-qty">{t('mandi.quantity_label')}</label>
                <input
                  id="mandi-board-qty"
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  placeholder={t('mandi.quantity_placeholder')}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
                <p className="section-note" style={{ marginTop: 6 }}>
                  {t('mandi.quantity_hint')}
                </p>
              </div>

              {estimated_sale != null ? (
                <div className="mandi-estimate-result is-big">
                  <span>{t('mandi.est_sale')}</span>
                  <strong>₹{estimated_sale.toLocaleString('en-IN')}</strong>
                  <small>
                    {t('mandi.est_sale_math', {
                      qty: qty_value,
                      price: formatRate(modal_price),
                    })}
                  </small>
                </div>
              ) : (
                <div className="mandi-estimate-idle">
                  {t('mandi.est_sale_idle')}
                </div>
              )}
            </div>

            <div className="mandi-crop-picker">
              <div className="mandi-crop-picker-head">
                <strong>{t('mandi.pick_crop')}</strong>
                <span>{t('mandi.swipe_more')}</span>
              </div>
              <div className="mandi-crop-scroller" role="list">
                {crop_rows.map((row) => {
                  const is_active = row.crop === selected_crop;
                  return (
                    <button
                      key={row.crop}
                      type="button"
                      role="listitem"
                      className={`mandi-crop-chip${is_active ? ' is-active' : ''}`}
                      onClick={() => selectCrop(row.crop)}
                    >
                      <CropMark crop={row.crop} size={32} />
                      <span className="mandi-crop-chip-copy">
                        <strong>{row.crop}</strong>
                        <em>{formatRate(row.modal)}</em>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="section-note mandi-disclaimer">
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
