/**
 * Fasalya wordmark — the "y" is a twin-leaf sprout that still reads as Y.
 */
function BrandWordmark({
  className = '',
  size = 'md',
  show_mark = false,
  as: Tag = 'span',
}) {
  return (
    <Tag className={`brand-wordmark brand-wordmark--${size} ${className}`.trim()}>
      {show_mark && (
        <span className="brand-wordmark-badge" aria-hidden="true">
          <SproutMark />
        </span>
      )}
      <span className="brand-wordmark-lockup" aria-label="Fasalya">
        <span className="brand-wordmark-text" aria-hidden="true">
          Fasal
          <span className="brand-wordmark-y">
            <SproutY />
          </span>
          a
        </span>
      </span>
    </Tag>
  );
}

function SproutY() {
  return (
    <svg className="brand-sprout-y" viewBox="0 0 28 36" fill="none" aria-hidden="true">
      <path
        className="brand-sprout-stem"
        d="M14 34V16"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        className="brand-sprout-leaf brand-sprout-leaf--left"
        d="M14 18C14 18 6 15.5 4.2 9.2C2.6 3.6 8.4 2.2 12.8 6.4C14.2 7.8 14 12 14 18Z"
        fill="currentColor"
      />
      <path
        className="brand-sprout-leaf brand-sprout-leaf--right"
        d="M14 18C14 18 22 14.8 23.6 8.6C25 2.8 19.4 1.6 15.2 6.2C13.8 7.8 14 12.2 14 18Z"
        fill="currentColor"
      />
      <circle className="brand-sprout-seed" cx="14" cy="8.5" r="2.1" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

function SproutMark() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" aria-hidden="true">
      <path
        d="M12 20V11"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M12 12C12 12 6.5 10.2 5.2 5.8C4 2 8.2 1.2 11.2 4.4C12.2 5.4 12 8.2 12 12Z"
        fill="currentColor"
      />
      <path
        d="M12 12C12 12 17.5 9.8 18.6 5.4C19.6 1.6 15.6 0.9 12.8 4.2C11.9 5.3 12 8.4 12 12Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default BrandWordmark;
