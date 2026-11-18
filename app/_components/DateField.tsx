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
      <span className="field datefield-display">{display || <span className="muted">dd/mm/yyyy</span>}</span>
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
