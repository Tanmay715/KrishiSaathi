import { resolveCropFamily } from '../../utils/field_identity';
import { resolveCropPortraitKey, resolveCropStageBand } from '../../utils/crop_portrait';

function WheatArt({ band }) {
  return (
    <g className="crop-grow-layer">
      <path className="stem" d="M100 210 C98 150, 102 90, 100 48" />
      <path className="leaf" d="M100 150 C70 140, 55 120, 48 100" />
      <path className="leaf" d="M100 130 C130 118, 145 100, 152 82" />
      {band !== 'early' && (
        <>
          <ellipse className="head" cx="100" cy="42" rx="14" ry="28" />
          <path className="awn" d="M92 28 L86 12 M100 24 L100 6 M108 28 L114 12" />
        </>
      )}
      {band === 'early' && <circle className="sprout" cx="100" cy="58" r="6" />}
      {band === 'late' && (
        <path className="grain" d="M94 36h12M92 48h16M94 58h12" opacity="0.55" />
      )}
    </g>
  );
}

function RiceArt({ band }) {
  return (
    <g className="crop-grow-layer">
      <path className="stem" d="M100 210 C99 140, 101 80, 100 40" />
      <path className="leaf" d="M100 170 C60 150, 40 110, 36 78" />
      <path className="leaf" d="M100 150 C140 132, 160 100, 164 70" />
      {band !== 'early' && (
        <path className="leaf" d="M100 110 C75 95, 62 70, 58 48" />
      )}
      {band === 'late' && (
        <path className="panicle" d="M100 40 C88 34, 78 22, 74 10 M100 40 C112 32, 122 20, 126 8" />
      )}
      {band === 'mid' && (
        <path className="panicle" d="M100 48 C92 44, 86 36, 84 28 M100 48 C108 42, 114 34, 116 26" />
      )}
    </g>
  );
}

function CottonArt({ band }) {
  return (
    <g className="crop-grow-layer">
      <path className="stem" d="M100 210 V70" />
      <path className="leaf" d="M100 140 C70 130, 55 105, 60 80 C78 95, 92 110, 100 120" />
      <path className="leaf" d="M100 140 C130 128, 148 105, 142 78 C124 94, 110 110, 100 120" />
      {band === 'mid' && <circle className="boll" cx="100" cy="58" r="14" />}
      {band === 'late' && (
        <>
          <circle className="boll" cx="100" cy="58" r="22" />
          <circle className="boll-soft" cx="88" cy="50" r="10" />
          <circle className="boll-soft" cx="112" cy="52" r="9" />
        </>
      )}
      {band === 'early' && <circle className="sprout" cx="100" cy="72" r="7" />}
    </g>
  );
}

function PotatoArt({ band }) {
  return (
    <g className="crop-grow-layer">
      <path className="stem" d="M100 210 V100" />
      <path className="leaf" d="M100 125 C68 108, 52 78, 64 52 C82 74, 94 96, 100 108" />
      <path className="leaf" d="M100 125 C132 106, 148 76, 136 50 C118 72, 106 94, 100 108" />
      {band !== 'early' && (
        <path className="leaf" d="M100 145 C78 138, 62 122, 58 104" />
      )}
      {band === 'mid' && (
        <>
          <ellipse className="tuber" cx="82" cy="196" rx="12" ry="8" opacity="0.55" />
          <ellipse className="tuber" cx="118" cy="198" rx="11" ry="7" opacity="0.55" />
        </>
      )}
      {band === 'late' && (
        <>
          <ellipse className="tuber" cx="74" cy="192" rx="20" ry="13" />
          <ellipse className="tuber" cx="112" cy="196" rx="18" ry="12" />
          <ellipse className="tuber" cx="96" cy="204" rx="14" ry="9" />
        </>
      )}
      {band === 'early' && <circle className="sprout" cx="100" cy="88" r="7" />}
    </g>
  );
}

