import { resolveCropFamily } from './field_identity';

/** Map crop name to a portrait asset key (more specific than silhouette family). */
export function resolveCropPortraitKey(crop_name = '') {
  const name = String(crop_name).toLowerCase();
  if (/potato|आलू|aloo/.test(name)) return 'potato';
  if (/tomato|टमाटर/.test(name)) return 'tomato';
  if (/onion|प्याज/.test(name)) return 'onion';
  if (/wheat|गेहूँ|gehun|barley|जौ/.test(name)) return 'wheat';
  if (/rice|paddy|धान|चावल|basmati/.test(name)) return 'rice';
  if (/cotton|कपास/.test(name)) return 'cotton';
  if (/mustard|सरसों/.test(name)) return 'mustard';
  if (/moong|मूंग/.test(name)) return 'moong';
  if (/chana|चना/.test(name)) return 'chana';
  return resolveCropFamily(crop_name);
}

/** Growth band used to pick stage art. */
export function resolveCropStageBand(progress = 0) {
  const value = Number(progress) || 0;
  if (value < 28) return 'early';
  if (value < 68) return 'mid';
  return 'late';
}

/**
 * Prefer stage-specific art, then mid, then family mid.
 * Assets live in /public/crops/{key}-{band}.jpg
 */
export function getCropPortraitCandidates(crop_name, progress = 0) {
  const key = resolveCropPortraitKey(crop_name);
  const band = resolveCropStageBand(progress);
  const family = resolveCropFamily(crop_name);
  const bands = band === 'early'
    ? ['early', 'mid', 'late']
    : band === 'late'
      ? ['late', 'mid', 'early']
      : ['mid', 'late', 'early'];

  const candidates = [];
  bands.forEach((stage) => {
    candidates.push(`/crops/${key}-${stage}.jpg`);
  });
  if (family !== key) {
    bands.forEach((stage) => {
      candidates.push(`/crops/${family}-${stage}.jpg`);
    });
  }
  return [...new Set(candidates)];
}
