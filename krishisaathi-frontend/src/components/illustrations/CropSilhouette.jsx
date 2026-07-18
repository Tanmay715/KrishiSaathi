import { resolveCropFamily } from '../../utils/field_identity';

function CropSilhouette({ crop_name, progress = 40, className = '' }) {
  const family = resolveCropFamily(crop_name);
  const growth = Math.max(0.18, Math.min(1, (Number(progress) || 0) / 100));

  return (
    <div
      className={`crop-silhouette family-${family} ${className}`}
      style={{ '--growth': growth }}
      aria-hidden="true"
    >
      <div className="crop-silhouette-soil" />
      <svg viewBox="0 0 200 220" className="crop-silhouette-svg">
        {family === 'wheat' && (
          <g className="crop-grow-layer">
            <path className="stem" d="M100 210 C98 150, 102 90, 100 48" />
            <path className="leaf" d="M100 150 C70 140, 55 120, 48 100" />
            <path className="leaf" d="M100 130 C130 118, 145 100, 152 82" />
            <ellipse className="head" cx="100" cy="42" rx="14" ry="28" />
            <path className="awn" d="M92 28 L86 12 M100 24 L100 6 M108 28 L114 12" />
          </g>
        )}
        {family === 'rice' && (
          <g className="crop-grow-layer">
            <path className="stem" d="M100 210 C99 140, 101 80, 100 40" />
            <path className="leaf" d="M100 170 C60 150, 40 110, 36 78" />
            <path className="leaf" d="M100 150 C140 132, 160 100, 164 70" />
            <path className="leaf" d="M100 110 C75 95, 62 70, 58 48" />
            <path className="panicle" d="M100 40 C88 34, 78 22, 74 10 M100 40 C112 32, 122 20, 126 8" />
          </g>
        )}
        {family === 'cotton' && (
          <g className="crop-grow-layer">
            <path className="stem" d="M100 210 V70" />
            <path className="leaf" d="M100 140 C70 130, 55 105, 60 80 C78 95, 92 110, 100 120" />
            <path className="leaf" d="M100 140 C130 128, 148 105, 142 78 C124 94, 110 110, 100 120" />
            <circle className="boll" cx="100" cy="58" r="22" />
            <circle className="boll-soft" cx="88" cy="50" r="10" />
            <circle className="boll-soft" cx="112" cy="52" r="9" />
          </g>
        )}
        {family === 'tuber' && (
          <g className="crop-grow-layer">
            <path className="stem" d="M100 210 V95" />
            <path className="leaf" d="M100 120 C72 100, 58 70, 70 48 C86 68, 96 88, 100 100" />
            <path className="leaf" d="M100 120 C128 98, 144 68, 132 46 C116 66, 106 86, 100 100" />
            <ellipse className="tuber" cx="78" cy="190" rx="18" ry="12" />
            <ellipse className="tuber" cx="118" cy="194" rx="16" ry="11" />
          </g>
        )}
        {family === 'pulse' && (
          <g className="crop-grow-layer">
            <path className="stem" d="M100 210 C96 150, 104 100, 100 55" />
            <path className="leaf" d="M100 160 C78 150, 65 130, 62 110" />
            <path className="leaf" d="M100 140 C122 128, 136 108, 140 88" />
            <circle className="pod" cx="78" cy="96" r="8" />
            <circle className="pod" cx="126" cy="78" r="7" />
            <circle className="pod" cx="92" cy="68" r="6" />
          </g>
        )}
        {family === 'plant' && (
          <g className="crop-grow-layer">
            <path className="stem" d="M100 210 C98 140, 102 90, 100 50" />
            <path className="leaf" d="M100 160 C68 145, 48 115, 44 85 C70 105, 88 125, 100 140" />
            <path className="leaf" d="M100 140 C132 125, 152 98, 156 68 C130 90, 112 115, 100 128" />
            <circle className="bloom" cx="100" cy="46" r="16" />
          </g>
        )}
      </svg>
      <div className="crop-silhouette-spark" />
    </div>
  );
}

export default CropSilhouette;
