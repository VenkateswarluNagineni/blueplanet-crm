/**
 * Single source of truth for the DESIGN.md accent hexes that get consumed as JS
 * strings (kanban stages, KPI accent tiles, score cells) rather than CSS classes.
 * Literal hex, not `var(--color-*)`, because several call sites string-concat an
 * alpha suffix onto the value (e.g. `${ACCENT.gold}14`) for a tinted background.
 * Keep in sync with the `--color-*` tokens in src/app/globals.css.
 */
export const ACCENT = {
  gold: '#e3c16c',
  sodalite: '#92b0ce',
  emerald: '#10b981',
  coral: '#e8956b',
  amethyst: '#b58cd6',
  ruby: '#ef4444',
  fog: '#b8b6b9',
} as const;
