import { useTranslation } from 'react-i18next';

function TodayRecommendations({ items = [] }) {
  const { t } = useTranslation();

  if (!items.length) {
    return null;
  }

  return (
    <section className="card today-recs fade-in">
      <div className="today-recs-head">
        <h3>{t('recommendations.title')}</h3>
        <p>{t('recommendations.subtitle')}</p>
      </div>
      <ul className="today-recs-list">
        {items.map((item) => (
          <li key={item.id} className="today-rec-item">
            <span className="today-rec-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default TodayRecommendations;
