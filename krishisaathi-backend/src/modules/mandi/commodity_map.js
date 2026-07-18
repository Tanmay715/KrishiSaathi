/** Maps KrishiSaathi crop names → AGMARKNET / data.gov.in commodity labels. */
const COMMODITY_ALIASES = [
  { match: ['wheat', 'गेहूं', 'gehun'], commodity: 'Wheat' },
  { match: ['rice', 'paddy', 'dhan', 'धान', 'चावल'], commodity: 'Paddy(Dhan)(Common)' },
  { match: ['cotton', 'कपास'], commodity: 'Cotton' },
  { match: ['sugarcane', 'गन्ना'], commodity: 'Sugarcane' },
  { match: ['mustard', 'sarson', 'सरसों'], commodity: 'Mustard' },
  { match: ['potato', 'aloo', 'आलू'], commodity: 'Potato' },
  { match: ['moong', 'mung', 'green gram', 'मूंग'], commodity: 'Green Gram (Moong)' },
  { match: ['chana', 'gram', 'chickpea', 'चना'], commodity: 'Bengal Gram(Gram)' },
  { match: ['urad', 'urd', 'black gram', 'उड़द'], commodity: 'Black Gram (Urd)' },
  { match: ['arhar', 'tur', 'pigeon', 'अरहर'], commodity: 'Arhar (Tur/Red Gram)' },
  { match: ['masoor', 'lentil', 'मसूर'], commodity: 'Lentil (Masur)' },
  { match: ['maize', 'makka', 'मक्का'], commodity: 'Maize' },
  { match: ['onion', 'pyaz', 'प्याज'], commodity: 'Onion' },
  { match: ['tomato', 'टमाटर'], commodity: 'Tomato' },
  { match: ['soybean', 'soyabean', 'सोयाबीन'], commodity: 'Soyabean' },
];

function resolveCommodity(crop_name = '') {
  const normalized = String(crop_name).trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  for (const row of COMMODITY_ALIASES) {
    if (row.match.some((alias) => normalized.includes(alias) || alias.includes(normalized))) {
      return row.commodity;
    }
  }

  return crop_name.trim();
}

function listKnownCommodities() {
  return COMMODITY_ALIASES.map((row) => row.commodity);
}

module.exports = {
  resolveCommodity,
  listKnownCommodities,
};
