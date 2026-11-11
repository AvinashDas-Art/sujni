import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { site, sections, sectionById } from "../content/site.mjs";
import { articles as rawArticles } from "../content/edition.mjs";
import { generateArt } from "./art.mjs";
import { sourceCatalog } from "../data/sources.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const SITE_URL = (process.env.SITE_URL || site.url).replace(/\/+$/, "");
const OG_IMAGE = process.env.OG_IMAGE || "https://avinashdas-art.github.io/sujni/assets/og.png";
const BUILD_DATE = new Date();

const sectionOrder = Object.fromEntries(sections.map((s, i) => [s.id, i]));
const articles = [...rawArticles].sort((a, b) => {
  const s = (sectionOrder[a.section] ?? 99) - (sectionOrder[b.section] ?? 99);
  if (s !== 0) return s;
  return (a.order ?? 0) - (b.order ?? 0);
});

// ---------- validation ----------
const slugs = new Set();
for (const a of articles) {
  if (!a.slug || !a.title || !a.section || !Array.isArray(a.summary) || !a.summary.length) {
    throw new Error(`Invalid article: ${a.slug || a.title || "unknown"}`);
  }
  if (!sectionById[a.section]) throw new Error(`Unknown section for ${a.slug}: ${a.section}`);
  if (slugs.has(a.slug)) throw new Error(`Duplicate slug: ${a.slug}`);
  slugs.add(a.slug);
  if (!a.source && !a.isNote) throw new Error(`Missing source for ${a.slug}`);
}
for (const s of sections) {
  if (!articles.some((a) => a.section === s.id)) throw new Error(`Empty section: ${s.id}`);
}

// ---------- helpers ----------
const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const stripHtml = (value = "") => String(value).replace(/<[^>]*>/g, "");

const wordsOf = (a) => a.summary.join(" ").split(/\s+/).filter(Boolean).length;
const minutesOf = (a) => Math.max(3, Math.round(wordsOf(a) / 165));

const bySection = (id) => articles.filter((a) => a.section === id);
const mainOf = (id) => bySection(id).find((a) => !a.isNote) || bySection(id)[0];
const noteOf = (id) => bySection(id).find((a) => a.isNote);

const href = (root, target = "") => root + target;
const articlePath = (a) => `lekh/${a.slug}/`;
const sectionPath = (s) => `${s.path}/`;
const canonical = (target = "") => (target ? `${SITE_URL}/${target}` : `${SITE_URL}/`);

const fmtDate = (a) => (a.source && a.source.published) || site.edition.label;
const sourceLabel = (a) => (a.source ? a.source.name : "सुजनी संपादकीय");
const artOf = (a) => `assets/art/art-${a.slug}.svg`;
const sectionArtOf = (s) => `assets/art/section-${s.id}.svg`;

function readMinutes(a) {
  return `${minutesOf(a)} मिनट`;
}

function art(section, src, alt, cls = "") {
  return `<figure class="art-frame ${cls}"><img src="${src}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" width="1200" height="800"></figure>`;
}

function leadArt(a, root = "") {
  return `<div class="lead-art">${art(a.section, href(root, artOf(a)), `${a.title} — सुजनी चित्रांकन`, "")}<span class="plate-label">सुजनी · चित्रांकन</span></div>`;
}

function meta(a, { showRead = true } = {}) {
  return `<div class="meta">
    <span class="byline">${a.isNote ? "संपादक" : "सुजनी डेस्क"}</span>
    <span class="dot"></span>
    <span>मूल: ${escapeHtml(sourceLabel(a))}</span>
    <span class="dot"></span>
    <span>${escapeHtml(fmtDate(a))}</span>
    ${showRead ? `<span class="dot"></span><span>${readMinutes(a)} पढ़ें</span>` : ""}
  </div>`;
}

function kicker(a) {
  return `<p class="kicker">${escapeHtml(a.kicker || a.type)}</p>`;
}

function renderCard(a, root, index = 0, { headingLevel = "h3" } = {}) {
  const tag = headingLevel;
  return `<article class="card">
    <a class="card-art" href="${href(root, articlePath(a))}" aria-hidden="true" tabindex="-1">
      <img src="${href(root, artOf(a))}" alt="" loading="lazy" decoding="async" width="1200" height="800">
    </a>
    ${kicker(a)}
    <${tag}><a href="${href(root, articlePath(a))}">${escapeHtml(a.title)}</a></${tag}>
    <p>${escapeHtml(a.excerpt)}</p>
    <div class="card-foot">
      ${meta(a, { showRead: true })}
      <span class="card-num">${String(index + 1).padStart(2, "0")}</span>
    </div>
  </article>`;
}

function renderLead(a, root, { reverse = false, headingLevel = "h2" } = {}) {
  const h = headingLevel;
  return `<article class="lead${reverse ? " lead--reverse" : ""}">
    ${leadArt(a, root)}
    <div class="lead-copy">
      ${kicker(a)}
      <${h} class="lead-title"><a href="${href(root, articlePath(a))}">${escapeHtml(a.title)}</a></${h}>
      <p class="lead-dek">${escapeHtml(a.dek)}</p>
      ${meta(a)}
      <a class="arrow-link" href="${href(root, articlePath(a))}"><span>पूरा सार पढ़ें</span><span class="a">→</span></a>
    </div>
  </article>`;
}

