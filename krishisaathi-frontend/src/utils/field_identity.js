/** Resolve a simple crop visual family from crop name. */
export function resolveCropFamily(crop_name = '') {
  const name = String(crop_name).toLowerCase();
  if (/wheat|गेहूँ|gehun|barley|जौ/.test(name)) return 'wheat';
  if (/rice|paddy|धान|चावल|basmati/.test(name)) return 'rice';
  if (/cotton|कपास/.test(name)) return 'cotton';
  if (/potato|आलू|tomato|टमाटर|onion|प्याज/.test(name)) return 'tuber';
  if (/mustard|सरसों|moong|मूंग|chana|चना|pulse|dal/.test(name)) return 'pulse';
  return 'plant';
}

export function weatherMood(weather) {
  const rain = Number(weather?.current?.rain_chance ?? 0);
  const condition = String(weather?.current?.condition || '').toLowerCase();
  if (rain >= 60 || condition.includes('rain') || condition.includes('thunder')) {
    return 'rain';
  }
  if (rain >= 35 || condition.includes('cloud') || condition.includes('overcast')) {
    return 'cloud';
  }
  if (condition.includes('fog') || condition.includes('mist') || condition.includes('haze')) {
    return 'haze';
  }
  return 'clear';
}

export function farmHealthScore({ earned = 0, spent = 0, pending_count = 0, reminders = [] }) {
  const flow = Number(earned) + Number(spent);
  let score = 58;
  if (flow > 0) {
    score = Math.round((Number(earned) / flow) * 100);
  }
  if (pending_count > 0) {
    score = Math.max(12, score - Math.min(18, pending_count * 4));
  }
  const overdue = reminders.filter((item) => new Date(item.due_at).getTime() < Date.now()).length;
  if (overdue > 0) {
    score = Math.max(8, score - Math.min(20, overdue * 6));
  }
  score = Math.max(0, Math.min(100, score));

  let band = 'steady';
  let tone = 'steady';
  if (score >= 75) {
    band = 'thriving';
    tone = 'thriving';
  } else if (score >= 45) {
    band = 'steady';
    tone = 'steady';
  } else {
    band = 'strain';
    tone = 'strain';
  }

  return { score, band, tone };
}
