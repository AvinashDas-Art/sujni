(function () {
  "use strict";

  const root = document.documentElement.getAttribute("data-root") || "";
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const storage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {}
    },
  };

  function toast(message) {
    const el = $("[data-toast]");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2600);
  }

  // ---------- theme ----------
  const themeBtn = $("[data-theme-toggle]");
  function applyTheme(theme) {
    if (theme === "dark") document.documentElement.dataset.theme = "dark";
    else document.documentElement.dataset.theme = "light";
    if (themeBtn) {
      themeBtn.setAttribute("aria-label", theme === "dark" ? "उजला रंग" : "गहरा रंग");
      themeBtn.title = theme === "dark" ? "उजला रंग" : "गहरा रंग";
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#171613" : "#f2ecdf");
  }
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      const next = current === "dark" ? "light" : "dark";
      storage.set("sujni:theme", next);
      applyTheme(next);
    });
    applyTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }

  // ---------- saved ----------
  const savedKey = "sujni:saved";
  const getSaved = () => {
    const v = storage.get(savedKey, []);
    return Array.isArray(v) ? v : [];
  };
  function setSaved(list) {
    storage.set(savedKey, Array.from(new Set(list)));
    paintSaved();
  }
  function toggleSave(slug) {
    const list = getSaved();
    const has = list.includes(slug);
    const next = has ? list.filter((x) => x !== slug) : list.concat(slug);
    setSaved(next);
    toast(has ? "सहेजी गई सूची से हटाया" : "बाद के लिए सहेजा");
  }
  function paintSaved() {
    const list = getSaved();
    $$("[data-save]").forEach((btn) => {
      const on = list.includes(btn.dataset.save);
      btn.classList.toggle("saved", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      if (btn.classList.contains("rail-btn")) {
        const span = btn.querySelector("span");
        if (span) span.textContent = on ? "सहेजा गया" : "सहेजें";
      }
    });
    $$("[data-saved-count]").forEach((el) => {
      el.textContent = String(list.length);
      el.hidden = list.length === 0;
    });
  }
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-save]");
    if (!btn) return;
    e.preventDefault();
    toggleSave(btn.dataset.save);
  });

  // ---------- share ----------
  async function shareArticle() {
    const title = document.title;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: title, url });
        return;
      } catch (e) {}
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("लिंक कॉपी हो गया");
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); toast("लिंक कॉपी हो गया"); } catch (err) { toast("लिंक कॉपी नहीं हो सका"); }
      ta.remove();
    }
  }
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-share]");
    if (!btn) return;
    e.preventDefault();
    shareArticle();
  });

  // ---------- reading progress ----------
  const progress = $("[data-progress]");
  if (progress) {
    const update = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const pct = h > 0 ? Math.min(100, Math.max(0, (window.scrollY / h) * 100)) : 0;
      progress.style.width = pct + "%";
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
  }

  // ---------- font size ----------
  const sizeBtn = $("[data-size-toggle]");
  const articleBody = $("[data-article-body]");
  if (sizeBtn && articleBody) {
    const savedSize = storage.get("sujni:size", "normal");
    if (savedSize === "large") articleBody.classList.add("article-body--lg");
    sizeBtn.addEventListener("click", () => {
      const large = articleBody.classList.toggle("article-body--lg");
      storage.set("sujni:size", large ? "large" : "normal");
      toast(large ? "पाठ बड़ा किया" : "पाठ सामान्य किया");
    });
  }

  // ---------- listen ----------
  const listenBtn = $("[data-listen]");
  if (listenBtn) {
    let speaking = false;
    listenBtn.addEventListener("click", () => {
      if (!("speechSynthesis" in window)) {
        toast("इस ब्राउज़र में सुनने की सुविधा नहीं है");
        return;
      }
      if (speaking) {
        window.speechSynthesis.cancel();
        speaking = false;
        listenBtn.classList.remove("is-playing");
        return;
      }
      const title = $(".article-title") ? $(".article-title").textContent : "";
      const body = articleBody ? articleBody.textContent : "";
      const text = (title + "। " + body).replace(/\s+/g, " ").trim();
      if (!text) return;
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "hi-IN";
      utter.rate = 0.92;
      utter.pitch = 1;
      const voices = window.speechSynthesis.getVoices();
      const hindi = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("hi"));
      if (hindi) utter.voice = hindi;
      utter.onend = () => { speaking = false; listenBtn.classList.remove("is-playing"); };
      utter.onerror = () => { speaking = false; listenBtn.classList.remove("is-playing"); toast("आवाज़ शुरू नहीं हो सकी"); };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
      speaking = true;
      listenBtn.classList.add("is-playing");
      toast("सुनाना शुरू — रोकने के लिए फिर दबाएँ");
    });
  }

  // ---------- search ----------
  const overlay = $("[data-search-overlay]");
  const input = $("[data-search-input]");
  const results = $("[data-search-results]");
  let indexPromise = null;
  let searchIndex = null;

  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(root + "search-index.json", { cache: "no-cache" })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []);
    }
    return indexPromise.then((data) => {
      searchIndex = data;
      return data;
    });
  }
  function normalize(s) {
    return (s || "").toString().toLowerCase().replace(/[\u0900-\u097F]/g, (c) => c).replace(/\s+/g, " ").trim();
  }
  function search(query) {
    const q = normalize(query);
    if (!q || !searchIndex) return [];
    const terms = q.split(" ").filter(Boolean);
    return searchIndex
      .map((a) => {
        const title = normalize(a.title);
        const dek = normalize(a.dek);
        const tags = normalize((a.tags || []).join(" "));
        const sec = normalize(a.sectionName + " " + a.type + " " + a.source);
        let score = 0;
        for (const t of terms) {
          if (title.includes(t)) score += 6;
          if (tags.includes(t)) score += 4;
          if (dek.includes(t)) score += 2;
          if (sec.includes(t)) score += 1;
        }
        if (title.includes(q)) score += 8;
        return { a, score };
      })
      .filter((x) => x.score > 0)
      .sort((x, y) => y.score - x.score)
      .slice(0, 18)
      .map((x) => x.a);
  }
  function renderResults(query) {
    if (!results) return;
    if (!query.trim()) {
      results.innerHTML = `<div class="search-empty">तीन अक्षर लिखिए — सुजनी के सार, स्रोत और धागे खोजिए।</div>`;
      return;
    }
    const found = search(query);
    if (!found.length) {
      results.innerHTML = `<div class="search-empty">“${escapeHtml(query)}” के लिए कुछ नहीं मिला। कोई और शब्द आज़माएँ।</div>`;
      return;
    }
    results.innerHTML = found
      .map(
        (a) => `<a class="search-result" href="${root}${a.url}">
          <div class="sr-kicker">${escapeHtml(a.sectionName)} · ${escapeHtml(a.type)}</div>
          <h3>${escapeHtml(a.title)}</h3>
          <p>${escapeHtml(a.dek)}</p>
        </a>`
      )
      .join("");
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function openSearch(query = "") {
    if (!overlay) return;
    overlay.hidden = false;
    document.body.classList.add("no-scroll");
    loadIndex().then(() => {
      if (input) {
        input.value = query;
        renderResults(query);
        setTimeout(() => input.focus(), 30);
      }
    });
  }
  function closeSearch() {
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove("no-scroll");
    if (input) input.value = "";
    if (results) results.innerHTML = "";
  }
  document.addEventListener("click", (e) => {
    const open = e.target.closest("[data-search-open]");
    if (open) {
      e.preventDefault();
      openSearch("");
      return;
    }
    const close = e.target.closest("[data-search-close]");
    if (close) {
      e.preventDefault();
      closeSearch();
    }
  });
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeSearch();
    });
  }
  if (input) {
    input.addEventListener("input", () => renderResults(input.value));
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay && !overlay.hidden) closeSearch();
    if (e.key === "/" && overlay && overlay.hidden) {
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (!["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
        e.preventDefault();
        openSearch("");
      }
    }
  });
  const q = new URLSearchParams(window.location.search).get("q");
  if (q) {
    openSearch(q);
  }

  // ---------- saved page ----------
  const savedPage = $("[data-saved-page]");
  if (savedPage) {
    loadIndex().then(() => {
      const list = getSaved();
      const items = list
        .map((slug) => (searchIndex || []).find((a) => a.slug === slug))
        .filter(Boolean);
      if (!items.length) {
        savedPage.innerHTML = `<div class="search-empty">अभी कोई टुकड़ा सहेजा नहीं गया। किसी भी लेख पर “सहेजें” दबाएँ।</div>`;
        return;
      }
      savedPage.innerHTML = `<div class="grid-3">${items
        .map(
          (a, i) => `<article class="card">
            <a class="card-art" href="${root}${a.url}"><img src="${root}assets/art/art-${a.slug}.svg" alt="" loading="lazy"></a>
            <p class="kicker">${escapeHtml(a.sectionName)} · ${escapeHtml(a.type)}</p>
            <h3><a href="${root}${a.url}">${escapeHtml(a.title)}</a></h3>
            <p>${escapeHtml(a.dek)}</p>
            <div class="card-foot"><div class="meta"><span class="byline">मूल: ${escapeHtml(a.source)}</span><span class="dot"></span><span>${escapeHtml(a.date)}</span></div><span class="card-num">${String(i + 1).padStart(2, "0")}</span></div>
          </article>`
        )
        .join("")}</div>`;
    });
  }

  paintSaved();

  // ---------- service worker ----------
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      const swUrl = root + "sw.js";
      navigator.serviceWorker.register(swUrl).catch(() => {});
    });
  }
})();
