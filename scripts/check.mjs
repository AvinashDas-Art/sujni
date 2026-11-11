import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { site, sections } from "../content/site.mjs";
import { articles } from "../content/edition.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
let errors = 0;
const fail = (msg) => { errors++; console.error("✗", msg); };
const ok = (msg) => console.log("✓", msg);

if (!fs.existsSync(DIST)) fail("dist/ नहीं है — पहले npm run build चलाएँ।");
else {
  const slugs = new Set();
  let min = Infinity, max = 0, total = 0;
  for (const a of articles) {
    if (slugs.has(a.slug)) fail(`दोहराया slug: ${a.slug}`);
    slugs.add(a.slug);
    const n = a.summary.join(" ").split(/\s+/).filter(Boolean).length;
    min = Math.min(min, n); max = Math.max(max, n); total += n;
    if (n < 120) fail(`बहुत छोटा सार: ${a.slug} (${n} शब्द)`);
    if (!a.source && !a.isNote) fail(`स्रोत नहीं: ${a.slug}`);
    if (a.source && !/^https?:\/\//.test(a.source.url)) fail(`ग़लत स्रोत URL: ${a.slug}`);
    if (!fs.existsSync(path.join(DIST, "lekh", a.slug, "index.html"))) fail(`लेख पन्ना नहीं: ${a.slug}`);
    if (!fs.existsSync(path.join(DIST, "assets", "art", `art-${a.slug}.svg`))) fail(`चित्र नहीं: ${a.slug}`);
  }
  for (const s of sections) {
    if (!fs.existsSync(path.join(DIST, s.path, "index.html"))) fail(`सेक्शन पन्ना नहीं: ${s.id}`);
  }
  ok(`${articles.length} लेख, ${sections.length} सेक्शन, ${total} शब्द (${min}–${max} प्रति सार)`);

  const files = [];
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".html")) files.push(p);
    }
  }
  walk(DIST);

  for (const file of files) {
    const html = fs.readFileSync(file, "utf8");
    if (!/<meta name="description"/.test(html)) fail(`${path.relative(DIST, file)}: description नहीं`);
    if (!/<link rel="canonical"/.test(html)) fail(`${path.relative(DIST, file)}: canonical नहीं`);
    const attrs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
    for (const attr of attrs) {
      if (!attr || attr.startsWith("#") || attr.startsWith("http") || attr.startsWith("mailto:") || attr.startsWith("tel:") || attr.startsWith("data:") || attr.startsWith("javascript:")) continue;
      if (attr.startsWith("/")) {
        // Absolute paths only make sense on the final custom domain; accept the ones we generate.
        continue;
      }
      const clean = attr.split("#")[0].split("?")[0];
      if (!clean) continue;
      let target = path.resolve(path.dirname(file), clean);
      if (clean.endsWith("/")) target = path.join(target, "index.html");
      if (!fs.existsSync(target)) fail(`${path.relative(DIST, file)} → टूटा लिंक: ${attr}`);
    }
  }
  ok(`${files.length} HTML पन्नों के आंतरिक लिंक जाँचे`);

  for (const f of ["feed.xml", "sitemap.xml", "robots.txt", "manifest.webmanifest", "search-index.json", "assets/og.png"]) {
    if (!fs.existsSync(path.join(DIST, f))) fail(`ज़रूरी फ़ाइल नहीं: ${f}`);
  }
  try {
    const feed = fs.readFileSync(path.join(DIST, "feed.xml"), "utf8");
    if (!feed.includes("<rss") || (feed.match(/<item>/g) || []).length < 10) fail("RSS फ़ीड अधूरी");
    const sitemap = fs.readFileSync(path.join(DIST, "sitemap.xml"), "utf8");
    if (!sitemap.includes("<urlset")) fail("sitemap अधूरा");
    const idx = JSON.parse(fs.readFileSync(path.join(DIST, "search-index.json"), "utf8"));
    if (idx.length !== articles.filter((a) => !a.isNote).length) fail("search-index में लेखों की संख्या ग़लत");
    ok(`RSS, sitemap, search-index ठीक (${idx.length} खोज-प्रविष्टियाँ)`);
  } catch (e) {
    fail("फ़ीड/साइटमैप JSON जाँच विफल: " + e.message);
  }

  if (errors) {
    console.error(`\n${errors} समस्या मिलीं।`);
    process.exit(1);
  }
  console.log("\nसब ठीक। साइट प्रकाशन के लिए तैयार है।");
}