function renderHeader(root, { active = "", pageTitle = "" } = {}) {
  const nav = site.nav.map((item) => {
    if (item.id === "archive") return `<a href="${href(root, "puraleikh/")}" ${active === "archive" ? 'aria-current="page"' : ""}>${item.name}</a>`;
    if (item.id === "about") return `<a href="${href(root, "parichay/")}" ${active === "about" ? 'aria-current="page"' : ""}>${item.name}</a>`;
    const s = sectionById[item.id];
    return `<a href="${href(root, sectionPath(s))}" ${active === s.id ? 'aria-current="page"' : ""}><span class="n">${s.number}</span>${item.name}</a>`;
  }).join("");

  return `<a class="skip-link" href="#main">मुख्य सामग्री पर जाएँ</a>
  <header>
    <div class="topbar">
      <div class="wrap topbar-in">
        <div class="date">${escapeHtml(site.edition.label)} · ${escapeHtml(site.edition.note)}</div>
        <div class="mid">स्वतंत्र सांस्कृतिक पत्रकारिता · हिंदी में</div>
        <div class="topbar-actions">
          <button class="text-btn" type="button" data-search-open aria-label="खोजें">खोजें</button>
          <button class="icon-btn" type="button" data-search-open aria-label="खोजें" title="खोजें (/)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 4.2 4.2"/></svg>
          </button>
          <button class="icon-btn" type="button" data-theme-toggle aria-label="रंग बदलें" title="रंग बदलें">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M20 14.3A8.5 8.5 0 0 1 9.7 4a8.5 8.5 0 1 0 10.3 10.3Z"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div class="masthead wrap">
      <div class="masthead-grid">
        <div class="mast-left">
          <strong>अंक ${site.edition.numberHindi}</strong>
          <span>${escapeHtml(site.edition.short)} · ${escapeHtml(site.edition.volume)}</span>
        </div>
        <div class="wordmark-wrap">
          <a class="wordmark" href="${href(root, "")}" aria-label="सुजनी — मुखपृष्ठ">${site.name}</a>
          <p class="wordmark-sub">${escapeHtml(site.tagline)}</p>
        </div>
        <div class="mast-right">
          <span class="latin">SUJNI.COM</span>
          कला · संस्कृति<br>साहित्य · सिनेमा
        </div>
        <div class="mast-seal" aria-hidden="true">इस अंक का<b>आमुख</b></div>
      </div>
      <div class="mast-stitch" aria-hidden="true"></div>
      <div class="tagline">सिनेमा · साहित्य · संगीत · नाटक · चित्रकला</div>
    </div>
    <nav class="mainnav" aria-label="मुख्य नेविगेशन">
      <div class="wrap nav-in">
        <div class="nav-links">${nav}</div>
        <div class="nav-tools">
          <a class="icon-btn saved-link" href="${href(root, "saheje/")}" aria-label="सहेजे गए लेख" title="सहेजे गए">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M6 4.5h12v16l-6-4.4-6 4.4z"/></svg>
            <span class="saved-count" data-saved-count hidden>0</span>
          </a>
          <button class="icon-btn" type="button" data-search-open aria-label="खोजें" title="खोजें (/)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 4.2 4.2"/></svg>
          </button>
        </div>
      </div>
    </nav>
  </header>
  <div class="search-overlay" data-search-overlay hidden>
    <div class="search-panel" role="dialog" aria-modal="true" aria-label="सुजनी में खोजें">
      <div class="search-top">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 4.2 4.2"/></svg>
        <input class="search-input" type="search" placeholder="क्या खोजना है?" aria-label="खोज शब्द" data-search-input autocomplete="off">
        <button class="search-close" type="button" data-search-close>बंद करें</button>
      </div>
      <div class="search-hint">लेख, सेक्शन, कलाकार, फ़िल्म, किताब या स्रोत खोजें · Esc से बंद</div>
      <div class="search-results" data-search-results></div>
    </div>
  </div>
  <div class="reading-progress" aria-hidden="true"><span data-progress></span></div>`;
}

function renderFooter(root) {
  return `<footer class="site-footer">
    <div class="wrap">
      <div class="footer-stitch" aria-hidden="true"></div>
      <div class="footer-top">
        <div>
          <p class="footer-wordmark">${site.name}</p>
          <p class="footer-tag">${escapeHtml(site.tagline)}</p>
        </div>
        <div>
          <p class="footer-note">दुनिया भर की सांस्कृतिक पत्रकारिता से चुने हुए टुकड़े, हिंदी में लंबे सार के साथ। हर सार के साथ मूल स्रोत, उसका लेखक और उसकी भाषा।</p>
          <a class="arrow-link" href="${href(root, "srot/")}" style="color:#ede4d4;border-color:#ede4d4"><span>सुजनी कैसे बनती है</span><span class="a">→</span></a>
        </div>
      </div>
      <div class="footer-cols">
        <div class="footer-col">
          <h4>धागे</h4>
          ${sections.map((s) => `<a href="${href(root, sectionPath(s))}">${s.name}</a>`).join("")}
        </div>
        <div class="footer-col">
          <h4>पत्रिका</h4>
          <a href="${href(root, "parichay/")}">परिचय</a>
          <a href="${href(root, "srot/")}">स्रोत और प्रक्रिया</a>
          <a href="${href(root, "puraleikh/")}">पुरालेख</a>
          <a href="${href(root, "saheje/")}">सहेजे गए</a>
        </div>
        <div class="footer-col">
          <h4>जुड़िए</h4>
          <a href="${href(root, "feed.xml")}">RSS फ़ीड</a>
          <a href="mailto:${site.email}">${site.email}</a>
          <a href="https://github.com/AvinashDas-Art/sujni/issues/new?title=Sujni%20correction" rel="noopener" target="_blank">सुधार भेजें</a>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© 2026 सुजनी · सार सुजनी संपादकीय डेस्क द्वारा लिखे गए हैं। मूल अधिकार मूल प्रकाशकों के पास हैं।</span>
        <span>अंक ${site.edition.numberHindi} · ${escapeHtml(site.edition.label)} <a class="rss" href="${href(root, "feed.xml")}">RSS</a></span>
      </div>
    </div>
  </footer>
  <nav class="bottom-nav" aria-label="फ़ोन नेविगेशन">
    <a href="${href(root, "")}" class="on">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 11 12 4l8 7v9H4z"/></svg>
      <span>आमुख</span>
    </a>
    <a href="${href(root, "sinema/")}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/></svg>
      <span>सिनेमा</span>
    </a>
    <button type="button" data-search-open>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 4.2 4.2"/></svg>
      <span>खोजें</span>
    </button>
    <a href="${href(root, "saheje/")}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M6 4.5h12v16l-6-4.4-6 4.4z"/></svg>
      <span>सहेजे</span>
    </a>
  </nav>`;
}

