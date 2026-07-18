import { useTranslation } from 'react-i18next';
import OverflowMenu from './OverflowMenu';
import CropSilhouette from './illustrations/CropSilhouette';
import { getCropProgress } from '../utils/crop_progress';
import { stageIcon, translateStageName } from '../utils/dashboard_insights';

function CropLivingPanel({
  crop,
  weather_tip,
  is_saving,
  on_toggle_stage,
  on_harvest,
  on_abandon,
}) {
  const { t } = useTranslation();
  const progress = getCropProgress(crop, t);

  return (
    <section className="crop-theater">
      <div className="crop-theater-sky" aria-hidden="true" />

      <div className="crop-theater-stage">
        <CropSilhouette
          crop_name={crop.crop_name}
          progress={progress.progress_pct}
          className="crop-theater-art"
        />

        <div className="crop-theater-copy">
          <p className="crop-theater-eyebrow">{t('crops.current_crop')}</p>
          <h2>{crop.crop_name}</h2>

          <div className="crop-theater-chips">
            <span className="status-chip">{t(`crops.season.${crop.season_type}`)}</span>
            <span className={`status-chip tone-${progress.health}`}>
              {t(`crops.health.${progress.health}`)}
            </span>
            {progress.days_growing != null && (
              <span className="status-chip glow">
                {t('crops.days_growing', { count: progress.days_growing })}
              </span>
            )}
          </div>

          <div className="crop-theater-progress">
            <div className="crop-growth-track">
              <div
                className="crop-growth-fill"
                style={{ width: `${progress.progress_pct}%` }}
              />
            </div>
            <div className="crop-growth-meta">
              <strong>{progress.progress_pct}%</strong>
              <span>{t('crops.growth')}</span>
            </div>
          </div>

          <div className="crop-theater-next">
            {progress.current_stage_name && (
              <div>
                <span>{t('crops.stage_current')}</span>
                <strong>{progress.current_stage_name}</strong>
              </div>
            )}
            {progress.next_activity && (
              <div>
                <span>{t('crops.next_up')}</span>
                <strong>{progress.next_activity}</strong>
              </div>
            )}
          </div>

          {weather_tip && (
            <p className="crop-theater-weather">{weather_tip}</p>
          )}

          <div className="crop-theater-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={on_harvest}
              disabled={is_saving}
            >
              {t('crops.record_harvest')}
            </button>
            <OverflowMenu
              label={t('common.more')}
              items={[
                {
                  id: 'abandon',
                  label: t('crops.abandon'),
                  danger: true,
                  disabled: is_saving,
                  onClick: on_abandon,
                },
              ]}
            />
          </div>
        </div>
      </div>

      {crop.lifecycle_stages?.length > 0 && (
        <div className="crop-theater-timeline">
          <h3>{t('crops.lifecycle')}</h3>
          <ol className="stage-timeline is-theater">
            {crop.lifecycle_stages.map((stage, index) => {
              const is_done = Boolean(stage.completed);
              const is_current = index === progress.current_index && !is_done;

              return (
                <li
                  key={`${stage.name}-${index}`}
                  className={`stage-timeline-item${is_done ? ' is-done' : ''}${is_current ? ' is-current' : ''}`}
                >
                  <button
                    type="button"
                    className="stage-timeline-node"
                    onClick={() => on_toggle_stage(index)}
                    aria-pressed={is_done}
                  >
                    <span className="stage-timeline-icon" aria-hidden="true">
                      {is_done ? '✓' : stageIcon(stage.name)}
                    </span>
                  </button>
                  <div className="stage-timeline-body">
                    <button
                      type="button"
                      className="stage-timeline-label"
                      onClick={() => on_toggle_stage(index)}
                    >
                      {translateStageName(t, stage.name)}
                    </button>
                    <span className="stage-timeline-status">
                      {is_done
                        ? t('crops.stage_done')
                        : is_current
                          ? t('crops.stage_current')
                          : t('crops.stage_pending')}
                    </span>
                  </div>
                  {index < crop.lifecycle_stages.length - 1 && (
                    <span className="stage-timeline-connector" aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}

export default CropLivingPanel;
