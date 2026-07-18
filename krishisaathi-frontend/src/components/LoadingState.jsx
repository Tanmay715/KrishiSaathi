import { useTranslation } from 'react-i18next';

function LoadingState({ label }) {
  const { t } = useTranslation();

  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <span>{label || t('common.loading')}</span>
    </div>
  );
}

export default LoadingState;