function layout({
  root,
  title,
  description,
  content,
  active = "",
  canonicalPath = "",
  bodyClass = "",
  ogType = "website",
  jsonLd = null,
}) {
  const fullTitle = title === site.name ? site.title : `${title} — ${site.name}`;
  const desc = description || site.description;
  const canonicalUrl = canonical(canonicalPath);
  const ogImage = OG_IMAGE;
  return `<!doctype html>
<html lang="hi" data-root="${root}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(desc)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <meta name="theme-color" content="#f2ecdf">
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="${site.name}">
  <meta property="og:locale" content="hi_IN">
  <meta property="og:title" content="${escapeHtml(title === site.name ? site.title : title)}">
  <meta property="og:description" content="${escapeHtml(desc)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="सुजनी — अनेक धागों से सीती एक सांस्कृतिक पत्रिका">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title === site.name ? site.title : title)}">
  <meta name="twitter:description" content="${escapeHtml(desc)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  <link rel="alternate" type="application/rss+xml" title="सुजनी" href="${href(root, "feed.xml")}">
  <link rel="icon" href="${href(root, "assets/icons/favicon.svg")}" type="image/svg+xml">
  <link rel="apple-touch-icon" href="${href(root, "assets/icons/icon-192.png")}">
  <link rel="manifest" href="${href(root, "manifest.webmanifest")}">
  <link rel="preload" href="${href(root, "assets/fonts/RozhaOne-Devanagari.woff2")}" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="${href(root, "assets/fonts/NotoSerifDevanagari-Devanagari.woff2")}" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${href(root, "assets/styles.css")}">
  <script>
    (function(){
      try {
        var t = localStorage.getItem("sujni:theme");
        if (!t && window.matchMedia("(prefers-color-scheme: dark)").matches) t = "dark";
        if (t) document.documentElement.dataset.theme = t;
      } catch (e) {}
    })();
  </script>
  ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ""}
</head>
<body class="${bodyClass}">
  ${renderHeader(root, { active })}
  <main id="main">${content}</main>
  ${renderFooter(root)}
  <div class="toast" role="status" aria-live="polite" data-toast></div>
  <script src="${href(root, "assets/app.js")}" defer></script>
</body>
</html>`;
}

// ---------- home ----------
function renderHome() {
  const idea = mainOf("aamukh");
  const note = noteOf("aamukh");
  const issueItems = sections.map((s) => {
    const count = bySection(s.id).length;
    return `<a href="${sectionPath(s)}">
      <span class="n">धागा ${s.number}</span>
      <span class="nm">${s.name}</span>
      <span class="ct">${count} टुकड़े</span>
    </a>`;
  }).join("");

  const sectionBlocks = sections
    .filter((s) => s.id !== "aamukh")
    .map((s, idx) => renderSectionBlock(s, "", idx))
    .join("");

  const content = `
  <section class="home-hero">
    <div class="wrap">
      <div class="hero-eyebrow">
        <span>${escapeHtml(idea.kicker)}</span>
        <span class="issue">अंक ${site.edition.numberHindi} · ${escapeHtml(site.edition.short)}</span>
      </div>
      <div class="hero-grid">
        <div class="hero-copy">
          <h1 class="hero-title">${escapeHtml(idea.title).replace("दो", "<em>दो</em>")}</h1>
          <p class="hero-dek dek">${escapeHtml(idea.dek)}</p>
          <div class="hero-meta">${meta(idea)}</div>
          <div class="hero-actions">
            <a class="btn btn--red" href="lekh/${idea.slug}/">पूरा आमुख पढ़ें <span aria-hidden="true">→</span></a>
            <a class="arrow-link" href="sinema/"><span>आज का सिनेमा</span><span class="a">↓</span></a>
          </div>
        </div>
        <div class="hero-art">
          <div class="art-frame"><img src="assets/art/art-${idea.slug}.svg" alt="आमुख का चित्रांकन — दो सिनेमा" width="1200" height="800"></div>
          <div class="seal"><span>इस अंक का<b>आमुख</b>प्रथम संस्करण</span></div>
          <div class="hero-caption"><span>चित्रांकन: सुजनी</span><span>अंक 001 / आमुख</span></div>
        </div>
      </div>
    </div>
  </section>

  <section class="issue-index" aria-label="इस अंक के धागे">
    <div class="wrap issue-index-in">${issueItems}</div>
  </section>

  <section class="stats-strip" aria-label="इस अंक के आँकड़े">
    <div class="wrap stats-in">
      <div class="stat"><b>२४</b><span>टुकड़े इस अंक में</span></div>
      <div class="stat"><b>६</b><span>सांस्कृतिक धागे</span></div>
      <div class="stat"><b>८</b><span>भाषाओं की दुनिया</span></div>
      <div class="stat"><b>४१</b><span>स्रोत-सूची में</span></div>
    </div>
  </section>

  <section class="note-band">
    <div class="wrap note-grid">
      <div class="note-label">संपादक की कापी<strong>${escapeHtml(note.title)}</strong></div>
      <div class="note-copy">
        <p>${escapeHtml(note.summary[0])}</p>
        <a class="arrow-link" href="lekh/${note.slug}/"><span>पहला धागा पढ़ें</span><span class="a">→</span></a>
      </div>
    </div>
  </section>

  ${sectionBlocks}

  <section class="manifesto-strip">
    <div class="wrap manifesto-in">
      <p>“सतह पर तैरती ख़बरें नहीं; उनके नीचे बहती संस्कृति। हम हर ख़बर नहीं छापते — हम वही छापते हैं जो सांस्कृतिक रूप से ज़रूरी है।”</p>
      <a class="arrow-link" href="parichay/"><span>सुजनी का परिचय</span><span class="a">→</span></a>
    </div>
  </section>`;

  return layout({
    root: "",
    title: site.name,
    description: site.description,
    content,
    active: "home",
    canonicalPath: "",
    bodyClass: "home-page",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "NewsMediaOrganization",
          name: site.name,
          alternateName: "Sujni",
          url: SITE_URL,
          logo: `${SITE_URL}/assets/icons/icon-512.png`,
          email: site.email,
          description: site.description,
        },
        {
          "@type": "WebSite",
          name: site.name,
          url: SITE_URL,
          inLanguage: "hi-IN",
          potentialAction: {
            "@type": "SearchAction",
            target: `${SITE_URL}/khoj/?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        },
      ],
    },
  });
}

function renderSectionBlock(s, root, idx, { page = false } = {}) {
  const list = bySection(s.id).filter((a) => !a.isNote);
  const lead = list[0];
  const rest = list.slice(1);
  const tone = {
    cinema: "section--cinema",
    literature: "section--paper",
    music: "section--music",
    theatre: "section--deep",
    art: "section--art",
  }[s.id] || "section--paper";
  return `<section class="section ${tone}" id="${s.id}" aria-labelledby="${s.id}-title">
    <div class="wrap">
      <div class="section-head">
        <div>
          <div class="section-title-wrap">
            <h2 class="section-title" id="${s.id}-title">${s.name}</h2>
            <span class="section-en">${s.en} · धागा ${s.number}</span>
          </div>
        </div>
        <div class="section-desc">${s.blurb}<span class="count">${list.length} टुकड़े · ${s.note}</span></div>
        <div class="ghost-number" aria-hidden="true">${s.number}</div>
      </div>
      <div class="section-body">
        ${renderLead(lead, root, { reverse: idx % 2 === 1 })}
        ${rest.length ? `<div class="cards">${rest.map((a, i) => renderCard(a, root, i + 1)).join("")}</div>` : ""}
        <div class="section-foot">
          <span class="small">${page ? `इस अंक के सभी ${list.length} टुकड़े` : `धागा ${s.number} · ${s.name}`}</span>
          <a class="arrow-link" href="${href(root, sectionPath(s))}"><span>सभी ${s.name} पढ़ें</span><span class="a">→</span></a>
        </div>
      </div>
    </div>
  </section>`;
}

// ---------- section page ----------
function renderSectionPage(s) {
  const list = bySection(s.id).filter((a) => !a.isNote);
  const note = bySection(s.id).find((a) => a.isNote);
  const lead = list[0];
  const rest = list.slice(1);
  const restGrid = rest.length === 4 ? "grid-2" : "grid-3";
  const totalCount = list.length + (note ? 1 : 0);
  const content = `
  <div class="page-head">
    <div class="wrap page-head-grid">
      <div>
        <div class="page-kicker">धागा ${s.number} · ${s.en}</div>
        <h1 class="page-title">${s.name}</h1>
        <p class="page-dek">${s.blurb}</p>
      </div>
      <div class="page-aside">
        <b>${String(totalCount).padStart(2, "0")}</b>
        टुकड़े इस अंक में
        <span class="seal-line">${escapeHtml(site.edition.label)}</span>
      </div>
    </div>
  </div>
  <div class="listing">
    <div class="wrap">
      ${renderLead(lead, "../", { reverse: false, headingLevel: "h2" })}
      ${rest.length ? `<div class="${restGrid}">${rest.map((a, i) => renderCard(a, "../", i + 1)).join("")}</div>` : ""}
      ${note ? `<div class="grid-2" style="margin-top:38px">${renderCard(note, "../", 0)}</div>` : ""}
    </div>
  </div>`;
  return layout({
    root: "../",
    title: s.name,
    description: `${s.name} — ${s.blurb}`,
    content,
    active: s.id,
    canonicalPath: sectionPath(s),
    bodyClass: "section-page",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${s.name} — सुजनी`,
      url: canonical(sectionPath(s)),
      inLanguage: "hi-IN",
      description: s.blurb,
    },
  });
}

