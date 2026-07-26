import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Wraps the browser speech APIs for the voice command flow: listening for a farmer's
 * answer and reading the next question back out loud, which is what makes the feature
 * usable without reading the screen.
 */
export function useSpeech(language = 'en') {
  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';
  const [is_listening, setIsListening] = useState(false);
  const [is_supported, setIsSupported] = useState(true);
  const [live_transcript, setLiveTranscript] = useState('');
  const recognition_ref = useRef(null);
  const handlers_ref = useRef({});
  const live_ref = useRef('');
  const final_ref = useRef('');

  useEffect(() => {
    setIsSupported(Boolean(getSpeechRecognition()));

    return () => {
      stopSpeaking();
      recognition_ref.current?.abort?.();
      recognition_ref.current = null;
    };
  }, []);

  const listen = useCallback(({ on_result, on_error, on_partial } = {}) => {
    const SpeechRecognition = getSpeechRecognition();

    if (!SpeechRecognition) {
      setIsSupported(false);
      on_error?.('unsupported');
      return;
    }

    stopSpeaking();
    recognition_ref.current?.abort?.();
    handlers_ref.current = { on_result, on_error, on_partial };
    live_ref.current = '';
    final_ref.current = '';
    setLiveTranscript('');

    const recognition = new SpeechRecognition();
    recognition.lang = locale;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const { final_text, interim_text } = readSpeechChunks(event.results);
      final_ref.current = final_text;
      const live = `${final_text} ${interim_text}`.replace(/\s+/g, ' ').trim();
      live_ref.current = live;
      setLiveTranscript(live);
      handlers_ref.current.on_partial?.(live);
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      handlers_ref.current.on_error?.(event?.error || 'error');
    };

    recognition.onend = () => {
      setIsListening(false);
      const transcript = (final_ref.current || live_ref.current).trim();
      if (transcript) {
        handlers_ref.current.on_result?.(transcript);
      }
    };

    recognition_ref.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
    } catch (_error) {
      setIsListening(false);
    }
  }, [locale]);

  const stopListening = useCallback(() => {
    recognition_ref.current?.stop?.();
    setIsListening(false);
  }, []);

  /** Speaks `text`, then runs `on_done` so the mic can reopen for the answer. */
  const speak = useCallback((text, on_done) => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    const spoken = stripForSpeech(text);

    if (!synth || !spoken) {
      on_done?.();
      return;
    }

    synth.cancel();
    const utterance = new window.SpeechSynthesisUtterance(spoken);
    utterance.lang = locale;
    utterance.rate = 0.95;
    utterance.onend = () => on_done?.();
    utterance.onerror = () => on_done?.();
    synth.speak(utterance);
  }, [locale]);

  return {
    is_listening,
    is_supported,
    live_transcript,
    listen,
    stopListening,
    speak,
    stopSpeaking,
  };
}

function readSpeechChunks(results) {
  let final_text = '';
  let interim_text = '';

  for (let index = 0; index < results.length; index += 1) {
    const piece = String(results[index]?.[0]?.transcript || '');
    if (results[index].isFinal) {
      final_text += `${piece} `;
    } else {
      interim_text += `${piece} `;
    }
  }

  return {
    final_text: final_text.trim(),
    interim_text: interim_text.trim(),
  };
}

function getSpeechRecognition() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function stopSpeaking() {
  if (typeof window !== 'undefined') {
    window.speechSynthesis?.cancel();
  }
}

/** Markdown markers like *bold* sound awful when read aloud — strip them first. */
function stripForSpeech(text) {
  return String(text || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`+/g, '')
    .replace(/#{1,6}\s*/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}
