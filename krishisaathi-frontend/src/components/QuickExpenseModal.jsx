import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildExpensePayload } from '../config/expense_form_helpers';
import { createExpense, getQuickLogTargets, parseExpenseTranscript } from '../services/farm_service';
import { enqueueOfflineExpense, getOfflineExpenseCount } from '../utils/offline_expense_queue';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import VoiceMicButton from './VoiceMicButton';
import LoadingState from './LoadingState';
import Modal from './Modal';

const QUICK_CATEGORIES = ['fertilizer', 'seed', 'labor', 'pesticide', 'irrigation', 'transport', 'other'];

function formatTargetLabel(target, t) {
  if (target.target_type === 'crop') {
    return `${target.farm_name} · ${target.plot_name} · ${target.crop_name}`;
  }

  if (target.target_type === 'plot') {
    return `${target.farm_name} · ${target.plot_name} · ${t('quick_log.no_crop_link')}`;
  }

  return `${target.farm_name} · ${t('quick_log.farm_only')}`;
}

function QuickExpenseModal({ is_open, on_close, on_saved }) {
  const { t, i18n } = useTranslation();
  const is_online = useOnlineStatus();
  const [targets, setTargets] = useState([]);
  const [target_key, setTargetKey] = useState('');
  const [category, setCategory] = useState('fertilizer');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [expense_date, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [transcript, setTranscript] = useState('');
  const [is_loading, setIsLoading] = useState(false);
  const [is_parsing, setIsParsing] = useState(false);
  const [is_saving, setIsSaving] = useState(false);
  const [error_message, setErrorMessage] = useState('');
  const [info_message, setInfoMessage] = useState('');

  useEffect(() => {
    if (!is_open) {
      return;
    }

    setCategory('fertilizer');
    setTitle('');
    setAmount('');
    setQuantity('');
    setUnit('');
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setTranscript('');
    setErrorMessage('');
    setInfoMessage(
      !is_online
        ? t('quick_log.offline_queue_hint', { count: getOfflineExpenseCount() })
        : '',
    );
    loadTargets();
  }, [is_open]);

  async function loadTargets() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await getQuickLogTargets();
      const rows = response.data || [];
      setTargets(rows);
      const preferred = rows.find((row) => row.target_type === 'crop') || rows[0];
      setTargetKey(preferred?.target_key || '');
    } catch (error) {
      if (!is_online) {
        setErrorMessage(t('quick_log.offline_need_targets'));
      } else {
        setErrorMessage(error.response?.data?.message || t('common.error'));
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTranscript(text) {
    setTranscript(text);
    const target = targets.find((item) => item.target_key === target_key);

    if (!target || !is_online) {
      setInfoMessage(t('voice.transcript_only'));
      return;
    }

    setIsParsing(true);
    setErrorMessage('');

    try {
      const response = await parseExpenseTranscript(target.farm_id, {
        transcript: text,
        plot_id: target.plot_id,
        crop_cycle_id: target.crop_cycle_id,
      });
      const draft = response.data || {};
      if (draft.category) {
        setCategory(draft.category);
      }
      if (draft.title) {
        setTitle(draft.title);
      }
      if (draft.amount != null) {
        setAmount(String(draft.amount));
      }
      if (draft.quantity != null) {
        setQuantity(String(draft.quantity));
      }
      if (draft.unit) {
        setUnit(draft.unit);
      }
      if (draft.expense_date) {
        setExpenseDate(String(draft.expense_date).slice(0, 10));
      }
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('voice.parse_failed'));
    } finally {
      setIsParsing(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const target = targets.find((item) => item.target_key === target_key);
    if (!target) {
      setErrorMessage(t('quick_log.no_farm'));
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    const expense_form = {
      category,
      title: title || t(`expenses.category.${category}`),
      amount,
      quantity,
      unit,
      expense_date,
      notes: transcript ? `Voice: ${transcript}` : '',
    };

    const payload = buildExpensePayload(
      expense_form,
      target.plot_id,
      target.crop_cycle_id,
    );

    try {
      if (!is_online) {
        enqueueOfflineExpense({ farm_id: target.farm_id, payload });
        setInfoMessage(t('quick_log.saved_offline'));
        on_saved?.({ offline: true });
        on_close();
        return;
      }

      await createExpense(target.farm_id, payload);
      on_saved?.({ offline: false });
      on_close();
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  if (!is_open) {
    return null;
  }

  const selected = targets.find((item) => item.target_key === target_key);

  return (
    <Modal
      title={t('quick_log.title')}
      subtitle={t('quick_log.subtitle')}
      on_close={on_close}
      footer={!is_loading && targets.length > 0 ? (
        <div className="modal-actions is-pinned">
          <button type="button" className="btn btn-secondary" onClick={on_close}>
            {t('farms.cancel')}
          </button>
          <button type="submit" form="quick-expense-form" className="btn btn-primary" disabled={is_saving || is_parsing}>
            {is_saving
              ? t('common.loading')
              : (!is_online ? t('quick_log.save_offline') : t('quick_log.save'))}
          </button>
        </div>
      ) : null}
    >
      {error_message && <div className="error-banner">{error_message}</div>}
      {info_message && <div className="info-banner">{info_message}</div>}

      {is_loading ? (
        <LoadingState />
      ) : !targets.length ? (
        <div className="sheet-section">
          <p style={{ margin: 0 }}>{t('quick_log.no_farm')}</p>
        </div>
      ) : (
        <form id="quick-expense-form" className="sheet-form" onSubmit={handleSubmit}>
          <section className="sheet-section">
            <p className="sheet-section-label">{t('common.sheet_where')}</p>
            <div className="form-group">
              <label>{t('quick_log.where')}</label>
              <select
                className="form-select"
                value={target_key}
                onChange={(event) => setTargetKey(event.target.value)}
              >
                {targets.map((target) => (
                  <option key={target.target_key} value={target.target_key}>
                    {formatTargetLabel(target, t)}
                  </option>
                ))}
              </select>
            </div>
            {selected?.crop_name && (
              <p className="quick-log-context" style={{ margin: 0 }}>
                {t('quick_log.for_crop', { crop: selected.crop_name })}
              </p>
            )}
            {selected && !selected.crop_name && (
              <p className="quick-log-context" style={{ margin: 0 }}>{t('quick_log.optional_crop_hint')}</p>
            )}
          </section>

          <section className="sheet-section">
            <p className="sheet-section-label">{t('common.sheet_voice')}</p>
            <div className="form-group voice-entry">
              <VoiceMicButton
                lang={i18n.language}
                on_transcript={handleTranscript}
                on_error={setErrorMessage}
                disabled={is_parsing || is_saving}
              />
              {transcript && (
                <p className="voice-transcript">“{transcript}”</p>
              )}
              {is_parsing && <p className="section-note">{t('voice.parsing')}</p>}
            </div>
          </section>

          <section className="sheet-section">
            <p className="sheet-section-label">{t('common.sheet_category')}</p>
            <div className="choice-chips" role="listbox" aria-label={t('expenses.category_label')}>
              {QUICK_CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="option"
                  aria-selected={category === item}
                  className={`choice-chip ${category === item ? 'is-active' : ''}`}
                  onClick={() => setCategory(item)}
                >
                  {t(`expenses.category.${item}`)}
                </button>
              ))}
            </div>
            <div className="form-group">
              <label>{t('expenses.title_label')}</label>
              <input
                className="form-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t(`expenses.category.${category}`)}
              />
            </div>
          </section>

          <section className="sheet-section">
            <p className="sheet-section-label">{t('common.sheet_amount')}</p>
            <div className="form-row">
              <div className="form-group">
                <label>{t('expenses.amount')}</label>
                <input
                  className="form-input quick-log-amount"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="500"
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('expenses.date')}</label>
                <input
                  className="form-input"
                  type="date"
                  value={expense_date}
                  onChange={(event) => setExpenseDate(event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>{t('expenses.quantity')}</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </div>
              <div className="form-group">
                <label>{t('expenses.unit')}</label>
                <input
                  className="form-input"
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                  placeholder="bags"
                />
              </div>
            </div>
          </section>
        </form>
      )}
    </Modal>
  );
}

export default QuickExpenseModal;