// ---------- article page ----------
function renderArticlePage(a) {
  const s = sectionById[a.section];
  const related = bySection(a.section).filter((x) => x.slug !== a.slug && !x.isNote).slice(0, 3);
  const pool = related.length ? related : articles.filter((x) => x.slug !== a.slug && !x.isNote).slice(0, 3);
  const sourceList = (a.sources && a.sources.length ? a.sources : a.source ? [a.source] : []).filter(Boolean);
  const summaryHtml = a.summary
    .map((p, i) => {
      if (i === 2 && a.pullquote) {
        return `<p>${escapeHtml(p)}</p><blockquote class="article-pull">${escapeHtml(a.pullquote)}</blockquote>`;
      }
      return `<p>${escapeHtml(p)}</p>`;
    })
    .join("");
  const sourceItems = sourceList
    .map(
      (x) => `<li><a href="${escapeHtml(x.url)}" target="_blank" rel="noopener noreferrer">
        <span><strong>${escapeHtml(x.name)}</strong>${x.author ? ` · ${escapeHtml(x.author)}` : ""}${x.published ? ` · ${escapeHtml(x.published)}` : ""}</span>
      </a></li>`
    )
    .join("");
  const side = `
    <aside class="article-side" aria-label="लेख की जानकारी">
      <div class="side-card">
        <h3>मूल लेख</h3>
        ${a.source ? `<p class="source-name">${escapeHtml(a.source.name)}</p>
        <p class="source-meta">${escapeHtml(a.source.author || "")}<br>${escapeHtml(a.source.published || "")}${a.source.language ? ` · ${escapeHtml(a.source.language)}` : ""}</p>
        <a class="btn btn--small btn--ghost" href="${escapeHtml(a.source.url)}" target="_blank" rel="noopener noreferrer">मूल लेख पढ़ें ↗</a>` : `<p class="source-meta">यह टुकड़ा सुजनी के संपादकीय डेस्क ने लिखा है।</p>`}
      </div>
      <div class="side-card">
        <h3>इस अंक में</h3>
        <ul class="side-list">
          ${bySection(a.section)
            .filter((x) => x.slug !== a.slug)
            .slice(0, 4)
            .map((x, i) => `<li><a href="../${x.slug}/"><span class="n">${String(i + 1).padStart(2, "0")}</span>${escapeHtml(x.title)}</a></li>`)
            .join("")}
        </ul>
      </div>
      <div class="side-card">
        <h3>सुजनी</h3>
        <p class="source-meta">सार सुजनी संपादकीय डेस्क ने मूल लेख के आधार पर लिखा है। मूल अधिकार मूल प्रकाशक के पास हैं।</p>
        <a class="btn btn--small btn--ghost" href="../../srot/">हमारी प्रक्रिया</a>
      </div>
    </aside>`;

  const content = `
  <div class="article-head">
    <div class="wrap article-head-in">
      <div class="article-breadcrumb">
        <a href="../../">सुजनी</a><span>/</span><a href="../../${sectionPath(s)}">${s.name}</a><span>/</span><span>${escapeHtml(a.type)}</span>
      </div>
      ${kicker(a)}
      <h1 class="article-title">${escapeHtml(a.title)}</h1>
      <p class="article-dek">${escapeHtml(a.dek)}</p>
      <div class="article-meta">
        ${meta(a, { showRead: false })}
        <div class="article-tools">
          <button class="icon-btn" type="button" data-save="${a.slug}" aria-label="लेख सहेजें" title="सहेजें">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M6 4.5h12v16l-6-4.4-6 4.4z"/></svg>
          </button>
          <button class="icon-btn" type="button" data-share="${a.slug}" aria-label="लेख साझा करें" title="साझा करें">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.3 10.8 7.4-4.3M8.3 13.2l7.4 4.3"/></svg>
          </button>
          <button class="icon-btn" type="button" data-listen aria-label="लेख सुनें" title="सुनें">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/></svg>
          </button>
          <button class="icon-btn" type="button" data-size-toggle aria-label="पाठ का आकार बदलें" title="पाठ का आकार">अ</button>
        </div>
      </div>
    </div>
  </div>
  <figure class="article-art wrap">
    <div class="art-frame"><img src="../../${artOf(a)}" alt="${escapeHtml(a.title)} — सुजनी चित्रांकन" width="1200" height="800"></div>
    <figcaption><span>चित्रांकन: सुजनी · अंक ${site.edition.numberHindi}</span><span>${escapeHtml(a.kicker)}</span></figcaption>
  </figure>
  <div class="article-layout">
    <div class="article-rail" aria-label="लेख के औज़ार">
      <span class="rail-label">इस टुकड़े के साथ</span>
      <button class="rail-btn" type="button" data-save="${a.slug}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M6 4.5h12v16l-6-4.4-6 4.4z"/></svg><span>सहेजें</span>
      </button>
      <button class="rail-btn" type="button" data-share="${a.slug}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.3 10.8 7.4-4.3M8.3 13.2l7.4 4.3"/></svg><span>साझा करें</span>
      </button>
      <span class="rail-note">पढ़ने का समय<br><strong>${readMinutes(a)}</strong></span>
    </div>
    <article class="article-main">
      <div class="summary-flag">
        <strong>सुजनी का लंबा सार</strong>
        <span>${a.isNote ? "संपादकीय" : "मूल लेख के आधार पर, हिंदी में"} · ${readMinutes(a)}</span>
        ${a.source ? `<a href="${escapeHtml(a.source.url)}" target="_blank" rel="noopener noreferrer">मूल लेख ↗</a>` : `<a href="../../parichay/">संपादकीय</a>`}
      </div>
      <div class="article-body" data-article-body>
        ${summaryHtml}
      </div>
      <div class="article-endmark" aria-hidden="true"><span></span></div>
      <div class="article-source-box" id="sources">
        <div class="box-head"><span>स्रोत और आगे पढ़ें</span><span>${sourceList.length} स्रोत</span></div>
        <div class="box-body">
          <h3>${a.source ? escapeHtml(a.source.name) : "सुजनी संपादकीय"}</h3>
          <p>${a.source ? `यह सार ${escapeHtml(a.source.name)} के मूल लेख/लेखों के आधार पर लिखा गया है। भाषा, शैली और निष्कर्ष सुजनी के हैं; तथ्यों के लिए मूल स्रोत देखें।` : "यह टुकड़ा सुजनी के संपादकीय डेस्क ने लिखा है।"}</p>
          ${sourceItems ? `<ul class="source-list">${sourceItems}</ul>` : ""}
          <p class="source-note">सुजनी मूल लेखों को कॉपी नहीं करता; वह उनका संपादित, हिंदी सार प्रकाशित करता है और पाठक को मूल प्रकाशक तक भेजता है। किसी भी सुधार के लिए ${site.email} पर लिखें।</p>
        </div>
      </div>
      <div class="article-tags">
        ${(a.tags || []).map((t) => `<a class="chip" href="../../khoj/?q=${encodeURIComponent(t)}">${escapeHtml(t)}</a>`).join("")}
      </div>
    </article>
    ${side}
  </div>
  <section class="article-related">
    <div class="wrap">
      <div class="section-head">
        <div><h2 class="section-title">आगे पढ़ें</h2><div class="section-en">${s.name} · इसी धागे से</div></div>
        <a class="arrow-link" href="../../${sectionPath(s)}"><span>सभी ${s.name}</span><span class="a">→</span></a>
      </div>
      <div class="grid-3">${pool.map((x, i) => renderCard(x, "../../", i)).join("")}</div>
    </div>
  </section>`;

  return layout({
    root: "../../",
    title: a.title,
    description: a.dek,
    content,
    active: s.id,
    canonicalPath: articlePath(a),
    bodyClass: "article-page",
    ogType: "article",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: a.title,
      description: a.dek,
      inLanguage: "hi-IN",
      datePublished: `${site.edition.date}T06:00:00+05:30`,
      dateModified: `${site.edition.date}T06:00:00+05:30`,
      author: { "@type": "Organization", name: "सुजनी संपादकीय डेस्क" },
      publisher: { "@type": "Organization", name: site.name, logo: { "@type": "ImageObject", url: `${SITE_URL}/assets/icons/icon-512.png` } },
      mainEntityOfPage: canonical(articlePath(a)),
      image: `${SITE_URL}/${artOf(a)}`,
      articleSection: s.name,
      keywords: (a.tags || []).join(", "),
      isBasedOn: a.source ? a.source.url : undefined,
    },
  });
}

