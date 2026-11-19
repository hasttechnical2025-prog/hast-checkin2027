'use client';

/** Ô ngày hiển thị DD/MM/YYYY (native date ẩn opacity-0 đè lên). value = YYYY-MM-DD. */
export default function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const display = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : '';
  return (
    <span className="datefield">
      <span className="field datefield-display">
        {display || <span className="muted">dd/mm/yyyy</span>}
        <svg className="datefield-ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <rect x="3" y="4.5" width="18" height="16" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 9h18M8 2.5v4M16 2.5v4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
      <input
        type="date"
        className="datefield-native"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Chọn ngày"
      />
    </span>
  );
}
