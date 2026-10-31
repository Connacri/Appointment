/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Logos préconfigurés et bibliothèques de styles pour l'établissement
 */

export interface PresetLogo {
  id: string;
  name: string;
  category: string;
  svgDataUrl: string;
}

// Générateur d'icônes vectorielles SVG en Data URL (100% autonome et net à l'impression)
function makeSvgDataUrl(svgInner: string, viewBox = "0 0 100 100"): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100" height="100">${svgInner}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const PRESET_HOTEL_LOGOS: PresetLogo[] = [
  {
    id: 'palace_gold',
    name: 'Palace Royal (Couronne & Or)',
    category: 'Luxe & 5 Étoiles',
    svgDataUrl: makeSvgDataUrl(`
      <rect width="100" height="100" rx="20" fill="#0f172a"/>
      <circle cx="50" cy="50" r="42" fill="none" stroke="#d97706" stroke-width="2" stroke-dasharray="4,2"/>
      <path d="M28 62 L32 40 L42 50 L50 32 L58 50 L68 40 L72 62 Z" fill="#f59e0b" stroke="#b45309" stroke-width="1.5"/>
      <circle cx="50" cy="30" r="3" fill="#fbbf24"/>
      <circle cx="32" cy="38" r="2.5" fill="#fbbf24"/>
      <circle cx="68" cy="38" r="2.5" fill="#fbbf24"/>
      <rect x="28" y="65" width="44" height="6" rx="3" fill="#f59e0b"/>
    `),
  },
  {
    id: 'resort_palms',
    name: 'Resort & Baie (Palmier & Océan)',
    category: 'Resort & Complexe',
    svgDataUrl: makeSvgDataUrl(`
      <rect width="100" height="100" rx="20" fill="#042f2e"/>
      <circle cx="50" cy="50" r="42" fill="none" stroke="#14b8a6" stroke-width="2"/>
      <path d="M50 72 Q50 50 42 36" stroke="#f59e0b" stroke-width="4" stroke-linecap="round" fill="none"/>
      <path d="M42 36 Q30 30 24 38 Q34 40 42 36" fill="#10b981"/>
      <path d="M42 36 Q42 22 52 20 Q48 30 42 36" fill="#10b981"/>
      <path d="M42 36 Q56 26 64 34 Q52 38 42 36" fill="#10b981"/>
      <path d="M42 36 Q32 44 26 50 Q36 48 42 36" fill="#059669"/>
      <path d="M42 36 Q54 44 60 52 Q50 48 42 36" fill="#059669"/>
      <path d="M20 76 Q35 72 50 76 Q65 80 80 76" stroke="#06b6d4" stroke-width="3" stroke-linecap="round" fill="none"/>
    `),
  },
  {
    id: 'modern_crest',
    name: 'Écusson Hôtel de Ville (Prestige)',
    category: 'Hôtel de Ville & Affaires',
    svgDataUrl: makeSvgDataUrl(`
      <rect width="100" height="100" rx="20" fill="#1e1b4b"/>
      <path d="M50 18 L76 28 C76 56 50 78 50 78 C50 78 24 56 24 28 Z" fill="#312e81" stroke="#6366f1" stroke-width="2.5"/>
      <path d="M50 28 L50 68" stroke="#818cf8" stroke-width="1.5" stroke-dasharray="2,2"/>
      <text x="50" y="54" font-family="serif" font-size="26" font-weight="bold" fill="#fbbf24" text-anchor="middle">H</text>
      <circle cx="50" cy="72" r="3" fill="#fbbf24"/>
    `),
  },
  {
    id: 'boutique_monogram',
    name: 'Boutique Monogramme (Minimaliste)',
    category: 'Boutique Hôtel',
    svgDataUrl: makeSvgDataUrl(`
      <rect width="100" height="100" rx="20" fill="#18181b"/>
      <circle cx="50" cy="50" r="38" fill="none" stroke="#e4e4e7" stroke-width="1.5"/>
      <circle cx="50" cy="50" r="34" fill="none" stroke="#a1a1aa" stroke-width="0.8"/>
      <text x="50" y="58" font-family="Georgia, serif" font-size="28" font-weight="normal" letter-spacing="1" fill="#f4f4f5" text-anchor="middle">OM</text>
      <circle cx="50" cy="24" r="2" fill="#d4d4d8"/>
      <circle cx="50" cy="76" r="2" fill="#d4d4d8"/>
    `),
  },
  {
    id: 'star_luxury',
    name: 'Étoile Céleste (5 Étoiles)',
    category: 'Haute Hôtellerie',
    svgDataUrl: makeSvgDataUrl(`
      <rect width="100" height="100" rx="20" fill="#0c0a09"/>
      <circle cx="50" cy="50" r="40" fill="none" stroke="#78716c" stroke-width="1"/>
      <polygon points="50,22 58,40 78,42 63,56 68,76 50,65 32,76 37,56 22,42 42,40" fill="#eab308" stroke="#ca8a04" stroke-width="1"/>
      <circle cx="50" cy="50" r="6" fill="#fef08a"/>
    `),
  },
  {
    id: 'wellness_lotus',
    name: 'Lotus & Spa Clinique (Bien-être)',
    category: 'Santé & Spa de Séjour',
    svgDataUrl: makeSvgDataUrl(`
      <rect width="100" height="100" rx="20" fill="#1e293b"/>
      <circle cx="50" cy="50" r="42" fill="none" stroke="#38bdf8" stroke-width="1.5"/>
      <path d="M50 28 C45 42 30 48 30 62 C38 64 46 58 50 50 C54 58 62 64 70 62 C70 48 55 42 50 28 Z" fill="#0ea5e9"/>
      <path d="M50 42 C46 52 38 56 38 65 C44 66 48 62 50 58 C52 62 56 66 62 65 C62 56 54 52 50 42 Z" fill="#38bdf8" opacity="0.8"/>
      <circle cx="50" cy="72" r="2.5" fill="#7dd3fc"/>
    `),
  },
];