// ---------- archive ----------
function renderArchive() {
  const rows = sections
    .flatMap((s) => bySection(s.id).filter((a) => !a.isNote).map((a) => ({ a, s })))
    .map(
      ({ a, s }) => `<a class="archive-row" href="../lekh/${a.slug}/">
        <span class="date">${escapeHtml(fmtDate(a))}</span>
        <span class="sec">${s.name}</span>
        <h3>${escapeHtml(a.title)}</h3>
        <span class="src">${escapeHtml(sourceLabel(a))}</span>
      </a>`
    )
    .join("");
  const content = `
  <div class="page-head">
    <div class="wrap page-head-grid">
      <div>
        <div class="page-kicker">पुरालेख · Archive</div>
        <h1 class="page-title">पुरालेख</h1>
        <p class="page-dek">सुजनी के हर अंक का पूरा रिकॉर्ड। अभी पहला अंक — 24 टुकड़े, छह धागे, एक दिन।</p>
      </div>
      <div class="page-aside"><b>001</b>अंक · ${articles.length} टुकड़े</div>
    </div>
  </div>
  <div class="listing"><div class="wrap"><div class="archive-list">${rows}</div></div></div>`;
  return layout({
    root: "../",
    title: "पुरालेख",
    description: "सुजनी के सभी अंकों का पुरालेख — सिनेमा, साहित्य, संगीत, नाटक और चित्रकला।",
    content,
    active: "archive",
    canonicalPath: "puraleikh/",
  });
}

