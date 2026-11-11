import fs from "node:fs";
import path from "node:path";

const palettes = {
  aamukh: { bg: "#1d2a52", bg2: "#263764", ink: "#f2ecdf", accent: "#c8452b", gold: "#d0ad69", soft: "#8f9bc2" },
  cinema: { bg: "#161f3d", bg2: "#202c53", ink: "#f4eee2", accent: "#cf4a2f", gold: "#d6b16a", soft: "#9ba5c4" },
  literature: { bg: "#e9dfcc", bg2: "#dfd1b9", ink: "#1c1a17", accent: "#a9741f", gold: "#b83a28", soft: "#7d6c50" },
  music: { bg: "#1d2821", bg2: "#26362b", ink: "#eee8d8", accent: "#c9a45b", gold: "#b6402a", soft: "#9caa92" },
  theatre: { bg: "#3a1f25", bg2: "#4a2830", ink: "#f2e7d8", accent: "#c95b45", gold: "#d4ad6b", soft: "#c3a3a2" },
  art: { bg: "#d9c7b0", bg2: "#cdb89e", ink: "#22201c", accent: "#b4492f", gold: "#2d5f5b", soft: "#806b55" },
};

const labels = {
  aamukh: "THE OPENING",
  cinema: "CINEMA",
  literature: "LITERATURE",
  music: "MUSIC",
  theatre: "THEATRE",
  art: "ART",
};

const roman = ["I", "II", "III", "IV", "V", "VI"];

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function texture(p, id) {
  return `
    <pattern id="grain-${id}" width="6" height="6" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.7" fill="${p.ink}" opacity="0.10"/>
      <circle cx="4" cy="4" r="0.5" fill="${p.ink}" opacity="0.06"/>
    </pattern>
    <pattern id="weave-${id}" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
      <path d="M0 9h18" stroke="${p.ink}" stroke-width="0.7" opacity="0.10"/>
      <path d="M9 0v18" stroke="${p.ink}" stroke-width="0.5" opacity="0.06"/>
    </pattern>`;
}

function cornerMarks(p, id) {
  return `
    <g stroke="${p.ink}" stroke-width="2" opacity="0.65">
      <path d="M38 38h22M38 38v22" />
      <path d="M1162 38h-22M1162 38v22" />
      <path d="M38 762h22M38 762v-22" />
      <path d="M1162 762h-22M1162 762v-22" />
    </g>
    <g fill="${p.ink}" opacity="0.55">
      <circle cx="600" cy="38" r="2.2"/><circle cx="600" cy="762" r="2.2"/>
      <circle cx="38" cy="400" r="2.2"/><circle cx="1162" cy="400" r="2.2"/>
    </g>`;
}

function cinemaMotif(p, variant, id) {
  const x = [120, 720, 180, 660][variant];
  const y = [220, 160, 430, 280][variant];
  const stripY = [560, 610, 120, 520][variant];
  const vert = variant === 2;
  const holes = Array.from({ length: 9 }, (_, i) => {
    const hx = vert ? 92 : 80 + i * 120;
    const hy = vert ? 120 + i * 62 : stripY + 26;
    return `<rect x="${hx}" y="${hy}" width="18" height="12" rx="2" fill="${p.bg}" opacity="0.9"/>`;
  }).join("");
  const frames = Array.from({ length: 3 }, (_, i) => {
    if (vert) return `<rect x="76" y="${120 + i * 190}" width="72" height="150" fill="none" stroke="${p.ink}" stroke-width="2" opacity="0.55"/>`;
    return `<rect x="${80 + i * 250}" y="${stripY}" width="230" height="110" fill="none" stroke="${p.ink}" stroke-width="2" opacity="0.5"/>`;
  }).join("");
  return `
    <g opacity="0.95">
      <circle cx="${x + 190}" cy="${y + 110}" r="132" fill="none" stroke="${p.gold}" stroke-width="2" opacity="0.7"/>
      <circle cx="${x + 190}" cy="${y + 110}" r="92" fill="${p.accent}" opacity="0.92"/>
      <circle cx="${x + 190}" cy="${y + 110}" r="46" fill="${p.bg}" opacity="0.55"/>
      <path d="M${x - 20} ${y + 300} L${x + 430} ${y - 40}" stroke="${p.ink}" stroke-width="1.4" opacity="0.4"/>
      <path d="M${x + 30} ${y + 310} L${x + 480} ${y - 30}" stroke="${p.ink}" stroke-width="1.4" opacity="0.25"/>
      ${vert ? `<rect x="72" y="112" width="80" height="560" fill="${p.bg2}" stroke="${p.ink}" stroke-width="2" opacity="0.9"/>` : `<rect x="72" y="${stripY - 8}" width="1056" height="126" fill="${p.bg2}" stroke="${p.ink}" stroke-width="2" opacity="0.9"/>`}
      ${holes}${frames}
      <path d="M80 ${stripY + 126} C260 ${stripY + 80}, 360 ${stripY + 170}, 540 ${stripY + 112} S860 ${stripY + 70}, 1120 ${stripY + 120}" fill="none" stroke="${p.accent}" stroke-width="3" stroke-dasharray="2 10" opacity="0.8"/>
    </g>`;
}

