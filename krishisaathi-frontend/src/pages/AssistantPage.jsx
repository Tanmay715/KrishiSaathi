import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAssistantThread, sendAssistantMessage } from '../services/assistant_service';
import { getFarms, getFarm } from '../services/farm_service';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

const SCOPE_STORAGE_KEY = 'ks_assistant_scope';

function parseMetadata(raw) {
  if (!raw) {
    return null;
  }
  if (typeof raw === 'object') {
    return raw;
  }
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

function GovernmentRecommendation({ recommendation, t }) {
  const items = recommendation?.items || [];
  if (!items.length) {
    return null;
  }

  return (
    <div className="assistant-gov">
      <div className="assistant-gov-head">
        <strong>{t('assistant.gov_title')}</strong>
        <span>{t('assistant.gov_source')}</span>
      </div>
      {items.map((item, index) => {
        const place = [item.district, item.state].filter(Boolean).join(', ');
        const meta = [item.query_type, item.crop, place, item.as_of]
          .filter(Boolean)
          .join(' · ');
        return (
          <div key={`${item.as_of}-${index}`} className="assistant-gov-item">
            {meta && <p className="assistant-gov-meta">{meta}</p>}
            <p className="assistant-gov-answer">{item.answer}</p>
            {item.query && (
              <p className="assistant-gov-query">
                {t('assistant.gov_asked')}: {item.query}
              </p>
            )}
          </div>
        );
      })}
      <p className="assistant-gov-note">{t('assistant.gov_disclaimer')}</p>
    </div>
  );
}

function AssistantPage() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [is_loading, setIsLoading] = useState(true);
  const [is_sending, setIsSending] = useState(false);
  const [error_message, setErrorMessage] = useState('');
  const [load_error, setLoadError] = useState('');
  const [farms, setFarms] = useState([]);
  const [plots, setPlots] = useState([]);
  const [farm_id, setFarmId] = useState('');
  const [plot_id, setPlotId] = useState('');
  const [is_scope_open, setIsScopeOpen] = useState(false);
  const bottom_ref = useRef(null);
  const input_ref = useRef(null);

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    bottom_ref.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, is_sending]);

  useEffect(() => {
    localStorage.setItem(SCOPE_STORAGE_KEY, JSON.stringify({ farm_id, plot_id }));
  }, [farm_id, plot_id]);

  async function loadInitial() {
    setIsLoading(true);
    setLoadError('');

    try {
      const saved = JSON.parse(localStorage.getItem(SCOPE_STORAGE_KEY) || '{}');
      const [thread_response, farms_response] = await Promise.all([
        getAssistantThread(),
        getFarms(),
      ]);
      const farm_rows = farms_response.data || [];
      setFarms(farm_rows);
      setMessages(thread_response.data?.messages || []);

      const initial_farm_id = saved.farm_id && farm_rows.some((f) => f.id === saved.farm_id)
        ? saved.farm_id
        : (farm_rows[0]?.id || '');
      setFarmId(initial_farm_id);

      if (initial_farm_id) {
        await loadPlots(initial_farm_id, saved.plot_id || '');
      }
    } catch (error) {
      setLoadError(error.response?.data?.message || t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPlots(next_farm_id, preferred_plot_id = '') {
    if (!next_farm_id) {
      setPlots([]);
      setPlotId('');
      return;
    }

    try {
      const response = await getFarm(next_farm_id);
      const farm = response.data;
      const plot_rows = farm?.plots || [];
      setPlots(plot_rows);
      const next_plot = preferred_plot_id && plot_rows.some((p) => p.id === preferred_plot_id)
        ? preferred_plot_id
        : '';
      setPlotId(next_plot);
    } catch (error) {
      console.error(error);
      setPlots([]);
      setPlotId('');
    }
  }

  async function handleFarmChange(next_farm_id) {
    setFarmId(next_farm_id);
    await loadPlots(next_farm_id);
  }

  async function handleSend(event) {
    event.preventDefault();
    const text = input.trim();

    if (!text || is_sending) {
      return;
    }

    setInput('');
    setErrorMessage('');
    setIsSending(true);
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: 'user', content: text },
    ]);

    try {
      const response = await sendAssistantMessage(text, {
        farm_id: farm_id || null,
        plot_id: plot_id || null,
      });
      const reply = response.data?.message;

      if (reply) {
        setMessages((prev) => [...prev, reply]);
      }
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
    } finally {
      setIsSending(false);
      input_ref.current?.focus();
    }
  }

  if (is_loading) {
    return (
      <div className="assistant-page">
        <LoadingState />
      </div>
    );
  }

  if (load_error) {
    return (
      <div className="assistant-page">
        <ErrorState message={load_error} on_retry={loadInitial} />
      </div>
    );
  }

  const selected_farm = farms.find((farm) => farm.id === farm_id);
  const selected_plot = plots.find((plot) => plot.id === plot_id);
  const scope_label = [selected_farm?.name, selected_plot?.name].filter(Boolean).join(' · ')
    || t('assistant.all_farms');

  return (
    <div className="assistant-page">
      <header className="assistant-chat-header">
        <Link to="/" className="assistant-back" aria-label={t('assistant.back')}>
          ←
        </Link>
        <div className="assistant-chat-titles">
          <strong>{t('assistant.title')}</strong>
          <button
            type="button"
            className="assistant-scope-chip"
            onClick={() => setIsScopeOpen((prev) => !prev)}
          >
            {scope_label}
            <span aria-hidden="true">{is_scope_open ? '▴' : '▾'}</span>
          </button>
        </div>
      </header>

      {is_scope_open && (
        <div className="assistant-scope">
          <div className="assistant-scope-field">
            <label htmlFor="assistant-farm">{t('nav.farms')}</label>
            <select
              id="assistant-farm"
              className="form-select"
              value={farm_id}
              onChange={(e) => handleFarmChange(e.target.value)}
            >
              <option value="">{t('assistant.all_farms')}</option>
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>{farm.name}</option>
              ))}
            </select>
          </div>
          <div className="assistant-scope-field">
            <label htmlFor="assistant-plot">{t('farms.plots')}</label>
            <select
              id="assistant-plot"
              className="form-select"
              value={plot_id}
              onChange={(e) => setPlotId(e.target.value)}
              disabled={!farm_id}
            >
              <option value="">{t('assistant.all_plots')}</option>
              {plots.map((plot) => (
                <option key={plot.id} value={plot.id}>{plot.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {error_message && <div className="error-banner assistant-error">{error_message}</div>}

      <div className="assistant-messages">
        {messages.length === 0 && (
          <div className="assistant-empty">
            <p>{t('assistant.empty')}</p>
            <div className="assistant-suggestions">
              {[t('assistant.suggestion_1'), t('assistant.suggestion_2'), t('assistant.suggestion_3')].map(
                (suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="assistant-suggestion-chip"
                    onClick={() => {
                      setInput(suggestion);
                      input_ref.current?.focus();
                    }}
                  >
                    {suggestion}
                  </button>
                ),
              )}
            </div>
          </div>
        )}

        {messages.map((message) => {
          const metadata = parseMetadata(message.metadata);
          const government = metadata?.government_recommendation || null;

          return (
            <div
              key={message.id}
              className={`assistant-bubble ${message.role === 'user' ? 'assistant-bubble-user' : 'assistant-bubble-bot'}`}
            >
              {message.role === 'assistant' && (
                <GovernmentRecommendation recommendation={government} t={t} />
              )}
              <div className="assistant-content">{message.content}</div>
            </div>
          );
        })}

        {is_sending && (
          <div className="assistant-bubble assistant-bubble-bot is-thinking">
            <div className="assistant-content">{t('assistant.thinking')}</div>
          </div>
        )}
        <div ref={bottom_ref} />
      </div>

      <form className="assistant-composer" onSubmit={handleSend}>
        <input
          ref={input_ref}
          className="form-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('assistant.placeholder')}
          disabled={is_sending}
          enterKeyHint="send"
        />
        <button type="submit" className="btn btn-primary" disabled={is_sending || !input.trim()}>
          {t('assistant.send')}
        </button>
      </form>
    </div>
  );
}

export default AssistantPage;