// ---------- about ----------
function renderAbout() {
  const content = `
  <section class="about-hero">
    <div class="wrap">
      <div class="page-kicker">परिचय · About Sujni</div>
      <h1 class="about-title">सुजनी</h1>
      <p class="about-lead">अनेक धागों से सीती एक सांस्कृतिक पत्रिका — जो हर सुबह दुनिया भर की कला, साहित्य और सिनेमा की पत्रकारिता से वह चुनती है जो सिर्फ़ नया नहीं, ज़रूरी है।</p>
    </div>
  </section>
  <div class="about-body wrap">
    <div>
      <h2>नाम का अर्थ</h2>
      <p class="big-quote">“सुजनी” सुई-धागे से कढ़ाई करने वाली को कहा जाता रहा है। यह पत्रिका भी वही करती है — अलग-अलग भाषाओं, अलग-अलग माध्यमों और अलग-अलग देशों के धागों को एक कपड़े पर सीती है।</p>
    </div>
    <div>
      <h2>हम क्या करते हैं</h2>
      <p>सुजनी एक एग्रीगेटर है, पर ख़बरों का एग्रीगेटर नहीं। हम दुनिया भर की अख़बारी, पत्रिकाओं, फ़िल्म-पत्रिकाओं, कला-जर्नलों और साहित्यिक पन्नों को पढ़ते हैं। फिर उनमें से उन टुकड़ों को चुनते हैं जो किसी कला-रूप, किसी भाषा या किसी सांस्कृतिक बहस को आगे बढ़ाते हैं। हर चुने हुए टुकड़े का हम हिंदी में लंबा, संपादित सार लिखते हैं — और मूल लेख का लिंक देते हैं।</p>
      <p>हमारा मानना है कि अच्छी सांस्कृतिक पत्रकारिता सिर्फ़ ‘क्या हुआ’ नहीं बताती; वह यह भी बताती है कि वह क्यों मायने रखता है, किसकी भाषा में हुआ, और किसे छूट गया। सुजनी उसी सवाल को हिंदी में आगे बढ़ाती है।</p>
      <p>हमारे हर अंक में छह धागे होते हैं — आमुख, सिनेमा, साहित्य, संगीत, नाटक और चित्रकला। क्रम जानबूझकर है: सिनेमा सबसे पहले, क्योंकि वह आज सबसे बड़ी सार्वजनिक कला है; साहित्य उसके बाद, क्योंकि वह सबसे धीमी और सबसे टिकाऊ है।</p>
    </div>
  </div>
  <div class="wrap about-principles">
    <div class="principle"><span class="n">01</span><h3>सतह नहीं</h3><p>सेलिब्रिटी की सुबह, बिना संदर्भ के वायरल वीडियो और सिर्फ़ आँकड़ों का शोर हमारे पन्नों पर जगह नहीं पाता।</p></div>
    <div class="principle"><span class="n">02</span><h3>स्रोत साथ</h3><p>हर टुकड़े के साथ मूल प्रकाशक, लेखक, तारीख़ और भाषा। पाठक जानता है कि बात कहाँ से आई है।</p></div>
    <div class="principle"><span class="n">03</span><h3>भाषा छिपाएँ नहीं</h3><p>जो मराठी, तमिल, मलयालम, बांग्ला, उर्दू या अंग्रेज़ी में लिखा गया है, उसकी भाषा और लेखक हमारे यहाँ दर्ज रहते हैं।</p></div>
  </div>
  <div class="wrap" style="padding-bottom:70px">
    <div class="article-source-box">
      <div class="box-head"><span>संपर्क और सहयोग</span><span>Sujni.com</span></div>
      <div class="box-body">
        <p>सुजनी को पढ़ने, उसके लिए लिखने, या किसी सुधार/सुझाव के लिए लिखें: <a href="mailto:${site.email}" style="text-decoration:underline">${site.email}</a></p>
        <p>हम मूल लेखों का अनुवाद/सार प्रकाशित करते हैं, उन्हें कॉपी नहीं करते। अगर आपको लगता है कि किसी टुकड़े में ग़लती है या किसी अधिकार का उल्लंघन हुआ है, तो हमें लिखें — हम जल्द से जल्द सुधार करेंगे।</p>
        <a class="btn btn--small" href="../srot/">स्रोत और प्रक्रिया पढ़ें</a>
        <a class="btn btn--small" style="margin-left:8px" href="https://github.com/AvinashDas-Art/sujni/issues/new?title=Sujni%20correction" target="_blank" rel="noopener">सुधार भेजें ↗</a>
      </div>
    </div>
  </div>`;
  return layout({
    root: "../",
    title: "परिचय",
    description: "सुजनी — अनेक धागों से सीती एक सांस्कृतिक पत्रिका। जानिए हम क्या करते हैं, कैसे चुनते हैं और स्रोतों के साथ कैसे काम करते हैं।",
    content,
    active: "about",
    canonicalPath: "parichay/",
  });
}

