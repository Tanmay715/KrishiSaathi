import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createReminder,
  generateReminders,
  getReminders,
  updateReminder,
} from '../services/farm_service';
import LoadingState from './LoadingState';
import EmptyState from './EmptyState';
import Modal from './Modal';
import OverflowMenu from './OverflowMenu';
import ReminderList from './ReminderList';

const REMINDER_TYPES = ['irrigation', 'fertilizer', 'pesticide', 'harvest', 'weather', 'custom'];

function RemindersPanel({ farm_id = null, compact = false, default_open = false }) {
  const { t } = useTranslation();
  const [is_open, setIsOpen] = useState(default_open);
  const [show_all, setShowAll] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [is_loading, setIsLoading] = useState(true);
  const [is_working, setIsWorking] = useState(false);
  const [show_modal, setShowModal] = useState(false);
  const [error_message, setErrorMessage] = useState('');
  const [form, setForm] = useState({
    title: '',
    type: 'custom',
    due_at: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    loadReminders();
  }, [farm_id]);

  async function loadReminders() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await getReminders({ farm_id, status: 'pending' });
      setReminders(response.data || []);
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGenerate() {
    setIsWorking(true);
    setErrorMessage('');
    setIsOpen(true);

    try {
      const response = await generateReminders();
      const rows = response.data || [];
      setReminders(farm_id ? rows.filter((item) => item.farm_id === farm_id) : rows);
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleStatus(reminder_id, status) {
    try {
      await updateReminder(reminder_id, { status });
      setReminders((prev) => prev.filter((item) => item.id !== reminder_id));
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    setIsWorking(true);
    setErrorMessage('');

    try {
      await createReminder({
        farm_id: farm_id || null,
        type: form.type,
        title: form.title,
        due_at: new Date(`${form.due_at}T09:00:00`).toISOString(),
      });
      setShowModal(false);
      setForm({
        title: '',
        type: 'custom',
        due_at: new Date().toISOString().slice(0, 10),
      });
      setIsOpen(true);
      await loadReminders();
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
    } finally {
      setIsWorking(false);
    }
  }

  const preview_limit = compact ? 3 : 20;
  const hidden_count = Math.max(0, reminders.length - preview_limit);

  const soon = reminders.filter((item) => {
    const due = new Date(item.due_at).getTime();
    return due <= Date.now() + 3 * 24 * 60 * 60 * 1000;
  });

  const collapsed_hint = soon.length > 0
    ? t('reminders.pending_count', { count: soon.length })
    : reminders.length > 0
      ? t('reminders.collapsed_hint_count', { count: reminders.length })
      : t('reminders.collapsed_hint');

  return (
    <section className="reminders-panel surface-quiet">
      <button
        type="button"
        className="section-toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={is_open}
      >
        <div>
          <h3 style={{ margin: 0 }}>{t('reminders.title')}</h3>
          <p className="section-note" style={{ margin: '4px 0 0' }}>{collapsed_hint}</p>
        </div>
        <span className="chevron-badge">{is_open ? '▾' : '▸'}</span>
      </button>

      {is_open && (
        <div className="section-panel-body">
          <div className="page-header-row" style={{ marginBottom: 10 }}>
            {!compact && (
              <p className="section-note" style={{ margin: 0 }}>{t('reminders.subtitle')}</p>
            )}
            <div style={{ marginLeft: 'auto' }}>
              <OverflowMenu
                label={t('common.more')}
                quiet
                items={[
                  {
                    id: 'generate',
                    label: t('reminders.generate'),
                    disabled: is_working,
                    onClick: handleGenerate,
                  },
                  {
                    id: 'add',
                    label: t('reminders.add'),
                    onClick: () => setShowModal(true),
                  },
                ]}
              />
            </div>
          </div>

          {error_message && <div className="error-banner">{error_message}</div>}

          {is_loading ? (
            <LoadingState />
          ) : reminders.length === 0 ? (
            <EmptyState message={t('reminders.empty')} />
          ) : (
            <>
              <ReminderList
                reminders={reminders}
                limit={show_all ? null : preview_limit}
                on_done={(id) => handleStatus(id, 'done')}
                on_dismiss={(id) => handleStatus(id, 'dismissed')}
              />
              {hidden_count > 0 && !show_all && (
                <button type="button" className="text-link-btn" onClick={() => setShowAll(true)}>
                  {t('reminders.view_all', { count: reminders.length })}
                </button>
              )}
              {show_all && reminders.length > preview_limit && (
                <button type="button" className="text-link-btn" onClick={() => setShowAll(false)}>
                  {t('common.show_less')}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {show_modal && (
        <Modal
          title={t('reminders.add')}
          on_close={() => setShowModal(false)}
          footer={(
            <div className="modal-actions is-pinned">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                {t('common.cancel')}
              </button>
              <button type="submit" form="panel-reminder-form" className="btn btn-primary" disabled={is_working}>
                {is_working ? t('common.loading') : t('reminders.add')}
              </button>
            </div>
          )}
        >
          <form id="panel-reminder-form" className="sheet-form" onSubmit={handleCreate}>
            <section className="sheet-section">
              <p className="sheet-section-label">{t('common.sheet_details')}</p>
              <div className="form-group">
                <label>{t('reminders.reminder_title')}</label>
                <input
                  className="form-input"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('reminders.type')}</label>
                <div className="choice-chips">
                  {REMINDER_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`choice-chip${form.type === type ? ' is-active' : ''}`}
                      onClick={() => setForm((prev) => ({ ...prev, type }))}
                    >
                      {t(`reminders.types.${type}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>{t('reminders.due_at')}</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.due_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, due_at: e.target.value }))}
                  required
                />
              </div>
            </section>
          </form>
        </Modal>
      )}
    </section>
  );
}

export default RemindersPanel;
