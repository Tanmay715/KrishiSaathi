import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getActivity } from '../services/auth_service';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import PageHeader from '../components/PageHeader';

function ActivityPage() {
  const { t } = useTranslation();
  const [activities, setActivities] = useState([]);
  const [is_loading, setIsLoading] = useState(true);
  const [error_message, setErrorMessage] = useState('');

  useEffect(() => {
    loadActivity();
  }, []);

  async function loadActivity() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await getActivity();
      setActivities(response.data || []);
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }

  if (is_loading) {
    return <LoadingState />;
  }

  if (error_message) {
    return <ErrorState message={error_message} on_retry={loadActivity} />;
  }

  return (
    <div>
      <PageHeader title={t('nav.activity')} subtitle={t('dashboard.recent_activity')} />

      {activities.length === 0 ? (
        <EmptyState message={t('dashboard.no_activity')} />
      ) : (
        <div className="card">
          <ul className="activity-list">
            {activities.map((item) => (
              <li key={item.id} className="activity-item">
                <span className="activity-dot" />
                <div>
                  <div>{item.summary}</div>
                  <small style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(item.created_at).toLocaleString()}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ActivityPage;