function literatureMotif(p, variant, id) {
  const rot = [-7, 5, -3, 8][variant];
  return `
    <g transform="translate(600 380) rotate(${rot})">
      <rect x="-260" y="-250" width="380" height="500" fill="${p.bg2}" stroke="${p.ink}" stroke-width="2" opacity="0.95"/>
      <rect x="-222" y="-212" width="380" height="500" fill="${p.bg}" stroke="${p.ink}" stroke-width="2"/>
      <rect x="-184" y="-174" width="380" height="500" fill="${p.bg2}" stroke="${p.ink}" stroke-width="2" opacity="0.97"/>
      ${Array.from({ length: 11 }, (_, i) => `<path d="M-140 ${-120 + i * 38}h270" stroke="${p.ink}" stroke-width="${i % 4 === 0 ? 3 : 1.4}" opacity="${i % 4 === 0 ? 0.7 : 0.38}"/>`).join("")}
      <circle cx="90" cy="220" r="70" fill="${p.accent}" opacity="0.9"/>
    </g>
    <path d="M90 660 C260 500, 370 740, 520 560 S780 430, 1110 590" fill="none" stroke="${p.accent}" stroke-width="2.4" stroke-dasharray="3 9" opacity="0.9"/>
    <g fill="${p.ink}" opacity="0.75">
      <path d="M980 150l12 12m0-12l-12 12" stroke="${p.ink}" stroke-width="2"/>
      <path d="M1020 190l12 12m0-12l-12 12" stroke="${p.ink}" stroke-width="2"/>
    </g>`;
}

function musicMotif(p, variant, id) {
  const cx = [360, 820, 470, 740][variant];
  const cy = [370, 330, 420, 360][variant];
  return `
    <g fill="none" stroke="${p.gold}" opacity="0.8">
      ${Array.from({ length: 8 }, (_, i) => `<circle cx="${cx}" cy="${cy}" r="${58 + i * 42}" stroke-width="${i === 3 ? 3 : 1.4}" opacity="${1 - i * 0.09}"/>`).join("")}
    </g>
    <g stroke="${p.ink}" opacity="0.65">
      ${Array.from({ length: 16 }, (_, i) => {
        const x = 120 + i * 64;
        const h = 40 + ((i * 37 + variant * 53) % 150);
        return `<path d="M${x} ${690}h0M${x} ${690 - h}v${h}" stroke-width="2" opacity="${0.3 + (i % 3) * 0.12}"/>`;
      }).join("")}
    </g>
    <g fill="${p.accent}">
      <circle cx="${cx}" cy="${cy}" r="34" opacity="0.95"/>
      <circle cx="${cx + 310}" cy="${cy - 200}" r="11" opacity="0.8"/>
      <circle cx="${cx - 260}" cy="${cy + 180}" r="7" opacity="0.8"/>
    </g>
    <path d="M120 ${cy} C300 ${cy - 150}, 500 ${cy + 140}, 1080 ${cy - 50}" fill="none" stroke="${p.ink}" stroke-width="5" opacity="0.22"/>
    <path d="M120 ${cy + 22} C300 ${cy - 128}, 500 ${cy + 162}, 1080 ${cy - 28}" fill="none" stroke="${p.ink}" stroke-width="1.2" opacity="0.35"/>`;
}

