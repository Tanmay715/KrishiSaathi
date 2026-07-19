import { useEffect, useRef } from 'react';

const OTP_LENGTH = 6;

function OtpBoxes({ value, on_change, on_complete, disabled = false, auto_focus = true }) {
  const inputs_ref = useRef([]);
  const digits = String(value || '').padEnd(OTP_LENGTH, ' ').slice(0, OTP_LENGTH).split('');

  useEffect(() => {
    if (auto_focus && !disabled) {
      inputs_ref.current[0]?.focus();
    }
  }, [auto_focus, disabled]);

  function emit(next_digits) {
    const code = next_digits.join('').replace(/\s/g, '');
    on_change(code);
    if (code.length === OTP_LENGTH) {
      on_complete?.(code);
    }
  }

  function updateAt(index, char) {
    const next = digits.map((digit) => (digit === ' ' ? '' : digit));
    next[index] = char;
    while (next.length < OTP_LENGTH) {
      next.push('');
    }
    emit(next.slice(0, OTP_LENGTH));
  }

  function handleChange(index, event) {
    const raw = event.target.value.replace(/\D/g, '');
    if (!raw) {
      updateAt(index, '');
      return;
    }

    if (raw.length > 1) {
      const next = digits.map((digit) => (digit === ' ' ? '' : digit));
      const chars = raw.slice(0, OTP_LENGTH - index).split('');
      chars.forEach((char, offset) => {
        next[index + offset] = char;
      });
      emit(next);
      const focus_index = Math.min(index + chars.length, OTP_LENGTH - 1);
      inputs_ref.current[focus_index]?.focus();
      return;
    }

    updateAt(index, raw);
    if (index < OTP_LENGTH - 1) {
      inputs_ref.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace') {
      const current = digits[index] === ' ' ? '' : digits[index];
      if (!current && index > 0) {
        event.preventDefault();
        updateAt(index - 1, '');
        inputs_ref.current[index - 1]?.focus();
      }
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      inputs_ref.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputs_ref.current[index + 1]?.focus();
    }
  }

  function handlePaste(event) {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) {
      return;
    }
    const next = pasted.split('');
    while (next.length < OTP_LENGTH) {
      next.push('');
    }
    emit(next);
    inputs_ref.current[Math.min(pasted.length, OTP_LENGTH) - 1]?.focus();
  }

  return (
    <div className="otp-boxes" role="group" aria-label="OTP">
      {Array.from({ length: OTP_LENGTH }).map((_, index) => {
        const digit = digits[index] === ' ' ? '' : digits[index];
        return (
          <input
            key={`otp-${index}`}
            ref={(node) => {
              inputs_ref.current[index] = node;
            }}
            className={`otp-box${digit ? ' is-filled' : ''}`}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={index === 0 ? OTP_LENGTH : 1}
            value={digit}
            disabled={disabled}
            onChange={(event) => handleChange(index, event)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            aria-label={`Digit ${index + 1}`}
          />
        );
      })}
    </div>
  );
}

export default OtpBoxes;
export { OTP_LENGTH };
