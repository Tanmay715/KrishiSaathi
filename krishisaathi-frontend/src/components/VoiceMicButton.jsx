import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

function getSpeechRecognition() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function VoiceMicButton({ lang = 'en', on_transcript, on_error, disabled = false }) {
  const { t } = useTranslation();
  const [is_listening, setIsListening] = useState(false);
  const [is_supported, setIsSupported] = useState(true);
  const recognition_ref = useRef(null);

  useEffect(() => {
    setIsSupported(Boolean(getSpeechRecognition()));

    return () => {
      recognition_ref.current?.stop?.();
    };
  }, []);

  function handleToggle() {
    if (disabled) {
      return;
    }

    const SpeechRecognition = getSpeechRecognition();

    if (!SpeechRecognition) {
      setIsSupported(false);
      on_error?.(t('voice.unsupported'));
      return;
    }

    if (is_listening) {
      recognition_ref.current?.stop?.();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) {
        on_transcript?.(transcript);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      on_error?.(t('voice.error'));
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition_ref.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  if (!is_supported) {
    return (
      <p className="section-note">{t('voice.unsupported')}</p>
    );
  }

  return (
    <button
      type="button"
      className={`btn voice-mic-btn ${is_listening ? 'is-listening' : 'btn-secondary'}`}
      onClick={handleToggle}
      disabled={disabled}
      aria-pressed={is_listening}
    >
      {is_listening ? t('voice.listening') : t('voice.tap_to_speak')}
    </button>
  );
}

export default VoiceMicButton;
