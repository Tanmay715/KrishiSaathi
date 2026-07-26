/**
 * Fasalya voice personality — warm, short, and quiet unless useful.
 * Philosophy: 80% useful + 20% warmth. Never waste the farmer's time.
 */

const STORAGE_KEY = 'fasalya_voice_opens';

export function buildCompanionOpening(briefing, language = 'hi') {
  const open_count = bumpOpenCount();
  const has_urgent = Boolean(briefing?.urgent?.length);
  const name = briefing?.farmer_name || null;
  const region = briefing?.region || 'hindi';
  const is_hi = language === 'hi';

  const greeting = pickGreeting({
    name,
    is_hi,
    region,
    open_count,
    has_urgent,
    hour: new Date().getHours(),
  });

  const urgent = has_urgent ? briefing.urgent[0] : null;
  const celebration = !has_urgent && briefing?.celebration?.speak_on_open !== false
    ? briefing.celebration
    : null;

  const lines = [];
  if (greeting) {
    lines.push(greeting);
  }
  if (urgent?.text) {
    lines.push(is_hi ? `एक ज़रूरी बात। ${urgent.text}` : `One important thing. ${urgent.text}`);
  } else if (celebration?.text) {
    lines.push(celebration.text);
  }

  return {
    open_count,
    greeting,
    urgent: urgent?.text || null,
    celebration: celebration?.text || null,
    memory: briefing?.memory?.text || null,
    speak_text: lines.join(' '),
    display_lines: lines,
    skip_auto_listen: false,
  };
}

function pickGreeting({ name, is_hi, region, open_count, has_urgent, hour }) {
  // Third+ open of the day: stay quiet unless something urgent needs the floor.
  if (open_count >= 3 && !has_urgent) {
    return '';
  }

  if (open_count >= 2 && !has_urgent) {
    return shortGreeting({ name, is_hi, hour });
  }

  return warmGreeting({ name, is_hi, region, hour });
}

function warmGreeting({ name, is_hi, region, hour }) {
  const ji = name ? `${name} जी` : null;
  const pool = is_hi
    ? hindiWarmPool(ji, region, hour)
    : englishWarmPool(name, hour);

  return pickRandom(pool);
}

function shortGreeting({ name, is_hi, hour }) {
  if (!is_hi) {
    if (hour < 12) {
      return name ? `Yes ${name}?` : 'Yes?';
    }
    if (hour < 17) {
      return 'Go ahead.';
    }
    return 'Listening.';
  }

  if (hour < 12) {
    return name ? `नमस्ते ${name} जी।` : 'नमस्ते।';
  }
  if (hour < 17) {
    return 'जी, बताइए।';
  }
  return 'सुन रहा हूँ।';
}

function hindiWarmPool(ji, region, hour) {
  const who = ji || 'जी';

  if (region === 'bhojpuri') {
    return [
      `प्रणाम ${who}।`,
      `प्रणाम ${who}, बताईं।`,
      'प्रणाम। आज का मदद करी?',
    ];
  }

  if (region === 'marathi') {
    return [
      `नमस्कार ${who}।`,
      `नमस्कार ${who}, सांगा।`,
      'नमस्कार।',
    ];
  }

  if (region === 'punjabi') {
    return [
      ji ? `Sat Sri Akal ${ji}.` : 'Sat Sri Akal ji.',
      `नमस्ते ${who}।`,
      ji ? `Sat Sri Akal ${ji}, batayiye.` : 'Sat Sri Akal ji.',
    ];
  }

  return [
    `नमस्ते ${who}।`,
    `नमस्कार ${who}।`,
    `नमस्ते ${who}, बताइए।`,
    'नमस्ते! आज किस बात में मदद करूँ?',
    `नमस्ते ${who}।`,
  ];
}

function englishWarmPool(name, hour) {
  const who = name || 'ji';
  return [
    `Namaste ${who}.`,
    `Hello ${who}.`,
    name ? `Namaste ${name}, tell me.` : 'Namaste, tell me.',
    hour < 12 ? `Good morning ${who}.` : `Namaste ${who}.`,
  ];
}

function pickRandom(list) {
  if (!list.length) {
    return '';
  }

  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

function bumpOpenCount() {
  const today = new Date().toISOString().slice(0, 10);

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const count = parsed?.date === today ? Number(parsed.count || 0) + 1 : 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count }));
    return count;
  } catch (_error) {
    return 1;
  }
}

export function peekOpenCount() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const today = new Date().toISOString().slice(0, 10);
    return parsed?.date === today ? Number(parsed.count || 0) : 0;
  } catch (_error) {
    return 0;
  }
}
