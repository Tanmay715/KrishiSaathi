import { translateStageName } from './dashboard_insights';

export function daysSince(iso_date) {
  if (!iso_date) {
    return null;
  }

  const start = new Date(`${String(iso_date).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today - start) / 86400000));
}

export function getCropProgress(crop, t) {
  const stages = crop?.lifecycle_stages || [];
  const done_count = stages.filter((stage) => stage.completed).length;
  const progress_pct = stages.length
    ? Math.round((done_count / stages.length) * 100)
    : crop?.status === 'harvested' ? 100 : 8;

  let current_index = stages.findIndex((stage, index) => (
    !stage.completed && stages.slice(0, index).every((item) => item.completed)
  ));
  if (current_index < 0 && stages.length) {
    current_index = stages.every((stage) => stage.completed) ? stages.length - 1 : 0;
  }

  const current_stage = current_index >= 0 ? stages[current_index] : null;
  const next_stage = stages.slice(current_index + 1).find((stage) => !stage.completed) || null;

  const days = daysSince(crop?.sowing_date);
  let health = 'on_track';
  if (crop?.status === 'abandoned') {
    health = 'attention';
  } else if (stages.length && progress_pct < 20 && days != null && days > 21) {
    health = 'attention';
  } else if (progress_pct >= 70) {
    health = 'strong';
  }

  return {
    progress_pct,
    done_count,
    stage_count: stages.length,
    days_growing: days,
    current_stage_name: current_stage ? translateStageName(t, current_stage.name) : null,
    next_activity: next_stage
      ? translateStageName(t, next_stage.name)
      : (stages.length && progress_pct >= 100 ? t('crops.next_harvest') : null),
    health,
    current_index,
  };
}
