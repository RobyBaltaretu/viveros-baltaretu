// Genera public/og-imagen.png (1200×630): imagen por defecto al compartir en redes.
// Solo ilustración (persona de 1,8 m junto a una palmera y un olivo), sin textos
// que dependan de datos de la empresa. Ejecutar: node scripts/generar-imagen-og.mjs
import sharp from 'sharp';

const fronda = 'M0 0 C18 -17 46 -18 68 9 C46 -3 21 -3 0 5 Z';
const frondas = [-58, -26, 6, 34]
  .flatMap((a) => [`<path transform="rotate(${a})" d="${fronda}"/>`, `<path transform="scale(-1 1) rotate(${a})" d="${fronda}"/>`])
  .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f7f2e8"/>
  <path d="M0 470 C200 440 400 445 600 470 C800 495 1000 500 1200 470 L1200 630 L0 630 Z" fill="#e9eedc"/>
  <g stroke="#dcd4c2" stroke-width="2" opacity="0.6">
    ${Array.from({ length: 9 }, (_, i) => `<line x1="140" x2="${i % 2 ? 152 : 160}" y1="${520 - i * 48}" y2="${520 - i * 48}"/>`).join('')}
    <line x1="140" x2="140" y1="520" y2="136"/>
  </g>
  <!-- Persona de 1,8 m: escala 1 m = 48 px -->
  <g transform="translate(250 433.6) scale(0.48)" fill="#5a634f">
    <circle cx="28" cy="11.5" r="11"/>
    <path d="M15 27 C20 24 36 24 41 27 C46 30 48 40 49 52 L52 94 L45 95 L41 57 L40 102 L38 180 L30 180 L28.5 110 L27 180 L19 180 L17 102 L16 57 L12 95 L5 94 L8 52 C9 40 10 30 15 27 Z"/>
  </g>
  <!-- Palmera de 8 m -->
  <g transform="translate(470 136) scale(1.4769)">
    <path fill="#5a634f" d="M72 260 C73 205 75 135 77 66 L85 66 C85 135 86 205 90 260 Z"/>
    <g transform="translate(81 64)" fill="#2f4a2c">${frondas}<path transform="rotate(-92)" d="M0 0 C10 -10 30 -10 46 4 C30 -1 14 -1 0 4 Z"/></g>
  </g>
  <!-- Olivo de 5 m -->
  <g transform="translate(820 280) scale(1.0909)">
    <path fill="#5a634f" d="M74 220 C68 196 84 178 76 158 C71 145 60 136 54 118 L62 115 C68 130 76 138 82 148 C85 134 94 122 106 112 L111 118 C100 128 93 142 92 158 C91 180 100 198 96 220 Z"/>
    <g fill="#2f4a2c"><ellipse cx="52" cy="92" rx="34" ry="24"/><ellipse cx="88" cy="66" rx="40" ry="30"/><ellipse cx="124" cy="92" rx="34" ry="24"/><ellipse cx="86" cy="104" rx="30" ry="18"/><ellipse cx="24" cy="108" rx="18" ry="12"/><ellipse cx="150" cy="110" rx="16" ry="11"/><ellipse cx="96" cy="36" rx="22" ry="16"/></g>
  </g>
  <line x1="140" x2="1080" y1="520" y2="520" stroke="#2f4a2c" stroke-width="3"/>
</svg>`;

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile('public/og-imagen.png');
console.log('public/og-imagen.png generada');