function theatreMotif(p, variant, id) {
  const folds = Array.from({ length: 9 }, (_, i) => {
    const x = 120 + i * 120;
    return `<path d="M${x} 120 C${x - 30} 300, ${x + 40} 520, ${x - 10} 720" stroke="${p.ink}" stroke-width="${i % 2 ? 2 : 4}" opacity="${i % 2 ? 0.22 : 0.4}" fill="none"/>`;
  }).join("");
  const beamX = [560, 680, 440, 760][variant];
  return `
    <rect x="0" y="0" width="1200" height="800" fill="url(#curtain-${id})" opacity="0.55"/>
    ${folds}
    <path d="M${beamX - 20} 0 L${beamX + 250} 800 L${beamX - 250} 800 Z" fill="${p.ink}" opacity="0.09"/>
    <ellipse cx="${beamX}" cy="712" rx="240" ry="34" fill="${p.gold}" opacity="0.28"/>
    <circle cx="${beamX}" cy="330" r="58" fill="none" stroke="${p.gold}" stroke-width="3" opacity="0.9"/>
    <circle cx="${beamX}" cy="330" r="8" fill="${p.accent}"/>
    <path d="M80 746h1040" stroke="${p.ink}" stroke-width="2" opacity="0.6"/>
    <path d="M80 758h1040" stroke="${p.ink}" stroke-width="1" opacity="0.3"/>`;
}

function artMotif(p, variant, id) {
  const cx = [430, 780, 510, 710][variant];
  const cy = [360, 330, 430, 300][variant];
  return `
    <g opacity="0.95">
      <path d="M90 610 C230 430, 300 670, 430 500 S690 280, 840 430 S1010 610, 1120 430" fill="none" stroke="${p.accent}" stroke-width="${34 + variant * 5}" stroke-linecap="round" opacity="0.85"/>
      <path d="M90 660 C250 510, 300 720, 460 560 S720 390, 870 520 S1020 650, 1120 520" fill="none" stroke="${p.gold}" stroke-width="10" opacity="0.7"/>
      <circle cx="${cx}" cy="${cy}" r="105" fill="${p.gold}" opacity="0.9"/>
      <circle cx="${cx}" cy="${cy}" r="70" fill="${p.bg}" opacity="0.55"/>
      <rect x="${cx - 190}" y="${cy + 130}" width="380" height="170" fill="none" stroke="${p.ink}" stroke-width="2" opacity="0.5"/>
      ${Array.from({ length: 8 }, (_, i) => `<path d="M${100 + i * 140} 100l14 14m0-14l-14 14" stroke="${p.ink}" stroke-width="1.4" opacity="0.35"/>`).join("")}
    </g>`;
}

function openingMotif(p, variant, id) {
  const frames = `
    <g>
      <rect x="120" y="470" width="330" height="210" fill="none" stroke="${p.ink}" stroke-width="2" opacity="0.75"/>
      <rect x="750" y="470" width="330" height="210" fill="none" stroke="${p.ink}" stroke-width="2" opacity="0.75"/>
      <path d="M120 470h330v210H120zM750 470h330v210H750z" fill="${p.bg2}" opacity="0.3"/>
      <path d="M280 600 C330 520, 390 670, 450 580" fill="none" stroke="${p.accent}" stroke-width="5"/>
      <path d="M820 610 C900 520, 940 650, 1040 540" fill="none" stroke="${p.gold}" stroke-width="4"/>
      <path d="M160 510h250M160 540h170M790 510h250M790 540h150" stroke="${p.ink}" stroke-width="2" opacity="0.45"/>
    </g>`;
  return `
    <circle cx="600" cy="300" r="168" fill="${p.accent}" opacity="0.95"/>
    <circle cx="600" cy="300" r="212" fill="none" stroke="${p.gold}" stroke-width="2" opacity="0.8"/>
    <circle cx="600" cy="300" r="252" fill="none" stroke="${p.ink}" stroke-width="1" stroke-dasharray="2 10" opacity="0.45"/>
    <path d="M0 430 C220 390, 380 470, 600 430 S980 390, 1200 450 L1200 800 L0 800 Z" fill="${p.bg2}" opacity="0.65"/>
    <path d="M0 470 C220 430, 380 510, 600 470 S980 430, 1200 490" fill="none" stroke="${p.ink}" stroke-width="2" opacity="0.5"/>
    ${frames}
    <path d="M120 380 C300 330, 470 420, 600 380 S900 300, 1080 370" fill="none" stroke="${p.ink}" stroke-width="3" stroke-dasharray="3 10" opacity="0.8"/>
    <g fill="${p.ink}">
      <path d="M600 300l18 18m0-18l-18 18" stroke="${p.ink}" stroke-width="2" opacity="0.45"/>
    </g>`;
}

