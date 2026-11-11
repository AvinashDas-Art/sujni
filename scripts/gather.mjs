import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sourceCatalog } from "../data/sources.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "data", "inbox");
const NOW = new Date();
const DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(NOW);

const positive = [
  "cinema", "film", "movie", "documentary", "festival", "theatre", "theater", "play", "stage", "drama",
  "music", "raga", "concert", "album", "song", "musician", "singer", "dance", "kathak", "bharatanatyam",
  "book", "novel", "poetry", "poem", "literature", "writer", "author", "translation", "publisher", "memoir",
  "art", "artist", "painting", "sculpture", "museum", "gallery", "biennale", "exhibition", "photography",
  "culture", "heritage", "archive", "craft", "design", "architecture", "language",
  "सिनेमा", "फ़िल्म", "फिल्म", "नाटक", "रंगमंच", "संगीत", "राग", "कॉन्सर्ट", "एल्बम", "गीत", "कलाकार",
  "किताब", "उपन्यास", "कविता", "साहित्य", "लेखक", "अनुवाद", "प्रकाशक", "संस्मरण", "कला", "चित्रकला",
  "मूर्तिकला", "संग्रहालय", "गैलरी", "बिएनाले", "प्रदर्शनी", "संस्कृति", "विरासत", "शिल्प", "भाषा",
];

const negative = [
  "box office", "collection", "day 1", "day 2", "day 3", "day 4", "day 5", "day 6", "worldwide gross",
  "birthday", "airport look", "vacation", "bigg boss", "reality show", "photos", "viral video", "recipe",
  "भोजपुरी", "बॉक्स ऑफ़िस", "कलेक्शन", "पहले दिन", "दूसरे दिन", "जन्मदिन", "एयरपोर्ट", "बिग बॉस",
  "naxal", "election", "parliament", "assembly", "cricket", "football", "sensex", "stock market", "rupee", "budget", "recruitment", "admit card", "exam result", "weather", "traffic", "accident", "murder", "rape", "theft", "arrest", "police", "court", "protest", "scheme", "yojana", "inaugurat", "launch", "modi", "rahul gandhi", "bjp", "congress",
  "फोटो", "वायरल वीडियो", "रेसिपी", "मंदिर में", "पूजा", "त्योहार की तैयारी", "स्कूल में", "प्रतियोगिता",
];

const sectionWords = {
  cinema: ["film", "cinema", "movie", "documentary", "actor", "director", "screen", "ऑस्कर", "फ़िल्म", "सिनेमा", "निर्देशक"],
  literature: ["book", "novel", "poetry", "literature", "writer", "translation", "memoir", "किताब", "उपन्यास", "कविता", "साहित्य", "अनुवाद"],
  music: ["music", "raga", "concert", "album", "singer", "musician", "संगीत", "राग", "गायक", "कॉन्सर्ट"],
  theatre: ["theatre", "theater", "play", "stage", "drama", "नाटक", "रंगमंच", "थिएटर", "मंच"],
  art: ["art", "artist", "painting", "sculpture", "museum", "gallery", "biennale", "चित्रकला", "कला", "संग्रहालय", "गैलरी"],
};

function decodeEntities(input = "") {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block, names) {
  for (const name of names) {
    const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i");
    const m = block.match(re);
    if (m) return decodeEntities(m[1]);
  }
  return "";
}

function attrLink(block) {
  const m = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  if (m) return m[1];
  const plain = block.match(/<link>([\s\S]*?)<\/link>/i);
  return plain ? decodeEntities(plain[1]) : "";
}

function parseFeed(xml, source) {
  const blocks = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => m[2]);
  const out = [];
  for (const block of blocks) {
    const title = tag(block, ["title"]);
    const link = attrLink(block);
    if (!title || !link) continue;
    const desc = tag(block, ["content:encoded", "description", "summary", "content"]);
    const dateRaw = tag(block, ["pubDate", "published", "updated", "dc:date"]);
    const date = dateRaw ? new Date(dateRaw) : null;
    out.push({
      title: title.replace(/\s+/g, " ").trim(),
      url: link,
      description: desc.slice(0, 1600),
      publishedAt: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
      source: source.name,
      language: source.language,
      sourceSections: source.sections || [],
    });
  }
  return out;
}

