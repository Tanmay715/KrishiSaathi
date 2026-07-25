import { targetLabel } from '../config/voice_command_helpers';

/** Last checkpoint before saving: what the app understood, in plain rows a farmer can scan. */
function VoiceCommandReview({ t, turn, targets, target_key, on_target_change, on_save, on_redo }) {
  const { intent, draft, summary } = turn;
  const rows = buildRows(t, intent, draft);

  return (
    <div className="voice-command-review">
      <p className="voice-command-summary">
        {summary || t(`voice_command.intent_${intent}`)}
      </p>

      <dl className="voice-command-fields">
        {rows.map((row) => (
          <div key={row.label} className="voice-command-field">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>

      {targets.length > 0 && intent !== 'reminder' && (
        <div className="form-group">
          <label htmlFor="voice-target">{t('quick_log.where')}</label>
          <select
            id="voice-target"
            className="form-select"
            value={target_key}
            onChange={(event) => on_target_change(event.target.value)}
          >
            {targets.map((target) => (
              <option key={target.target_key} value={target.target_key}>
                {targetLabel(target)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={on_redo}>
          {t('voice_command.say_again')}
        </button>
        <button type="button" className="btn btn-primary" onClick={on_save}>
          {t('voice_command.confirm_save')}
        </button>
      </div>
    </div>
  );
}

function buildRows(t, intent, draft) {
  const rows = [{ label: t('voice_command.field_kind'), value: t(`voice_command.intent_${intent}`) }];

  if (draft.title) {
    rows.push({ label: t('voice_command.field_what'), value: draft.title });
  }

  if (draft.amount) {
    rows.push({
      label: t('voice_command.field_amount'),
      value: `₹${Number(draft.amount).toLocaleString('en-IN')}`,
    });
  }

  if (draft.quantity) {
    rows.push({
      label: t('voice_command.field_quantity'),
      value: [draft.quantity, draft.unit].filter(Boolean).join(' '),
    });
  }

  const date = intent === 'reminder' ? draft.due_at : draft.date;

  if (date) {
    rows.push({ label: t('voice_command.field_date'), value: date });
  }

  return rows;
}

export default VoiceCommandReview;
