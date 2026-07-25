import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import VoiceCommandReview from './VoiceCommandReview';
import { useSpeech } from '../hooks/useSpeech';
import { normalizeLanguage } from '../utils/language';
import { getQuickLogTargets } from '../services/farm_service';
import { interpretVoiceCommand } from '../services/voice_service';
import { findTarget, saveVoiceRecord } from '../config/voice_command_helpers';

/**
 * Conversational voice logging: the farmer speaks, the app fills in what it understood
 * and asks aloud for whatever is still missing, then saves on one confirmation tap.
 */
function VoiceCommandSheet({ is_open, on_close, on_saved }) {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  const { is_listening, is_supported, listen, stopListening, speak } = useSpeech(language);

  const [status, setStatus] = useState('idle');
  const [turn, setTurn] = useState(null);
  const [said, setSaid] = useState([]);
  const [targets, setTargets] = useState([]);
  const [target_key, setTargetKey] = useState('');
  const [typed_text, setTypedText] = useState('');
  const [error_message, setErrorMessage] = useState('');
  // The mic reopens from inside a speech callback, so the next answer must read the
  // latest turn rather than the one captured when that callback was created.
  const turn_ref = useRef(null);

  useEffect(() => {
    if (!is_open) {
      return;
    }

    resetConversation();
    getQuickLogTargets()
      .then((response) => setTargets(response.data || []))
      .catch(() => setTargets([]));
  }, [is_open]);

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
        setStatus(turn_ref.current?.is_ready ? 'review' : 'idle');
        setErrorMessage(t(code === 'unsupported' ? 'voice.unsupported' : 'voice.error'));
      },
    });
  }

  async function sendTranscript(transcript) {
    const previous_turn = turn_ref.current;
    setSaid((previous) => [...previous, transcript]);
    setStatus('thinking');

    try {
      const response = await interpretVoiceCommand({
        transcript,
        language,
        intent: previous_turn?.intent && previous_turn.intent !== 'unknown'
          ? previous_turn.intent
          : undefined,
        draft: previous_turn?.draft || undefined,
      });
      applyTurn(response.data);
    } catch (error) {
      setStatus('idle');
      setErrorMessage(error.response?.data?.message || t('common.error'));
    }
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

    setStatus('asking');
    speak(next_turn?.question || t('voice_command.retry_hint'), startListening);
  }

  async function handleSave() {
    const target = findTarget(targets, target_key);

    if (!target && turn.intent !== 'reminder') {
      setErrorMessage(t('quick_log.no_farm'));
      return;
    }

    setStatus('saving');
    setErrorMessage('');

    try {
      await saveVoiceRecord(turn.intent, turn.draft, target);
      setStatus('saved');
      on_saved?.();
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

  if (!is_open) {
    return null;
  }

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
          </>
        )}
      </div>
    </Modal>
  );
}

function VoicePrompt({ t, status, turn, is_listening, on_mic }) {
  const status_labels = {
    idle: t('voice_command.tap_hint'),
    listening: t('voice.listening'),
    thinking: t('voice_command.thinking'),
    asking: turn?.question || t('voice_command.thinking'),
    review: t('voice_command.confirm_hint'),
    saving: t('common.loading'),
  };

  return (
    <div className="voice-command-stage">
      <button
        type="button"
        className={`voice-command-mic${is_listening ? ' is-listening' : ''}`}
        onClick={on_mic}
        disabled={status === 'thinking' || status === 'saving'}
        aria-label={t('voice.tap_to_speak')}
      >
        <MicIcon />
      </button>
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
