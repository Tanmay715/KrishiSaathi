const ICONS = {
  disease: (
    <>
      <path d="M12 3c2.8 3.2 4.5 6.2 4.5 9.2a4.5 4.5 0 1 1-9 0C7.5 9.2 9.2 6.2 12 3z" />
      <path d="M10.2 14.2c.6.8 1.4 1.3 1.8 1.3s1.2-.5 1.8-1.3" />
      <circle cx="9.2" cy="11.2" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="10.4" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  mandi: (
    <>
      <path d="M4 8h16l-1.2 10.2A2 2 0 0 1 16.8 20H7.2a2 2 0 0 1-2-1.8L4 8z" />
      <path d="M8 8V6.5A4 4 0 0 1 12 2.5 4 4 0 0 1 16 6.5V8" />
      <path d="M9.5 12.5h5M9.5 15.5h5" />
    </>
  ),
  expense: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v8M9.5 10.5C10 9.5 10.8 9 12 9c1.4 0 2.2.7 2.2 1.7 0 2.2-3.7 1.4-3.7 3.6 0 1 .9 1.7 2.3 1.7 1.2 0 2-.5 2.4-1.4" />
    </>
  ),
  income: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 16V8M9 11l3-3 3 3" />
    </>
  ),
  history: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3.2 1.8" />
    </>
  ),
  crop: (
    <>
      <path d="M12 21v-7" />
      <path d="M12 14c-3.2-1-5.2-3.4-5.5-6.2 2.8.2 5 1.8 5.5 4.2" />
      <path d="M12 14c3.2-1 5.2-3.4 5.5-6.2-2.8.2-5 1.8-5.5 4.2" />
      <path d="M8.5 8.5c1.2-2.8 3-4.6 3.5-5.2.5.6 2.3 2.4 3.5 5.2" />
    </>
  ),
};

function SectionIcon({ name, tone = 'default', size = 18 }) {
  const glyph = ICONS[name] || ICONS.crop;

  return (
    <span className={`section-icon tone-${tone}`} aria-hidden="true">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {glyph}
      </svg>
    </span>
  );
}

export default SectionIcon;
