'use client';

type SwitchAccent = 'emerald' | 'sodalite';

const ACCENT_CLASS: Record<SwitchAccent, string> = {
  emerald: 'peer-checked:bg-[var(--color-emerald)]',
  sodalite: 'peer-checked:bg-[var(--color-sodalite)]',
};

export function Switch({
  checked,
  onChange,
  accent = 'emerald',
  ariaLabel,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  accent?: SwitchAccent;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <label className="relative inline-flex items-center cursor-pointer shrink-0">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div
        className={`w-9 h-5 bg-[var(--color-basalt-500)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[var(--color-text-primary)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--color-text-primary)] after:border-[var(--color-basalt-500)] after:border after:rounded-full after:h-4 after:w-4 after:transition-all ${ACCENT_CLASS[accent]}`}
      />
    </label>
  );
}
