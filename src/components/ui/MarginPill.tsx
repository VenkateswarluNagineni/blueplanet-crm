/** Emerald at/above the 40% healthy-margin line, coral below it; em dash when unknown. */
export function MarginPill({ percent }: { percent: number | null }) {
  if (percent == null) {
    return <span className="text-[var(--color-fog-500)]">—</span>;
  }
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
        percent >= 40
          ? 'bg-[rgba(16,185,129,0.1)] text-[var(--color-emerald)]'
          : 'bg-[rgba(232,149,107,0.1)] text-[var(--color-coral)]'
      }`}
    >
      {percent.toFixed(1)}%
    </span>
  );
}
