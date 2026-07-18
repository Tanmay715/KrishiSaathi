/**
 * Indicative fallback rates (₹/quintal) when live AGMARKNET data is unavailable.
 * Not a substitute for current mandi boards — always labeled as reference.
 */
const REFERENCE_RATES = {
  Wheat: { min: 2200, modal: 2350, max: 2500 },
  'Paddy(Dhan)(Common)': { min: 2100, modal: 2280, max: 2450 },
  Cotton: { min: 5500, modal: 6200, max: 7000 },
  Sugarcane: { min: 300, modal: 340, max: 380 },
  Mustard: { min: 4800, modal: 5200, max: 5600 },
  Potato: { min: 800, modal: 1200, max: 1600 },
  'Green Gram (Moong)': { min: 7000, modal: 7800, max: 8500 },
  'Bengal Gram(Gram)': { min: 4500, modal: 5100, max: 5600 },
  'Black Gram (Urd)': { min: 6500, modal: 7200, max: 8000 },
  'Arhar (Tur/Red Gram)': { min: 6000, modal: 6800, max: 7500 },
  'Lentil (Masur)': { min: 5000, modal: 5600, max: 6200 },
  Maize: { min: 1800, modal: 2000, max: 2200 },
  Onion: { min: 1000, modal: 1600, max: 2500 },
  Tomato: { min: 800, modal: 1400, max: 2200 },
  Soyabean: { min: 4000, modal: 4500, max: 5000 },
};

function getReferenceRate(commodity) {
  return REFERENCE_RATES[commodity] || null;
}

module.exports = {
  REFERENCE_RATES,
  getReferenceRate,
};