function TomatoArt({ band }) {
  return (
    <g className="crop-grow-layer">
      <path className="stem" d="M100 210 V70" />
      <path className="leaf" d="M100 140 C72 128, 58 100, 66 74 C84 92, 94 112, 100 124" />
      <path className="leaf" d="M100 140 C128 126, 144 98, 136 72 C118 90, 108 110, 100 124" />
      {band === 'mid' && (
        <>
          <circle className="bloom" cx="92" cy="62" r="8" />
          <circle className="bloom" cx="112" cy="56" r="7" />
        </>
      )}
      {band === 'late' && (
        <>
          <circle className="fruit" cx="88" cy="58" r="14" />
          <circle className="fruit" cx="116" cy="64" r="12" />
          <circle className="fruit-shine" cx="84" cy="52" r="3.5" />
        </>
      )}
      {band === 'early' && <circle className="sprout" cx="100" cy="78" r="6" />}
    </g>
  );
}

function OnionArt({ band }) {
  return (
    <g className="crop-grow-layer">
      <path className="stem" d="M92 210 C90 140, 88 90, 86 40" />
      <path className="stem" d="M100 210 C100 140, 100 90, 100 36" />
      <path className="stem" d="M108 210 C110 140, 112 90, 114 42" />
      {band !== 'early' && (
        <ellipse className="bulb" cx="100" cy="198" rx={band === 'late' ? 28 : 18} ry={band === 'late' ? 16 : 11} />
      )}
      {band === 'late' && <ellipse className="bulb-ring" cx="100" cy="198" rx="20" ry="10" />}
    </g>
  );
}

function PulseArt({ band }) {
  return (
    <g className="crop-grow-layer">
      <path className="stem" d="M100 210 C96 150, 104 100, 100 55" />
      <path className="leaf" d="M100 160 C78 150, 65 130, 62 110" />
      <path className="leaf" d="M100 140 C122 128, 136 108, 140 88" />
      {band !== 'early' && (
        <>
          <circle className="pod" cx="78" cy="96" r="8" />
          <circle className="pod" cx="126" cy="78" r="7" />
        </>
      )}
      {band === 'late' && <circle className="pod" cx="92" cy="68" r="6" />}
    </g>
  );
}

function PlantArt({ band }) {
  return (
    <g className="crop-grow-layer">
      <path className="stem" d="M100 210 C98 140, 102 90, 100 50" />
      <path className="leaf" d="M100 160 C68 145, 48 115, 44 85 C70 105, 88 125, 100 140" />
      <path className="leaf" d="M100 140 C132 125, 152 98, 156 68 C130 90, 112 115, 100 128" />
      {band !== 'early' && <circle className="bloom" cx="100" cy="46" r={band === 'late' ? 18 : 12} />}
    </g>
  );
}

function CropSilhouette({ crop_name, progress = 40, className = '' }) {
  const family = resolveCropFamily(crop_name);
  const portrait_key = resolveCropPortraitKey(crop_name);
  const band = resolveCropStageBand(progress);
  const growth = Math.max(0.22, Math.min(1, (Number(progress) || 0) / 100));

  let art = <PlantArt band={band} />;
  if (portrait_key === 'potato') art = <PotatoArt band={band} />;
  else if (portrait_key === 'tomato') art = <TomatoArt band={band} />;
  else if (portrait_key === 'onion') art = <OnionArt band={band} />;
  else if (family === 'wheat') art = <WheatArt band={band} />;
  else if (family === 'rice') art = <RiceArt band={band} />;
  else if (family === 'cotton') art = <CottonArt band={band} />;
  else if (family === 'pulse') art = <PulseArt band={band} />;
  else if (family === 'tuber') art = <PotatoArt band={band} />;

  return (
    <div
      className={`crop-silhouette family-${family} stage-${band} key-${portrait_key} ${className}`}
      style={{ '--growth': growth }}
      aria-hidden="true"
    >
      <div className="crop-silhouette-soil" />
      <svg viewBox="0 0 200 220" className="crop-silhouette-svg">
        {art}
      </svg>
      <div className="crop-silhouette-spark" />
    </div>
  );
}

export default CropSilhouette;
