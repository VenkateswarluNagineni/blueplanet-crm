/**
 * CSS-only stone swatch bases — DESIGN.md Phase E.
 * No stock photos; gradients in `.bp-swatch` provide the vein texture.
 */
export function swatchBaseForMaterial(
  materialType?: string | null,
  baseColor?: string | null,
): string {
  const t = (materialType ?? '').toLowerCase();
  const c = (baseColor ?? '').toLowerCase();

  if (c.includes('white') || c.includes('snow') || c.includes('ivory')) return '#d4cdc2';
  if (c.includes('black') || c.includes('nero') || c.includes('ebony')) return '#2a2826';
  if (c.includes('gold') || c.includes('honey') || c.includes('amber')) return '#a89060';
  if (c.includes('blue') || c.includes('azul') || c.includes('sodalite')) return '#4a6a88';
  if (c.includes('green') || c.includes('emerald') || c.includes('verde')) return '#4a6a55';
  if (c.includes('red') || c.includes('rosso') || c.includes('ruby')) return '#7a4540';
  if (c.includes('grey') || c.includes('gray') || c.includes('silver')) return '#7a7874';
  if (c.includes('beige') || c.includes('cream') || c.includes('taupe')) return '#b5a898';
  if (c.includes('brown') || c.includes('walnut') || c.includes('espresso')) return '#5c4a3a';

  if (t.includes('marble')) return '#c4b8a8';
  if (t.includes('quartzite')) return '#9aa4b0';
  if (t.includes('quartz')) return '#8a9aaa';
  if (t.includes('granite')) return '#5c5346';
  if (t.includes('onyx')) return '#8a7055';
  if (t.includes('travertine')) return '#c2b49a';
  if (t.includes('limestone')) return '#b8b0a0';
  if (t.includes('slate')) return '#4a4e55';
  if (t.includes('porcelain')) return '#a8a6a2';

  return '#6a655c';
}
