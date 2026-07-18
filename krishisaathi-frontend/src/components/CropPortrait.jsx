import { useEffect, useState } from 'react';
import CropSilhouette from './illustrations/CropSilhouette';
import { getCropPortraitCandidates } from '../utils/crop_portrait';

function CropPortrait({ crop_name, progress = 40, className = '' }) {
  const candidates = getCropPortraitCandidates(crop_name, progress);
  const [src_index, setSrcIndex] = useState(0);
  const [has_image, setHasImage] = useState(true);

  useEffect(() => {
    setSrcIndex(0);
    setHasImage(true);
  }, [crop_name, progress]);

  const src = candidates[src_index];

  if (!has_image || !src) {
    return (
      <CropSilhouette
        crop_name={crop_name}
        progress={progress}
        className={className}
      />
    );
  }

  return (
    <div className={`crop-portrait ${className}`} aria-hidden="true">
      <img
        key={src}
        src={src}
        alt=""
        className="crop-portrait-img"
        onError={() => {
          if (src_index + 1 < candidates.length) {
            setSrcIndex((prev) => prev + 1);
            return;
          }
          setHasImage(false);
        }}
      />
      <div className="crop-portrait-soil" />
    </div>
  );
}

export default CropPortrait;
