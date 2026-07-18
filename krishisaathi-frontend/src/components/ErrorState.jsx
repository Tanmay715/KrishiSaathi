import { useTranslation } from 'react-i18next';

function ErrorState({ message, on_retry }) {
  const { t } = useTranslation();

  return (
    <div className="error-state" role="alert">
      <p>{message || t('common.error')}</p>
      {on_retry && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={on_retry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

export default ErrorState;
