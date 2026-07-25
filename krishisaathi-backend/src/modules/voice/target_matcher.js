/**
 * Farmers name a plot the way they think of it ("आलू वाले खेत में"), so when the model
 * does not resolve a target we match the spoken words against farm, plot and crop names
 * ourselves, translating common Hindi crop words first.
 */
const CROP_ALIASES = {
  आलू: 'potato',
  गेहूँ: 'wheat',
  गेहूं: 'wheat',
  धान: 'rice',
  चावल: 'rice',
  प्याज: 'onion',
  टमाटर: 'tomato',
  सरसों: 'mustard',
  गन्ना: 'sugarcane',
  कपास: 'cotton',
  मक्का: 'maize',
  चना: 'chana',
  मूँग: 'moong',
  मूंग: 'moong',
  अरहर: 'arhar',
  उड़द: 'urad',
  सोयाबीन: 'soybean',
  बाजरा: 'bajra',
  ज्वार: 'jowar',
  लहसुन: 'garlic',
  मिर्च: 'chilli',
  बैंगन: 'brinjal',
  मूँगफली: 'groundnut',
};

function matchTargetFromSpeech(spoken, targets = []) {
  const haystack = expandSpeech(spoken);

  if (!haystack || !targets.length) {
    return null;
  }

  const match = targets.find((target) => targetNames(target).some((name) => haystack.includes(name)));
  return match?.target_key || null;
}

function targetNames(target) {
  return [target.crop_name, target.plot_name, target.farm_name]
    .filter(Boolean)
    .map((name) => name.toLowerCase().trim())
    .filter((name) => name.length >= 3);
}

function expandSpeech(spoken) {
  const text = String(spoken || '').toLowerCase();

  if (!text) {
    return '';
  }

  const translated = Object.entries(CROP_ALIASES)
    .filter(([hindi]) => text.includes(hindi))
    .map(([, english]) => english);

  return [text, ...translated].join(' ');
}

module.exports = {
  CROP_ALIASES,
  matchTargetFromSpeech,
};