function makeSvg({ section, index, total, title, seed, kind = "article" }) {
  const p = palettes[section] || palettes.aamukh;
  const id = hash(seed);
  const variant = index % 4;
  const motif =
    section === "cinema" ? cinemaMotif(p, variant, id) :
    section === "literature" ? literatureMotif(p, variant, id) :
    section === "music" ? musicMotif(p, variant, id) :
    section === "theatre" ? theatreMotif(p, variant, id) :
    section === "art" ? artMotif(p, variant, id) :
    openingMotif(p, variant, id);
  const num = String(index + 1).padStart(2, "0");
  const sectionIndex = { aamukh: 1, cinema: 2, literature: 3, music: 4, theatre: 5, art: 6 }[section] || 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800" role="img" aria-label="${escapeXml(labels[section] || "Sujni")}">
  <defs>
    ${texture(p, id)}
    <linearGradient id="bg-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.bg}"/><stop offset="1" stop-color="${p.bg2}"/>
    </linearGradient>
    <pattern id="curtain-${id}" width="22" height="22" patternUnits="userSpaceOnUse">
      <path d="M0 0c8 10 8 12 0 22M11 0c8 10 8 12 0 22" fill="none" stroke="${p.ink}" stroke-width="1" opacity="0.25"/>
    </pattern>
  </defs>
  <rect width="1200" height="800" fill="url(#bg-${id})"/>
  <rect width="1200" height="800" fill="url(#weave-${id})"/>
  <rect width="1200" height="800" fill="url(#grain-${id})"/>
  <g opacity="0.16" fill="${p.ink}" font-family="Georgia, 'Times New Roman', serif">
    <text x="560" y="690" font-size="360" font-weight="700" text-anchor="middle">${num}</text>
  </g>
  ${motif}
  ${cornerMarks(p, id)}
  <g font-family="'Helvetica Neue', Arial, sans-serif" fill="${p.ink}">
    <text x="80" y="86" font-size="17" letter-spacing="5">${kind === "section" ? labels[section] : "SUJNI · " + labels[section]}</text>
    <text x="80" y="112" font-size="12" letter-spacing="3" opacity="0.62">${kind === "section" ? "A DAILY OF ARTS &amp; LETTERS" : "A DAILY OF ARTS &amp; LETTERS"}</text>
    <text x="1120" y="86" text-anchor="end" font-size="16" letter-spacing="3" opacity="0.85">${roman[sectionIndex - 1]} / ${String(sectionIndex).padStart(2, "0")}</text>
    <text x="1120" y="112" text-anchor="end" font-size="12" letter-spacing="3" opacity="0.55">ISSUE 001</text>
  </g>
  <g font-family="'Helvetica Neue', Arial, sans-serif" fill="${p.ink}" opacity="0.78">
    <text x="80" y="736" font-size="12" letter-spacing="4">${escapeXml((title || "").toUpperCase().slice(0, 54))}</text>
    <text x="1120" y="736" text-anchor="end" font-size="12" letter-spacing="3">${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}</text>
  </g>
</svg>`;
}

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]));
}

export function generateArt(articles, sections, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const counts = {};
  for (const a of articles) counts[a.section] = (counts[a.section] || 0) + 1;
  const seen = {};
  for (const a of articles) {
    seen[a.section] = (seen[a.section] || 0);
    const idx = seen[a.section]++;
    const svg = makeSvg({
      section: a.section,
      index: idx,
      total: counts[a.section],
      title: a.title,
      seed: a.slug,
      kind: "article",
    });
    fs.writeFileSync(path.join(outDir, `art-${a.slug}.svg`), svg);
  }
  for (const s of sections) {
    const svg = makeSvg({
      section: s.id,
      index: 0,
      total: counts[s.id] || 1,
      title: s.en,
      seed: `section-${s.id}`,
      kind: "section",
    });
    fs.writeFileSync(path.join(outDir, `section-${s.id}.svg`), svg);
  }
  return counts;
}

export const artPalettes = palettes;
