import { useEffect, useState } from 'react';

function HealthBloom({ score = 0, tone = 'steady', label, sublabel }) {
  const [display, setDisplay] = useState(0);
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));

  useEffect(() => {
    let frame;
    const start = performance.now();
    const from = display;
    const duration = 700;

    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(from + (clamped - from) * eased));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped]);

  const circumference = 2 * Math.PI * 46;
  const offset = circumference - (display / 100) * circumference;

  return (
    <div className={`health-bloom tone-${tone}`} aria-label={label}>
      <svg className="health-bloom-svg" viewBox="0 0 120 120">
        <defs>
          <linearGradient id="bloomGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" className="bloom-stop-a" />
            <stop offset="100%" className="bloom-stop-b" />
          </linearGradient>
        </defs>
        <circle className="health-bloom-track" cx="60" cy="60" r="46" />
        <circle
          className="health-bloom-value"
          cx="60"
          cy="60"
          r="46"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
        />
        <g className="health-bloom-leaf">
          <path d="M60 28 C72 40, 78 52, 60 72 C42 52, 48 40, 60 28 Z" />
        </g>
      </svg>
      <div className="health-bloom-copy">
        <strong>{display}</strong>
        <span>{sublabel || label}</span>
      </div>
    </div>
  );
}

export default HealthBloom;