// ---------- sources / method ----------
function renderSources() {
  const groups = ["सिनेमा", "साहित्य", "संगीत", "नाटक", "चित्रकला", "कला-संस्कृति"];
  const list = sourceCatalog
    .filter((s) => s.active !== false)
    .slice(0, 72)
    .map((s) => `<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.name)}<span>${escapeHtml(s.language || "")}</span></a></li>`)
    .join("");
  const content = `
  <div class="page-head">
    <div class="wrap page-head-grid">
      <div>
        <div class="page-kicker">स्रोत और प्रक्रिया · Method</div>
        <h1 class="page-title">हम कैसे पढ़ते हैं</h1>
        <p class="page-dek">सुजनी की कढ़ाई का हर धागा एक स्रोत से आता है। यहाँ हमारी चुनने, लिखने और जोड़ने की प्रक्रिया है — और वे प्रकाशन जिन्हें हम पढ़ते हैं।</p>
      </div>
      <div class="page-aside"><b>${sourceCatalog.length}+</b>स्रोत सूची में</div>
    </div>
  </div>
  <div class="about-body wrap">
    <div>
      <h2>चार कदम</h2>
      <p class="big-quote">पढ़ना → चुनना → लिखना → जोड़ना।</p>
    </div>
    <div>
      <h2>01 / पढ़ना</h2>
      <p>हम हर दिन अख़बारों, पत्रिकाओं, फ़िल्म-पत्रिकाओं, कला-जर्नलों और साहित्यिक पन्नों की सुर्ख़ियाँ और फ़ीड पढ़ते हैं। हमारी स्रोत-सूची में भारत और दुनिया के प्रकाशन हैं, और भारतीय भाषाओं को जानबूझकर ज़्यादा जगह दी जाती है।</p>
      <h2>02 / चुनना</h2>
      <p>हर ख़बर सुजनी के लिए ख़बर नहीं होती। हम पूछते हैं: क्या यह किसी कला-रूप, भाषा, संस्था या सांस्कृतिक बहस को समझने में मदद करता है? क्या इसमें कोई ऐसा विचार है जो सिर्फ़ ‘ट्रेंड’ नहीं, समय का सवाल है? जो सतही है, वह बाहर।</p>
      <h2>03 / लिखना</h2>
      <p>हम मूल लेख का हिंदी में लंबा सार लिखते हैं — तथ्य, संदर्भ, उद्धरण और उस लेख की अपनी दलील के साथ। हम मूल पाठ को कॉपी नहीं करते; हम उसे समझकर फिर से कहते हैं, और जहाँ ज़रूरी हो, मूल लेखक का नाम लेते हैं।</p>
      <h2>04 / जोड़ना</h2>
      <p>हर टुकड़े के साथ मूल स्रोत का लिंक, तारीख़ और भाषा जोड़ी जाती है। पाठक चाहे तो सीधे मूल प्रकाशक तक जा सकता है। सुजनी का काम रास्ता दिखाना है, रास्ता रोकना नहीं।</p>
    </div>
  </div>
  <div class="wrap" style="padding-bottom:60px" id="corrections">
    <div class="article-source-box">
      <div class="box-head"><span>सुधार और अधिकार</span><span>Corrections</span></div>
      <div class="box-body">
        <p>अगर किसी सार में तथ्यात्मक ग़लती है, तो हम उसे सुधारेंगे। अगर किसी प्रकाशक या लेखक को लगता है कि हमारे सार से उनके अधिकार का उल्लंघन हुआ है, तो वे <a href="mailto:${site.email}" style="text-decoration:underline">${site.email}</a> पर लिखें, या <a href="https://github.com/AvinashDas-Art/sujni/issues/new?title=Sujni%20correction" target="_blank" rel="noopener" style="text-decoration:underline">GitHub पर सुधार दर्ज करें</a>। हम मूल लेखों को होस्ट नहीं करते; हम उनका सार और लिंक देते हैं।</p>
        <p>सुजनी के सार सुजनी संपादकीय डेस्क के लेखन हैं। मूल लेखों के सभी अधिकार उनके लेखकों और प्रकाशकों के पास हैं।</p>
      </div>
    </div>
  </div>
  <div class="wrap" style="padding-bottom:80px">
    <div class="section-head"><div><h2 class="section-title" style="font-size:clamp(38px,5vw,62px)">हमारी स्रोत-सूची</h2><div class="section-en">नमूना, पूरी सूची नहीं</div></div></div>
    <ul class="source-list" style="columns:2;column-gap:48px">${list}</ul>
  </div>`;
  return layout({
    root: "../",
    title: "स्रोत और प्रक्रिया",
    description: "सुजनी कैसे स्रोत चुनती है, सार कैसे लिखती है और मूल लेखों के अधिकारों का सम्मान कैसे करती है।",
    content,
    active: "about",
    canonicalPath: "srot/",
  });
}

// ---------- saved page ----------
function renderSaved() {
  const content = `
  <div class="page-head">
    <div class="wrap page-head-grid">
      <div>
        <div class="page-kicker">आपकी कापी · Saved</div>
        <h1 class="page-title">सहेजे गए</h1>
        <p class="page-dek">जो टुकड़े आपने बाद के लिए रखे हैं, वे यहाँ मिलेंगे। यह सूची आपके ब्राउज़र में ही रहती है — हमारे पास नहीं जाती।</p>
      </div>
    </div>
  </div>
  <div class="listing"><div class="wrap"><div data-saved-page><p class="search-empty">अभी कोई टुकड़ा सहेजा नहीं गया। किसी भी लेख पर “सहेजें” दबाएँ।</p></div></div></div>`;
  return layout({
    root: "../",
    title: "सहेजे गए",
    description: "सुजनी में आपके सहेजे गए लेख।",
    content,
    active: "saved",
    canonicalPath: "saheje/",
  });
}

// ---------- search page ----------
function renderSearchPage() {
  const tags = Array.from(new Set(articles.flatMap((a) => a.tags || []))).slice(0, 24);
  const content = `
  <div class="page-head">
    <div class="wrap page-head-grid">
      <div>
        <div class="page-kicker">खोज · Search</div>
        <h1 class="page-title">खोजें</h1>
        <p class="page-dek">सुजनी के सार, स्रोत, कलाकार, फ़िल्में, किताबें और धागे — सब एक जगह। खोजने के लिए नीचे दबाएँ, या किसी भी पन्ने पर “/” दबाएँ।</p>
        <p style="margin-top:22px"><button class="btn btn--red" type="button" data-search-open>खोज शुरू करें <span aria-hidden="true">→</span></button></p>
      </div>
      <div class="page-aside"><b>${articles.filter((a) => !a.isNote).length}</b>टुकड़े खोजने योग्य</div>
    </div>
  </div>
  <div class="listing"><div class="wrap">
    <p class="kicker">लोकप्रिय खोजें</p>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:30px">${tags.map((t) => `<a class="chip" href="?q=${encodeURIComponent(t)}">${escapeHtml(t)}</a>`).join("")}</div>
    <div class="article-source-box"><div class="box-head"><span>सुजनी में क्या है</span><span>अंक 001</span></div><div class="box-body">
      <p>सिनेमा, साहित्य, संगीत, नाटक और चित्रकला पर 24 टुकड़े; हर टुकड़े के साथ मूल स्रोत, लेखक, तारीख़ और भाषा।</p>
      <p>खोज हिंदी और अंग्रेज़ी, दोनों में काम करती है। उदाहरण: “ऑस्कर”, “अनुवाद”, “लावणी”, “अर्पिता सिंह”, “बुकर”।</p>
    </div></div>
  </div></div>`;
  return layout({
    root: "../",
    title: "खोजें",
    description: "सुजनी के सार, स्रोत और धागों में खोजें।",
    content,
    active: "search",
    canonicalPath: "khoj/",
  });
}

