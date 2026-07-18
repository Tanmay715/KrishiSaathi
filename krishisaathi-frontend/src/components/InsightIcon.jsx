function InsightIcon({ name = 'sprout' }) {
  const frame = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    'aria-hidden': true,
  };

  if (name === 'rain') {
    return (
      <svg {...frame}>
        <path fill="#38bdf8" d="M8 10a4.5 4.5 0 0 1 8.2-1.8A3.8 3.8 0 0 1 18.5 16H7.2A3.2 3.2 0 0 1 8 10z" />
        <path stroke="#0ea5e9" strokeWidth="1.8" strokeLinecap="round" d="M9 18.5v2M12 19v2.5M15 18.5v2" fill="none" />
      </svg>
    );
  }
  if (name === 'cloud') {
    return (
      <svg {...frame}>
        <path fill="#94a3b8" d="M8.2 11a4.2 4.2 0 0 1 7.8-1.5A3.6 3.6 0 0 1 18.2 17H7.4A3 3 0 0 1 8.2 11z" />
      </svg>
    );
  }
  if (name === 'sun') {
    return (
      <svg {...frame}>
        <circle cx="12" cy="12" r="4" fill="#facc15" />
        <path stroke="#eab308" strokeWidth="1.6" strokeLinecap="round" d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" fill="none" />
      </svg>
    );
  }
  if (name === 'money') {
    return (
      <svg {...frame}>
        <circle cx="12" cy="12" r="8" fill="#34d399" />
        <path stroke="#064e3b" strokeWidth="1.6" strokeLinecap="round" d="M12 8v8M9.8 10.2c.4-.8 1.1-1.2 2.2-1.2 1.3 0 2.1.6 2.1 1.5 0 2-3.4 1.3-3.4 3.3 0 .9.8 1.6 2.1 1.6 1.1 0 1.8-.4 2.2-1.2" fill="none" />
      </svg>
    );
  }
  return (
    <svg {...frame}>
      <path fill="#22c55e" d="M12 19c-3-1.2-5-3.6-5.2-6.8 3 .4 4.8 2.4 5.2 5 .4-2.6 2.2-4.6 5.2-5C17 15.4 15 17.8 12 19z" />
      <path d="M12 19.5V11" stroke="#166534" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <circle cx="12" cy="8.5" r="2" fill="#facc15" />
    </svg>
  );
}

export default InsightIcon;
