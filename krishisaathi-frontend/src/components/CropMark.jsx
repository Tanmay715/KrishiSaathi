const CROP_MARKS = {
  potato: {
    tone: 'amber',
    paths: (
      <>
        <ellipse cx="12" cy="13.5" rx="6.2" ry="5" />
        <circle cx="9.2" cy="12.2" r="0.7" fill="currentColor" stroke="none" />
        <circle cx="13.5" cy="14.8" r="0.7" fill="currentColor" stroke="none" />
        <circle cx="12" cy="11.4" r="0.55" fill="currentColor" stroke="none" />
      </>
    ),
  },
  wheat: {
    tone: 'gold',
    paths: (
      <>
        <path d="M12 20V8" />
        <path d="M12 10c-2.2-.8-3.4-2.2-3.6-3.8 1.8.1 3.2 1.1 3.6 2.6" />
        <path d="M12 10c2.2-.8 3.4-2.2 3.6-3.8-1.8.1-3.2 1.1-3.6 2.6" />
        <ellipse cx="12" cy="6.2" rx="2.4" ry="3.2" />
      </>
    ),
  },
  onion: {
    tone: 'plum',
    paths: (
      <>
        <path d="M12 20c3.4 0 5.5-2.4 5.5-5.4 0-2.8-1.8-4.6-3.4-5.8L12 6l-2.1 2.8C8.3 10 6.5 11.8 6.5 14.6 6.5 17.6 8.6 20 12 20z" />
        <path d="M10.4 6.2c.5-1.2 1.1-2.2 1.6-2.7.5.5 1.1 1.5 1.6 2.7" />
      </>
    ),
  },
  rice: {
    tone: 'leaf',
    paths: (
      <>
        <path d="M12 20V7" />
        <path d="M12 12C8.8 10.4 7 8 6.8 5.6 9.4 6 11.2 7.6 12 10" />
        <path d="M12 12c3.2-1.6 5-4 5.2-6.4C14.6 6 12.8 7.6 12 10" />
        <path d="M12 8c-1.3-.9-2-2-2.1-3.2.9.2 1.7.8 2.1 1.8" />
      </>
    ),
  },
  tomato: {
    tone: 'tomato',
    paths: (
      <>
        <circle cx="12" cy="13" r="5.5" />
        <path d="M12 7.5C10.8 6.4 9.4 5.8 8.5 5.8c.8 1.1 1.5 2.2 1.8 3.2" />
        <path d="M12 7.5c1.2-1.1 2.6-1.7 3.5-1.7-.8 1.1-1.5 2.2-1.8 3.2" />
      </>
    ),
  },
  mustard: {
    tone: 'gold',
    paths: (
      <>
        <path d="M12 20V10" />
        <circle cx="12" cy="7" r="2.2" />
        <circle cx="8.4" cy="9.2" r="1.6" />
        <circle cx="15.6" cy="9.2" r="1.6" />
      </>
    ),
  },
  moong: {
    tone: 'leaf',
    paths: (
      <>
        <ellipse cx="12" cy="13" rx="4.2" ry="5.4" />
        <path d="M12 7.8V18.2" />
      </>
    ),
  },
  chana: {
    tone: 'sand',
    paths: (
      <>
        <ellipse cx="10" cy="13" rx="3.4" ry="4.2" />
        <ellipse cx="14.4" cy="12.2" rx="3.1" ry="3.8" />
      </>
    ),
  },
  cotton: {
    tone: 'mist',
    paths: (
      <>
        <path d="M12 20V11" />
        <circle cx="12" cy="8" r="3.4" />
        <circle cx="9.2" cy="6.8" r="1.8" />
        <circle cx="14.8" cy="6.8" r="1.8" />
      </>
    ),
  },
  default: {
    tone: 'leaf',
    paths: (
      <>
        <path d="M12 20v-7" />
        <path d="M12 13c-3-1-4.8-3.2-5-5.8C9.6 7.4 11.4 9 12 11.2" />
        <path d="M12 13c3-1 4.8-3.2 5-5.8C14.4 7.4 12.6 9 12 11.2" />
      </>
    ),
  },
};

function resolveCropKey(crop_name = '') {
  const value = String(crop_name).trim().toLowerCase();
  if (!value) return 'default';
  if (value.includes('potato') || value.includes('aloo') || value.includes('आलू')) return 'potato';
  if (value.includes('wheat') || value.includes('gehun') || value.includes('गेहूं')) return 'wheat';
  if (value.includes('onion') || value.includes('pyaz') || value.includes('प्याज')) return 'onion';
  if (value.includes('rice') || value.includes('paddy') || value.includes('dhan') || value.includes('धान')) return 'rice';
  if (value.includes('tomato') || value.includes('टमाटर')) return 'tomato';
  if (value.includes('mustard') || value.includes('sarson') || value.includes('सरसों')) return 'mustard';
  if (value.includes('moong') || value.includes('mung') || value.includes('मूंग')) return 'moong';
  if (value.includes('chana') || value.includes('gram') || value.includes('चना')) return 'chana';
  if (value.includes('cotton') || value.includes('कपास')) return 'cotton';
  return 'default';
}

function CropMark({ crop, size = 36 }) {
  const key = resolveCropKey(crop);
  const mark = CROP_MARKS[key] || CROP_MARKS.default;

  return (
    <span
      className={`crop-mark tone-${mark.tone}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        width={Math.round(size * 0.58)}
        height={Math.round(size * 0.58)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {mark.paths}
      </svg>
    </span>
  );
}

export default CropMark;
export { resolveCropKey };
