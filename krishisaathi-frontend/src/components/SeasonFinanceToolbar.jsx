import { useTranslation } from 'react-i18next';

const SEASON_OPTIONS = ['all', 'kharif', 'rabi', 'zaid', 'custom'];

function SeasonFinanceToolbar({ season, year, filter_options, on_change, on_print }) {
  const { t } = useTranslation();
  const years = filter_options?.years || [];

  return (
    <div className="season-finance-toolbar">
      <div className="season-finance-filters">
        <div className="form-group season-filter-group">
          <label>{t('season.filter_season')}</label>
          <select
            className="form-select"
            value={season}
            onChange={(e) => on_change({ season: e.target.value, year })}
          >
            {SEASON_OPTIONS.filter(
              (option) => option === 'all' || filter_options?.seasons?.includes(option) || option !== 'custom',
            ).map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? t('season.all_seasons') : t(`crops.season.${option}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group season-filter-group">
          <label>{t('season.filter_year')}</label>
          <select
            className="form-select"
            value={year}
            onChange={(e) => on_change({ season, year: e.target.value })}
          >
            <option value="all">{t('season.all_years')}</option>
            {years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={on_print}>
        {t('season.print_report')}
      </button>
    </div>
  );
}

export default SeasonFinanceToolbar;
