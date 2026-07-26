import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import VoiceCommandReview from './VoiceCommandReview';
import { useSpeech } from '../hooks/useSpeech';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { normalizeLanguage } from '../utils/language';
import { getQuickLogTargets } from '../services/farm_service';
import { interpretVoiceCommand } from '../services/voice_service';
import {
  STRUCTURE_INTENTS,
  findTarget,
  saveVoiceRecord,
  suggestionsForPage,
} from '../config/voice_command_helpers';

const INTENT_OPENERS = {
  expense: 'voice_command.ask_expense',
  income: 'voice_command.ask_income',
  reminder: 'voice_command.ask_reminder',
  assistant: 'voice_command.ask_assistant',
  create_farm: 'voice_command.ask_create_farm',
  create_plot: 'voice_command.ask_create_plot',
};

/**
 * The farmer's voice companion: logs money, creates farms/plots, answers questions,
 * and offers tappable options instead of a dead end when speech is unclear.
 */
function VoiceCommandSheet({
  is_open,
  on_close,
  on_saved,
  on_manual_entry,
  manual_entry = null,
  page_context = {},
}) {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  const is_online = useOnlineStatus();
  const { is_listening, is_supported, listen, stopListening, speak } = useSpeech(language);

  const [status, setStatus] = useState('idle');
  const [turn, setTurn] = useState(null);
  const [said, setSaid] = useState([]);
  const [targets, setTargets] = useState([]);
  const [target_key, setTargetKey] = useState('');
  const [typed_text, setTypedText] = useState('');
  const [error_message, setErrorMessage] = useState('');
  const turn_ref = useRef(null);

  const idle_suggestions = useMemo(
    () => suggestionsForPage(page_context.page),
    [page_context.page],
  );

  useEffect(() => {
    if (!is_open) {
      return;
    }

    resetConversation();
    getQuickLogTargets()
      .then((response) => setTargets(response.data || []))
      .catch(() => setTargets([]));
  }, [is_open, page_context.page, page_context.farm_id, page_context.plot_id]);

  function resetConversation() {
    turn_ref.current = null;
    setStatus('idle');
    setTurn(null);
    setSaid([]);
    setTargetKey('');
    setTypedText('');
    setErrorMessage('');
  }

  function startListening() {
    setErrorMessage('');
    setStatus('listening');
    listen({
      on_result: (transcript) => sendTranscript(transcript),
      on_error: (code) => {
        setStatus(turn_ref.current?.is_ready ? 'review' : idleOrAnswered());
        setErrorMessage(t(code === 'unsupported' ? 'voice.unsupported' : 'voice.error'));
      },
    });
  }

  function idleOrAnswered() {
    return turn_ref.current?.answer ? 'answered' : 'idle';
  }

  function startIntent(intent) {
    const seed = {
      intent,
      draft: seedDraftForIntent(intent, page_context),
    };
    turn_ref.current = seed;
    setTurn(seed);
    setErrorMessage('');
    setStatus('asking');
    speak(t(INTENT_OPENERS[intent] || 'voice_command.ask_assistant'), startListening);
  }

  async function sendTranscript(transcript) {
    const previous_turn = turn_ref.current;
    setSaid((previous) => [...previous, transcript]);
    setStatus('thinking');

    try {
      const response = await interpretVoiceCommand({
        transcript,
        language,
        intent: activeIntent(previous_turn),
        draft: previous_turn?.draft || undefined,
        context: page_context,
      });
      applyTurn(response.data);
    } catch (error) {
      setStatus(idleOrAnswered());
      setErrorMessage(error.response?.data?.message || t('common.error'));
    }
  }

  function activeIntent(previous_turn) {
    const intent = previous_turn?.intent;
    // Keep record/structure drafts sticky; let Q&A intents reclassify freely.
    if (!intent || ['unknown', 'help', 'money_query'].includes(intent)) {
      return undefined;
    }
    return intent;
  }

  function applyTurn(next_turn) {
    turn_ref.current = next_turn;
    setTurn(next_turn);
    setTargetKey(next_turn?.draft?.target_key || '');

    if (next_turn?.is_ready) {
      setStatus('review');
      speak(next_turn.summary || t('voice_command.ready'));
      return;
    }

    if (next_turn?.answer) {
      setStatus('answered');
      speak(next_turn.answer);
      return;
    }

    setStatus('asking');
    speak(next_turn?.question || t('voice_command.retry_hint'), startListening);
  }

  async function handleSave() {
    const target = findTarget(targets, target_key);
    const is_structure = STRUCTURE_INTENTS.includes(turn.intent);

    if (!is_structure && !target && turn.intent !== 'reminder') {
      setErrorMessage(t('quick_log.no_farm'));
      return;
    }

    if (turn.intent === 'create_plot' && !turn.draft?.farm_id && !target?.farm_id) {
      setErrorMessage(t('quick_log.no_farm'));
      return;
    }

    setStatus('saving');
    setErrorMessage('');

    try {
      await saveVoiceRecord(turn.intent, turn.draft, target);
      setStatus('saved');
      on_saved?.(turn.intent);
    } catch (error) {
      setStatus('review');
      setErrorMessage(error.response?.data?.message || t('voice_command.save_failed'));
    }
  }

  function handleTypedSubmit(event) {
    event.preventDefault();
    const text = typed_text.trim();

    if (text) {
      setTypedText('');
      sendTranscript(text);
    }
  }

  function handleManualEntry() {
    stopListening();
    on_manual_entry?.();
  }

  if (!is_open) {
    return null;
  }

  const suggestions = turn?.suggestions?.length
    ? turn.suggestions
    : (status === 'idle' ? idle_suggestions : []);

  return (
    <Modal
      title={t('voice_command.title')}
      subtitle={t('voice_command.subtitle')}
      on_close={() => {
        stopListening();
        on_close?.();
      }}
      size="md"
    >
      <div className="voice-command">
        {status === 'saved' ? (
          <VoiceSavedState t={t} on_again={resetConversation} on_close={on_close} />
        ) : (
          <>
            <VoicePrompt
              t={t}
              status={status}
              turn={turn}
              is_listening={is_listening}
              on_mic={is_listening ? stopListening : startListening}
            />

            {turn?.answer && (status === 'answered' || status === 'listening') && (
              <p className="voice-command-answer">{turn.answer}</p>
            )}

            {suggestions.length > 0 && status !== 'review' && status !== 'asking' && (
              <div className="voice-command-suggestions">
                {suggestions.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="voice-command-chip"
                    onClick={() => startIntent(key)}
                  >
                    {t(`voice_command.suggest_${key}`)}
                  </button>
                ))}
              </div>
            )}

            {said.length > 0 && (
              <ul className="voice-command-said">
                {said.map((line, index) => <li key={`${line}-${index}`}>“{line}”</li>)}
              </ul>
            )}

            {error_message && <div className="error-banner">{error_message}</div>}

            {status === 'review' && turn && (
              <VoiceCommandReview
                t={t}
                turn={turn}
                targets={targets}
                target_key={target_key}
                on_target_change={setTargetKey}
                on_save={handleSave}
                on_redo={resetConversation}
              />
            )}

            {!is_online && (
              <p className="voice-command-offline">{t('voice_command.offline_hint')}</p>
            )}

            {!is_supported && (
              <form className="voice-command-typed" onSubmit={handleTypedSubmit}>
                <input
                  className="form-input"
                  value={typed_text}
                  placeholder={t('voice_command.type_placeholder')}
                  onChange={(event) => setTypedText(event.target.value)}
                />
                <button type="submit" className="btn btn-secondary">{t('common.send')}</button>
              </form>
            )}

            {on_manual_entry && manual_entry && status !== 'review' && (
              <button
                type="button"
                className="voice-command-manual-btn"
                onClick={handleManualEntry}
              >
                <span className="voice-command-manual-icon" aria-hidden="true">
                  {manual_entry.icon || '₹'}
                </span>
                <span>
                  <strong>{t(manual_entry.label_key)}</strong>
                  <em>{t(manual_entry.hint_key)}</em>
                </span>
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function seedDraftForIntent(intent, context) {
  if (intent === 'create_plot' && context.farm_id) {
    return { farm_id: context.farm_id };
  }
  return {};
}

function VoicePrompt({ t, status, turn, is_listening, on_mic }) {
  const status_labels = {
    idle: t('voice_command.tap_hint'),
    listening: t('voice.listening'),
    thinking: t('voice_command.thinking'),
    asking: turn?.question || t(INTENT_OPENERS[turn?.intent] || 'voice_command.thinking'),
    answered: t('voice_command.continue_hint'),
    review: t('voice_command.confirm_hint'),
    saving: t('common.loading'),
  };

  return (
    <div className="voice-command-stage">
      <div className={`voice-command-mic-wrap${is_listening ? ' is-listening' : ''}`}>
        {is_listening && (
          <>
            <span className="voice-command-ring" aria-hidden="true" />
            <span className="voice-command-ring" aria-hidden="true" />
            <span className="voice-command-ring" aria-hidden="true" />
            <div className="voice-command-wave-side is-left" aria-hidden="true">
              <span /><span /><span />
            </div>
            <div className="voice-command-wave-side is-right" aria-hidden="true">
              <span /><span /><span />
            </div>
          </>
        )}
        <button
          type="button"
          className={`voice-command-mic${is_listening ? ' is-listening' : ''}`}
          onClick={on_mic}
          disabled={status === 'thinking' || status === 'saving'}
          aria-label={t('voice.tap_to_speak')}
          aria-pressed={is_listening}
        >
          <MicIcon />
        </button>
      </div>
      <p className="voice-command-status">{status_labels[status]}</p>
      {status === 'idle' && (
        <p className="voice-command-examples">{t('voice_command.examples')}</p>
      )}
    </div>
  );
}

function VoiceSavedState({ t, on_again, on_close }) {
  return (
    <div className="voice-command-saved">
      <span className="voice-command-tick" aria-hidden="true">✓</span>
      <p>{t('voice_command.saved')}</p>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={on_close}>
          {t('common.close')}
        </button>
        <button type="button" className="btn btn-primary" onClick={on_again}>
          {t('voice_command.log_another')}
        </button>
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" aria-hidden="true">
      <rect x="9" y="2.5" width="6" height="11" rx="3" fill="currentColor" />
      <path
        d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default VoiceCommandSheet;
