/** Iconos de línea propios (SVG, 24×24, trazo con currentColor). */
const P: Record<string, string> = {
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  city: '<path d="M3 21h18M5 21V9l5-3v15M10 21V4l9 4v13M13 10h3M13 14h3M13 18h3M7 12h1M7 16h1"/>',
  reels: '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 9.5v5l4-2.5z"/>',
  scale: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0zM12 3l-2 2M12 3l2 2"/>',
  network: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><circle cx="12" cy="13" r="2"/><path d="M12 7.5V11M10.4 14.3 6.8 16.4M13.6 14.3l3.6 2.1"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 9v6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  bag: '<path d="M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h1V4zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3h-1V4z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  book: '<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>',
  rain: '<path d="M7 15a5 5 0 1 1 9.6-2H17a3.5 3.5 0 0 1 0 7H7a3 3 0 0 1 0-6"/><path d="M9 21l-1 2M13 21l-1 2"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  volume: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>',
};

export function icon(name: keyof typeof P | string, size = 22): SVGSVGElement {
  const t = document.createElement("template");
  t.innerHTML = `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] ?? P.arrow}</svg>`;
  return t.content.firstChild as SVGSVGElement;
}