function hasWord(text, word) {
  const w = word.toLowerCase();
  if (/^[a-z0-9 ]+$/.test(w)) {
    return new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i").test(text);
  }
  return text.includes(w);
}

function scoreItem(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  let score = 0;
  for (const w of positive) if (hasWord(text, w)) score += 2;
  for (const w of negative) if (hasWord(text, w)) score -= 5;
  if (item.publishedAt) {
    const age = (Date.now() - new Date(item.publishedAt).getTime()) / 86400000;
    if (age <= 2) score += 3;
    else if (age <= 7) score += 1;
  }
  if (item.description.length > 180) score += 1;
  return score;
}

function guessSection(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  let best = item.sourceSections[0] || "cinema";
  let bestScore = 0;
  for (const [section, words] of Object.entries(sectionWords)) {
    let s = item.sourceSections.includes(section) ? 1 : 0;
    for (const w of words) if (text.includes(w.toLowerCase())) s += 1;
    if (s > bestScore) {
      bestScore = s;
      best = section;
    }
  }
  return best;
}

function key(title) {
  return title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

async function fetchOne(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(source.feed, {
      signal: controller.signal,
      headers: {
        "User-Agent": "SujniDesk/1.0 (+https://sujni.com; editorial aggregation)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml,*/*",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return { source, items: parseFeed(xml, source) };
  } catch (e) {
    return { source, items: [], error: e.message };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const feeds = sourceCatalog.filter((s) => s.feed && s.active !== false);
  console.log(`सुजनी डेस्क: ${feeds.length} फ़ीड पढ़ रहे हैं…`);
  const results = [];
  for (let i = 0; i < feeds.length; i += 5) {
    const batch = feeds.slice(i, i + 5);
    results.push(...(await Promise.all(batch.map(fetchOne))));
    await new Promise((r) => setTimeout(r, 250));
  }

  const all = [];
  const seen = new Set();
  for (const r of results) {
    for (const item of r.items) {
      const k = key(item.title);
      if (!k || seen.has(k)) continue;
      const sc = scoreItem(item);
      if (sc < 2) continue;
      seen.add(k);
      all.push({ ...item, section: guessSection(item), score: sc });
    }
  }
  all.sort((a, b) => b.score - a.score || (b.publishedAt || "").localeCompare(a.publishedAt || ""));
  const top = all.slice(0, 80);

  fs.mkdirSync(OUT, { recursive: true });
  const payload = {
    editionDate: DATE,
    generatedAt: NOW.toISOString(),
    feeds: feeds.length,
    fetched: results.reduce((n, r) => n + r.items.length, 0),
    candidates: top,
    failures: results.filter((r) => r.error).map((r) => ({ source: r.source.name, error: r.error })),
  };
  fs.writeFileSync(path.join(OUT, `${DATE}.json`), JSON.stringify(payload, null, 2));
  fs.writeFileSync(path.join(OUT, "latest.json"), JSON.stringify(payload, null, 2));

  const bySection = {};
  for (const item of top) (bySection[item.section] ||= []).push(item);
  const md = [
    `# सुजनी डेस्क — ${DATE}`,
    "",
    `> ${feeds.length} फ़ीड, ${payload.fetched} आइटम, ${top.length} चुनिंदा सुराग। यह सिर्फ़ संपादकीय शॉर्टलिस्ट है; प्रकाशन से पहले हर सार हाथ से लिखा और जाँचा जाता है।`,
    "",
    ...Object.entries(bySection).flatMap(([section, items]) => [
      `## ${section}`,
      "",
      ...items.slice(0, 12).map((x) => `- [${x.title}](${x.url}) — ${x.source}${x.publishedAt ? ` · ${x.publishedAt.slice(0, 10)}` : ""}`),
      "",
    ]),
    `## काम के लिंक`,
    "",
    `- \`npm run gather\` — यह सूची फिर बनाएँ`,
    `- \`npm run build\` — साइट बनाएँ`,
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT, `${DATE}.md`), md);
  fs.writeFileSync(path.join(OUT, "latest.md"), md);

  console.log(`\n${top.length} सुराग → data/inbox/${DATE}.json`);
  if (payload.failures.length) console.log(`फ़ीड विफल: ${payload.failures.map((f) => f.source).join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
