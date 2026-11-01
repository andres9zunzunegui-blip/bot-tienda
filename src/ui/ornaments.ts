/**
 * Ornamentos de FILETEADO PORTEÑO (SVG propio): volutas, hojas de acanto y
 * bandas de color, el lenguaje gráfico de los carteles y colectivos de Buenos Aires.
 */

/** Voluta con hoja para las esquinas de un cartel. */
export const FILETE_CORNER = `<svg viewBox="0 0 120 120" aria-hidden="true">
<g fill="none" stroke-linecap="round">
<path d="M8 112 C8 60 28 22 70 12" stroke="#e8b23a" stroke-width="5"/>
<path d="M14 112 C14 66 34 32 72 22" stroke="#2f8f6b" stroke-width="2.5"/>
<path d="M70 12 C92 6 108 18 102 34 C97 47 80 46 78 36 C76 28 86 25 90 31" stroke="#e8b23a" stroke-width="5"/>
<path d="M30 60 C18 46 26 30 40 34 C50 37 48 50 40 50 C34 50 34 43 39 43" stroke="#e8b23a" stroke-width="4"/>
</g>
<path d="M44 26 C60 2 92 0 112 6 C96 12 86 30 66 34 C58 36 50 33 44 26Z" fill="#b3282d"/>
<path d="M50 27 C64 12 86 10 102 10 C88 16 80 28 64 30 Z" fill="#e05a4f"/>
<path d="M24 78 C6 70 4 52 12 40 C14 56 26 62 34 70 Z" fill="#2f8f6b"/>
<circle cx="90" cy="31" r="4" fill="#6fa8dc"/>
<circle cx="39" cy="43" r="3.5" fill="#6fa8dc"/>
</svg>`;

/** Banda divisoria con rombos, típica de los filetes. */
export const FILETE_BAND = `<svg viewBox="0 0 400 16" preserveAspectRatio="none" aria-hidden="true">
<rect width="400" height="16" fill="#12141c"/>
<rect y="2" width="400" height="2" fill="#e8b23a"/><rect y="12" width="400" height="2" fill="#e8b23a"/>
<g fill="#b3282d">${Array.from({ length: 20 }, (_, i) => `<path d="M${i * 20 + 10} 4 L${i * 20 + 16} 8 L${i * 20 + 10} 12 L${i * 20 + 4} 8Z"/>`).join("")}</g>
<g fill="#6fa8dc">${Array.from({ length: 20 }, (_, i) => `<circle cx="${i * 20}" cy="8" r="1.6"/>`).join("")}</g>
</svg>`;

/** Sello de goma (marco doble con texto) en SVG. */
export function stampSvg(top: string, main: string, color = "#b3282d"): string {
  return `<svg viewBox="0 0 220 110" aria-hidden="true"><g fill="none" stroke="${color}"><rect x="4" y="4" width="212" height="102" rx="10" stroke-width="5"/><rect x="12" y="12" width="196" height="86" rx="6" stroke-width="2"/></g>
<text x="110" y="38" text-anchor="middle" font-family="Special Elite, Courier New, monospace" font-size="15" fill="${color}" letter-spacing="2">${top}</text>
<text x="110" y="78" text-anchor="middle" font-family="Special Elite, Courier New, monospace" font-size="34" font-weight="700" fill="${color}" letter-spacing="3">${main}</text></svg>`;
}
