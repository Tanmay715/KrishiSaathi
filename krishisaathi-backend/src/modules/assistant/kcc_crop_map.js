/** Maps farmer crop wording → KCC Crop filter labels on data.gov.in. */
const KCC_CROP_ALIASES = [
  { match: ['wheat', 'गेहूं', 'gehun'], crop: 'Wheat' },
  { match: ['rice', 'paddy', 'dhan', 'धान', 'चावल'], crop: 'Paddy' },
  { match: ['cotton', 'कपास'], crop: 'Cotton' },
  { match: ['sugarcane', 'ganna', 'गन्ना'], crop: 'Sugarcane' },
  { match: ['mustard', 'sarson', 'सरसों'], crop: 'Mustard' },
  { match: ['potato', 'aloo', 'आलू'], crop: 'Potato' },
  { match: ['onion', 'pyaz', 'प्याज'], crop: 'Onion' },
  { match: ['tomato', 'टमाटर'], crop: 'Tomato' },
  { match: ['maize', 'makka', 'मक्का'], crop: 'Maize' },
  { match: ['banana', 'केला', 'kela'], crop: 'Banana' },
  { match: ['coconut', 'नारियल'], crop: 'Coconut' },
  { match: ['pepper', 'black pepper', 'काली मिर्च'], crop: 'Black Pepper' },
  { match: ['cardamom', 'इलायची'], crop: 'Cardamom' },
  { match: ['rubber', 'रबर'], crop: 'Rubber' },
  { match: ['moong', 'mung', 'मूंग'], crop: 'Green Gram' },
  { match: ['chana', 'gram', 'चना'], crop: 'Bengal Gram/Chana' },
  { match: ['soybean', 'soyabean', 'सोयाबीन'], crop: 'Soybean' },
];

function resolveKccCrop(crop_name = '') {
  const normalized = String(crop_name || '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  for (const row of KCC_CROP_ALIASES) {
    if (row.match.some((alias) => normalized.includes(alias))) {
      return row.crop;
    }
  }

  return null;
}

function detectCropsFromText(text = '', preferred_crops = []) {
  const haystack = String(text || '').toLowerCase();
  const found = [];

  preferred_crops.forEach((crop) => {
    const resolved = resolveKccCrop(crop);
    if (resolved && !found.includes(resolved)) {
      found.push(resolved);
    }
  });

  KCC_CROP_ALIASES.forEach((row) => {
    if (row.match.some((alias) => haystack.includes(alias)) && !found.includes(row.crop)) {
      found.push(row.crop);
    }
  });

  return found.slice(0, 3);
}

module.exports = {
  resolveKccCrop,
  detectCropsFromText,
};
