import { useTranslation } from 'react-i18next';
import { formatMoneyDate } from '../utils/format_date';

function formatAmount(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

function getFilterLabel({ t, season, year }) {
  const season_label = season === 'all' ? t('season.all_seasons') : t(`crops.season.${season}`);
  const year_label = year === 'all' ? t('season.all_years') : year;
  return `${season_label} · ${year_label}`;
}

function SeasonReportSheet({ farm, finance, plots, crops, season, year }) {
  const { t } = useTranslation();
  const spent = Number(finance?.expense_total || 0);
  const earned = Number(finance?.income_total || 0);
  const profit = Number(finance?.profit ?? earned - spent);
  const location = [farm?.village, farm?.district, farm?.state].filter(Boolean).join(', ');

  return (
    <div className="season-report-sheet">
      <header className="season-report-header">
        <p className="season-report-brand">{t('app.name')}</p>
        <h1>{t('season.report_title')}</h1>
        <p className="season-report-farm">{farm?.name}</p>
        {location && <p className="season-report-location">{location}</p>}
        <p className="season-report-period">{getFilterLabel({ t, season, year })}</p>
        <p className="season-report-date">
          {t('season.generated_on')}: {formatMoneyDate(new Date().toISOString())}
        </p>
      </header>

      <section className="season-report-summary">
        <div>
          <span>{t('dashboard.total_spent')}</span>
          <strong>₹{formatAmount(spent)}</strong>
        </div>
        <div>
          <span>{t('dashboard.total_earned')}</span>
          <strong>₹{formatAmount(earned)}</strong>
        </div>
        <div>
          <span>{t('dashboard.net')}</span>
          <strong>
            {profit >= 0 ? '+' : '-'}₹{formatAmount(Math.abs(profit))}
          </strong>
        </div>
      </section>

      {crops?.length > 0 && (
        <section className="season-report-section">
          <h2>{t('season.by_crop')}</h2>
          <table className="season-report-table">
            <thead>
              <tr>
                <th>{t('crops.crop_name')}</th>
                <th>{t('farms.plot_name')}</th>
                <th>{t('crops.season_label')}</th>
                <th>{t('dashboard.total_spent')}</th>
                <th>{t('dashboard.total_earned')}</th>
                <th>{t('dashboard.net')}</th>
              </tr>
            </thead>
            <tbody>
              {crops.map((crop) => (
                <tr key={crop.id}>
                  <td>{crop.crop_name}</td>
                  <td>{crop.plot_name}</td>
                  <td>{t(`crops.season.${crop.season_type}`)}</td>
                  <td>₹{formatAmount(crop.expense_total)}</td>
                  <td>₹{formatAmount(crop.income_total)}</td>
                  <td>
                    {Number(crop.profit || 0) >= 0 ? '+' : '-'}₹
                    {formatAmount(Math.abs(crop.profit || 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {plots?.some((plot) => plot.expense_total > 0 || plot.income_total > 0) && (
        <section className="season-report-section">
          <h2>{t('finance.by_plot')}</h2>
          <table className="season-report-table">
            <thead>
              <tr>
                <th>{t('farms.plot_name')}</th>
                <th>{t('dashboard.total_spent')}</th>
                <th>{t('dashboard.total_earned')}</th>
                <th>{t('dashboard.net')}</th>
              </tr>
            </thead>
            <tbody>
              {plots
                .filter((plot) => plot.expense_total > 0 || plot.income_total > 0)
                .map((plot) => (
                  <tr key={plot.id}>
                    <td>{plot.name}</td>
                    <td>₹{formatAmount(plot.expense_total)}</td>
                    <td>₹{formatAmount(plot.income_total)}</td>
                    <td>
                      {Number(plot.profit || 0) >= 0 ? '+' : '-'}₹
                      {formatAmount(Math.abs(plot.profit || 0))}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}

      <footer className="season-report-footer">{t('season.report_footer')}</footer>
    </div>
  );
}

export default SeasonReportSheet;