// ---------- 404 ----------
function render404() {
  const content = `
  <div class="page-head">
    <div class="wrap" style="padding:50px 0 80px">
      <div class="page-kicker">404 · रास्ता भटक गया</div>
      <h1 class="page-title">यह धागा<br>कहीं और है।</h1>
      <p class="page-dek">जिस पन्ने को आप खोज रहे हैं, वह यहाँ नहीं है। शायद उसका नाम बदल गया, या वह अभी सिला ही नहीं गया।</p>
      <p style="margin-top:24px"><a class="btn btn--red" href="./">मुखपृष्ठ पर लौटें</a> <a class="btn btn--ghost" href="puraleikh/">पुरालेख देखें</a></p>
    </div>
  </div>`;
  return layout({
    root: "",
    title: "पन्ना नहीं मिला",
    description: "यह पन्ना सुजनी पर नहीं है।",
    content,
    active: "",
    canonicalPath: "404.html",
  });
}

// ---------- feed / sitemap / manifest / sw ----------
function renderFeed() {
  const items = articles
    .filter((a) => !a.isNote)
    .map((a) => {
      const link = canonical(articlePath(a));
      const body = a.summary.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
      return `<item>
        <title>${escapeHtml(a.title)}</title>
        <link>${link}</link>
        <guid isPermaLink="true">${link}</guid>
        <pubDate>Wed, 11 Nov 2026 06:00:00 +0530</pubDate>
        <dc:creator>सुजनी संपादकीय डेस्क</dc:creator>
        <category>${escapeHtml(sectionById[a.section].name)}</category>
        <description>${escapeHtml(a.dek)}</description>
        <content:encoded><![CDATA[${body}]]></content:encoded>
      </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${site.name} — ${site.tagline}</title>
    <link>${SITE_URL}/</link>
    <description>${escapeHtml(site.description)}</description>
    <language>hi-IN</language>
    <lastBuildDate>Wed, 11 Nov 2026 06:00:00 +0530</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;
}

function renderSitemap() {
  const entries = [
    { loc: "", priority: "1.0", freq: "daily" },
    ...sections.map((s) => ({ loc: sectionPath(s), priority: "0.9", freq: "daily" })),
    ...articles.map((a) => ({ loc: articlePath(a), priority: "0.8", freq: "weekly" })),
    { loc: "puraleikh/", priority: "0.7", freq: "daily" },
    { loc: "parichay/", priority: "0.5", freq: "monthly" },
    { loc: "srot/", priority: "0.5", freq: "monthly" },
    { loc: "khoj/", priority: "0.4", freq: "monthly" },
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) => `  <url><loc>${canonical(e.loc)}</loc><lastmod>${site.edition.date}</lastmod><changefreq>${e.freq}</changefreq><priority>${e.priority}</priority></url>`
  )
  .join("\n")}
</urlset>`;
}

const manifest = {
  name: "सुजनी — सांस्कृतिक पत्रिका",
  short_name: "सुजनी",
  description: site.description,
  lang: "hi",
  dir: "ltr",
  start_url: "./",
  scope: "./",
  display: "standalone",
  background_color: "#f2ecdf",
  theme_color: "#f2ecdf",
  icons: [
    { src: "assets/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "assets/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "assets/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

const sw = `const CACHE = "sujni-v2";
const BASE = new URL("./", self.location).pathname;
const CORE = [BASE, BASE + "assets/styles.css", BASE + "assets/app.js", BASE + "manifest.webmanifest"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(event.request, copy)); return res; }).catch(() => caches.match(event.request).then((r) => r || caches.match(BASE))));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(event.request, copy)); return res; })));
});`;

const searchIndex = articles
  .filter((a) => !a.isNote)
  .map((a) => ({
    slug: a.slug,
    title: a.title,
    dek: a.dek,
    section: a.section,
    sectionName: sectionById[a.section].name,
    type: a.type,
    source: sourceLabel(a),
    date: fmtDate(a),
    tags: a.tags || [],
    url: articlePath(a),
  }));

// ---------- write ----------
function writeFile(rel, content) {
  const full = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

console.log("Building सुजनी…");
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
copyDir(path.join(ROOT, "assets"), path.join(DIST, "assets"));
generateArt(articles, sections, path.join(DIST, "assets", "art"));

writeFile("index.html", renderHome());
for (const s of sections) {
  writeFile(`${s.path}/index.html`, renderSectionPage(s));
}
for (const a of articles) {
  writeFile(`lekh/${a.slug}/index.html`, renderArticlePage(a));
}
writeFile("puraleikh/index.html", renderArchive());
writeFile("parichay/index.html", renderAbout());
writeFile("srot/index.html", renderSources());
writeFile("saheje/index.html", renderSaved());
writeFile("khoj/index.html", renderSearchPage());
writeFile("404.html", render404());
writeFile("feed.xml", renderFeed());
writeFile("sitemap.xml", renderSitemap());
writeFile("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
writeFile("manifest.webmanifest", JSON.stringify(manifest, null, 2));
writeFile("sw.js", sw);
writeFile("search-index.json", JSON.stringify(searchIndex, null, 2));
if (process.env.CUSTOM_DOMAIN) writeFile("CNAME", process.env.CUSTOM_DOMAIN.trim() + "\n");
writeFile("BUILD.txt", `Built ${BUILD_DATE.toISOString()}\nArticles: ${articles.length}\nSite: ${SITE_URL}\n`);

console.log(`Done: ${articles.length} articles, ${sections.length} sections → dist/`);
console.log(`Home: ${path.join(DIST, "index.html")}`);
