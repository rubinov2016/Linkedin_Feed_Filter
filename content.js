// LinkedIn Feed Filter - content script
// Runs on linkedin.com, watches the feed, evaluates each post against the
// configured filters and collapses / removes the ones that match.

(() => {
  "use strict";

  // --------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------
  let S = null;                       // merged settings
  let modelsReady = null;             // Promise once face-api models are loaded
  const pending = new Set();          // in-flight evaluations (for condense drain)
  const imageCache = new Map();       // url -> Promise<HTMLImageElement|null>
  const avatarGenderCache = new Map();// url -> Promise<{gender, p}|null>
  const stats = { total: 0, hidden: 0 };
  let condenseState = null;           // { running, startedAt, loaded, stop }
  let scanTimer = null;
  let observer = null;

  const log = (...a) => { if (window.LFF_DEBUG) console.log("[LFF]", ...a); };

  // --------------------------------------------------------------------
  // Settings
  // --------------------------------------------------------------------
  function deepMerge(base, over) {
    if (Array.isArray(base)) return Array.isArray(over) ? over : base;
    if (base && typeof base === "object") {
      const out = { ...base };
      if (over && typeof over === "object") {
        for (const k of Object.keys(over)) out[k] = deepMerge(base[k], over[k]);
      }
      return out;
    }
    return over === undefined ? base : over;
  }

  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get("settings", (res) => {
        S = deepMerge(LFF_DEFAULTS, res.settings || {});
        S._maleSet = new Set(S.maleNames.map(norm));
        S._femaleSet = new Set(S.femaleNames.map(norm));
        S._keywords = S.keywords.map((k) => norm(k)).filter(Boolean);
        resolve(S);
      });
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.settings) {
      loadSettings().then(() => resetAll());
    }
  });

  // --------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------
  function norm(s) {
    return (s || "").toString().toLowerCase().replace(/ё/g, "е").trim();
  }
  function txt(el) {
    return el ? (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim() : "";
  }
  function q(root, sel) {
    try { return root.querySelector(sel); } catch { return null; }
  }
  function qa(root, sel) {
    try { return Array.from(root.querySelectorAll(sel)); } catch { return []; }
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function matchesAnyWord(text, words) {
    const t = norm(text);
    return words.some((w) => t.includes(norm(w)));
  }

  function keywordHit(text, mode) {
    const t = norm(text);
    if (!t) return null;
    for (const kw of S._keywords) {
      if (mode === "word") {
        const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp("(^|[^\\p{L}\\p{N}])" + esc + "([^\\p{L}\\p{N}]|$)", "iu");
        if (re.test(t)) return kw;
      } else if (t.includes(kw)) {
        return kw;
      }
    }
    return null;
  }

  // --------------------------------------------------------------------
  // Post extraction
  // --------------------------------------------------------------------
  function extract(post) {
    const sel = S.selectors;
    const titleEl = q(post, sel.actorTitle);
    if (!titleEl) return extractSdui(post);
    const nameEl = q(post, sel.actorName) || titleEl;
    const titleText = txt(titleEl);
    let name = txt(nameEl);

    // pronouns: "(She/Her)", "She/Her", "He/Him/His"
    let pronouns = null;
    const m = titleText.match(/\b(she\/her|he\/him|they\/them|she\/hers|he\/his)\b/i);
    if (m) pronouns = m[1].toLowerCase();
    name = name.replace(/\(?\b(she|he|they)\/[a-z/]+\)?/gi, "").trim();

    const headline = txt(q(post, sel.actorDescription));
    const sub = txt(q(post, sel.actorSub));
    const text = txt(q(post, sel.postText));
    const header = txt(q(post, sel.suggestedMarker));

    let company = "";
    const cm = headline.match(/\s(?:at|@|в|у)\s+(.+)$/i) || headline.match(/\|\s*([^|]+)$/);
    if (cm) company = cm[1].trim();

    const avatarEl = q(post, sel.actorAvatar);
    let avatarUrl = avatarEl ? (avatarEl.getAttribute("src") || avatarEl.getAttribute("data-delayed-url") || "") : "";
    if (avatarUrl && !/^https?:/.test(avatarUrl)) avatarUrl = "";
    // note: dms URLs are signed, so the size token cannot be rewritten; small avatars are upscaled before detection

    let imgEls = qa(post, sel.postImages);
    if (S.photoFilter.includeVideoThumbs) imgEls = imgEls.concat(qa(post, sel.videoThumbs));
    const images = [];
    for (const el of imgEls) {
      let u = el.getAttribute("src") || el.getAttribute("data-delayed-url") || el.getAttribute("data-src") || el.getAttribute("poster") || "";
      if (!/^https?:/.test(u)) continue;
      if (/\/profile-displayphoto|\/company-logo|emoji|\.svg/i.test(u)) continue;
      if (!images.includes(u)) images.push(u);
    }

    return { name, pronouns, headline, sub, text, header, company, avatarUrl, images };
  }

  // 2026 server-driven UI: obfuscated classes, so parse the visible text lines.
  // Layout seen: "Feed post" / [social-proof header] / Name [• 2nd] / [pronouns] /
  // [• 2nd] / headline or "N followers" / [website] / time or "Promoted" / Follow / text…
  function extractSdui(post) {
    const sel = S.selectors;
    const headerEl = q(post, sel.sduiHeader);
    const header = txt(headerEl);
    const textEl = q(post, sel.sduiText);
    const text = txt(textEl);

    let lines = (post.innerText || "").split("\n").map((s) => s.trim()).filter(Boolean);
    // drop everything up to and including the social-proof header line
    if (header) {
      const i = lines.findIndex((l) => l.includes(header));
      if (i >= 0) lines = lines.slice(i + 1);
    }
    lines = lines.filter((l) => !/^feed post$/i.test(l));
    // stop at the post text
    if (text) {
      const firstTextLine = text.split("\n").map((s) => s.trim()).find(Boolean);
      const j = firstTextLine ? lines.findIndex((l) => l.startsWith(firstTextLine.slice(0, 30))) : -1;
      if (j >= 0) lines = lines.slice(0, j);
    }
    lines = lines.slice(0, 10);

    const isDegree = (l) => /^•?\s*(1st|2nd|3rd\+?|\d+(st|nd|rd|th)|you)\b/i.test(l);
    const isPronoun = (l) => /^\(?\s*(she|he|they)\/[a-z/]+\s*\)?$/i.test(l);
    const isTime = (l) => /^\d+\s*(s|m|h|d|w|mo|y|yr|мин|ч|д|нед|мес|г)\.?$/i.test(l) || /^(now|just now)$/i.test(l);
    const isNoise = (l) => /^(follow|following|visit my website|•|•)$/i.test(l) || /followers$/i.test(l);

    let name = "", pronouns = null, headline = "", sub = "";
    let k = 0;
    if (lines[k]) {
      name = lines[k].replace(/\s*•.*$/, "").trim();
      const pm = lines[k].match(/\b(she\/her|he\/him|they\/them)\b/i);
      if (pm) pronouns = pm[1].toLowerCase();
      k++;
    }
    for (; k < lines.length; k++) {
      const l = lines[k];
      if (isPronoun(l)) { pronouns = l.replace(/[()\s]/g, "").toLowerCase(); continue; }
      if (isDegree(l)) continue;
      if (isTime(l)) { sub = l; break; }
      if (matchesAnyWord(l, S.promotedWords) && l.length < 20) { sub = l; break; }
      if (isNoise(l)) continue;
      if (!headline) headline = l;
    }
    if (!sub) {
      const pr = lines.find((l) => l.length < 20 && matchesAnyWord(l, S.promotedWords));
      if (pr) sub = pr;
    }

    let company = "";
    const cm = headline.match(/\s(?:at|@|в|у)\s+(.+)$/i) || headline.match(/\|\s*([^|]+)$/);
    if (cm) company = cm[1].trim();

    const imgs = qa(post, "img");
    const isAvatar = (i) => /profile-displayphoto|company-logo/.test(i.src || "") && i.width >= 36 && i.width <= 72 && !(headerEl && headerEl.closest("a") && headerEl.closest("a").contains(i));
    const avatarImg = imgs.find(isAvatar);
    let avatarUrl = avatarImg ? avatarImg.src : "";

    const images = [];
    for (const i of imgs) {
      const u = i.src || i.getAttribute("data-delayed-url") || "";
      if (!/^https?:/.test(u)) continue;
      if (/profile-displayphoto|company-logo|emoji|\.svg/i.test(u)) continue;
      if (i.width && i.width < 150) continue;
      if (/videocover|video/i.test(u) && !S.photoFilter.includeVideoThumbs) continue;
      if (!images.includes(u)) images.push(u);
    }

    return { name, pronouns, headline, sub, text, header, company, avatarUrl, images };
  }

  // --------------------------------------------------------------------
  // Gender resolution
  // --------------------------------------------------------------------
  function firstName(name) {
    const skip = new Set(["dr", "dr.", "mr", "mr.", "mrs", "ms", "prof", "prof.", "sir", "ing", "ing.", "mba", "phd"]);
    const toks = norm(name).replace(/[^\p{L}\p{M}\s'-]/gu, " ").split(/\s+/).filter(Boolean);
    for (const t of toks) {
      if (skip.has(t)) continue;
      return t.replace(/^[-']+|[-']+$/g, "");
    }
    return "";
  }

  function genderFromText(info) {
    const g = S.genderFilter;
    if (g.usePronouns && info.pronouns) {
      if (info.pronouns.startsWith("she")) return { gender: "female", src: "pronouns" };
      if (info.pronouns.startsWith("he")) return { gender: "male", src: "pronouns" };
      return { gender: "other", src: "pronouns" };
    }
    const fn = firstName(info.name);
    if (fn && g.useNameLists) {
      if (S._femaleSet.has(fn) && !S._maleSet.has(fn)) return { gender: "female", src: "name" };
      if (S._maleSet.has(fn) && !S._femaleSet.has(fn)) return { gender: "male", src: "name" };
    }
    if (fn && g.useRuSuffix && /[Ѐ-ӿ]/.test(fn) && !S._maleSet.has(fn)) {
      if (/(а|я)$/.test(fn)) return { gender: "female", src: "ru-suffix" };
      return { gender: "male", src: "ru-suffix" };
    }
    return { gender: "unknown", src: null };
  }

  async function genderFromAvatar(url) {
    if (!url) return null;
    if (avatarGenderCache.has(url)) return avatarGenderCache.get(url);
    const p = (async () => {
      const img = await getImage(url);
      if (!img) return null;
      const faces = await detectFaces(img, true);
      if (!faces.length) return null;
      const f = faces.sort((a, b) => b.detection.box.area - a.detection.box.area)[0];
      return { gender: f.gender, p: f.genderProbability };
    })().catch(() => null);
    avatarGenderCache.set(url, p);
    return p;
  }

  async function resolveGender(info) {
    const r = genderFromText(info);
    if (r.gender !== "unknown") return r;
    if (S.genderFilter.useAvatarFace && info.avatarUrl) {
      const a = await genderFromAvatar(info.avatarUrl);
      if (a && a.p >= S.genderFilter.avatarMinConfidence) {
        return { gender: a.gender, src: "avatar " + Math.round(a.p * 100) + "%" };
      }
    }
    return r;
  }

  // --------------------------------------------------------------------
  // Images + face detection
  // --------------------------------------------------------------------
  function ensureModels() {
    if (modelsReady) return modelsReady;
    modelsReady = (async () => {
      const base = chrome.runtime.getURL("models");
      await faceapi.nets.tinyFaceDetector.loadFromUri(base);
      await faceapi.nets.ageGenderNet.loadFromUri(base);
      log("models loaded");
    })().catch((e) => { console.warn("[LFF] model load failed", e); modelsReady = null; throw e; });
    return modelsReady;
  }

  let fetchSlots = 2;
  const fetchQueue = [];
  function withSlot(fn) {
    return new Promise((resolve, reject) => {
      const run = async () => {
        fetchSlots--;
        try { resolve(await fn()); } catch (e) { reject(e); }
        finally { fetchSlots++; const n = fetchQueue.shift(); if (n) n(); }
      };
      if (fetchSlots > 0) run(); else fetchQueue.push(run);
    });
  }

  function getImage(url) {
    if (imageCache.has(url)) return imageCache.get(url);
    const p = withSlot(() => new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "fetchImage", url }, (res) => {
        if (chrome.runtime.lastError || !res || !res.ok) return resolve(null);
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = res.dataUrl;
      });
    })).catch(() => null);
    imageCache.set(url, p);
    return p;
  }

  // Returns [{detection, gender, genderProbability}]
  async function detectFaces(img, upscale) {
    await ensureModels();
    let input = img;
    // tiny avatars: upscale so the detector sees a face > 40px
    if (upscale || Math.min(img.naturalWidth, img.naturalHeight) < 200) {
      const side = 320;
      const c = document.createElement("canvas");
      const ratio = Math.max(side / img.naturalWidth, side / img.naturalHeight);
      c.width = Math.round(img.naturalWidth * ratio);
      c.height = Math.round(img.naturalHeight * ratio);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      input = c;
    }
    const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });
    const res = await faceapi.detectAllFaces(input, opts).withAgeAndGender();
    return res || [];
  }

  async function photoCheck(info, authorGender) {
    const pf = S.photoFilter;
    if (!pf.enabled || !info.images.length) return null;
    if (pf.mode === "anyImage") return "Photo post";
    if (pf.mode === "match" && (authorGender === "unknown" || authorGender === "other")) return null;

    const urls = info.images.slice(0, pf.maxImagesPerPost);
    for (const u of urls) {
      const img = await getImage(u);
      if (!img) continue;
      let faces;
      try { faces = await detectFaces(img, false); } catch { return null; }
      if (!faces.length) continue;
      if (pf.mode === "anyFace") return "Photo with a face";
      const hit = faces.find((f) => f.gender === authorGender && f.genderProbability >= pf.faceMinConfidence);
      if (hit) return "Selfie: " + hit.gender + " face " + Math.round(hit.genderProbability * 100) + "% matches author";
    }
    return null;
  }

  // --------------------------------------------------------------------
  // Evaluation
  // --------------------------------------------------------------------
  async function evaluate(post) {
    const info = extract(post);
    if (!info.name && !info.headline && !info.text) return null; // not a real post (yet)

    if (S.hidePromoted && (matchesAnyWord(info.sub, S.promotedWords))) return "Promoted";
    if (S.hideSuggested && (matchesAnyWord(info.header, S.suggestedWords))) return "Suggested";

    if (S.keywordFilter.enabled) {
      const f = S.keywordFilter.fields;
      const checks = [];
      if (f.headline) checks.push(["headline", info.headline]);
      if (f.name) checks.push(["name", info.name]);
      if (f.company) checks.push(["company", info.company]);
      if (f.text) checks.push(["text", info.text]);
      for (const [where, val] of checks) {
        const kw = keywordHit(val, S.keywordFilter.matchMode);
        if (kw) return "Keyword \"" + kw + "\" in " + where;
      }
    }

    let gender = { gender: "unknown", src: null };
    const needGender = S.genderFilter.enabled || (S.photoFilter.enabled && S.photoFilter.mode === "match");
    if (needGender) gender = await resolveGender(info);

    if (S.genderFilter.enabled && S.genderFilter.skip[gender.gender]) {
      return "Gender: " + gender.gender + (gender.src ? " (" + gender.src + ")" : "");
    }

    const photo = await photoCheck(info, gender.gender);
    if (photo) return photo;

    return null;
  }

  function processPost(post) {
    if (post.dataset.lff) return;
    post.dataset.lff = "pending";
    stats.total++;
    const p = evaluate(post)
      .then((reason) => {
        if (post.dataset.lff === "shown") return;
        if (reason) hidePost(post, reason); else post.dataset.lff = "kept";
      })
      .catch((e) => { post.dataset.lff = "kept"; log("eval error", e); })
      .finally(() => { pending.delete(p); updateBadge(); });
    pending.add(p);
  }

  function hidePost(post, reason) {
    post.dataset.lff = "hidden";
    post.dataset.lffReason = reason;
    stats.hidden++;
    post.classList.add("lff-hidden-post");
    const mode = condenseState ? S.condense.resultMode : S.hideMode;
    if (mode === "collapse") {
      const stub = document.createElement("div");
      stub.className = "lff-stub";
      stub.innerHTML = '<span class="lff-stub-reason"></span><a>show</a>';
      stub.querySelector(".lff-stub-reason").textContent = "Hidden – " + reason;
      stub.querySelector("a").addEventListener("click", () => showPost(post));
      post.parentNode.insertBefore(stub, post);
      post._lffStub = stub;
    }
  }

  function showPost(post) {
    post.classList.remove("lff-hidden-post");
    if (post._lffStub) { post._lffStub.remove(); post._lffStub = null; }
    if (post.dataset.lff === "hidden") stats.hidden--;
    post.dataset.lff = "shown";
    updateBadge();
  }

  function showAll() {
    qa(document, "[data-lff='hidden']").forEach(showPost);
  }

  function resetAll() {
    qa(document, "[data-lff]").forEach((post) => {
      post.classList.remove("lff-hidden-post");
      if (post._lffStub) { post._lffStub.remove(); post._lffStub = null; }
      delete post.dataset.lff;
      delete post.dataset.lffReason;
    });
    stats.total = 0; stats.hidden = 0;
    updateBadge();
    if (S.enabled) scan();
  }

  function updateBadge() {
    try { chrome.runtime.sendMessage({ type: "badge", count: stats.hidden }, () => void chrome.runtime.lastError); } catch {}
    if (condenseState) renderTopbar();
  }

  // --------------------------------------------------------------------
  // Scanning
  // --------------------------------------------------------------------
  function scan() {
    if (!S || !S.enabled) return;
    const posts = qa(document, S.selectors.post);
    // avoid nested matches: keep only outermost
    for (const p of posts) {
      if (p.dataset.lff) continue;
      if (p.parentElement && p.parentElement.closest(S.selectors.post)) continue;
      processPost(p);
    }
  }

  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => { scanTimer = null; scan(); }, 250);
  }

  // --------------------------------------------------------------------
  // Load & condense
  // --------------------------------------------------------------------
  function postCount() {
    return qa(document, S.selectors.post).filter((p) => !(p.parentElement && p.parentElement.closest(S.selectors.post))).length;
  }

  async function startCondense() {
    if (condenseState && condenseState.running) return;
    const c = S.condense;
    condenseState = { running: true, startedAt: Date.now(), loaded: 0, stop: false, phase: "scrolling" };
    renderTopbar();
    let stale = 0, last = postCount();
    while (!condenseState.stop) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(c.scrollPauseMs);
      scan();
      const n = postCount();
      condenseState.loaded = n;
      renderTopbar();
      if (n >= c.maxPosts) break;
      if ((Date.now() - condenseState.startedAt) / 1000 >= c.maxSeconds) break;
      if (n === last) { if (++stale >= 6) break; } else stale = 0;
      last = n;
    }
    condenseState.phase = "analysing";
    renderTopbar();
    const deadline = Date.now() + 30000;
    while (pending.size && Date.now() < deadline && !condenseState.stop) await sleep(300);
    applyResultMode();
    condenseState.running = false;
    condenseState.phase = "done";
    window.scrollTo({ top: 0, behavior: "auto" });
    renderTopbar();
  }

  function applyResultMode() {
    const remove = S.condense.resultMode === "remove";
    qa(document, "[data-lff='hidden']").forEach((post) => {
      if (post._lffStub) post._lffStub.classList.toggle("lff-stub-removed", remove);
    });
  }

  let topbar = null;
  function renderTopbar() {
    if (!condenseState) return;
    if (!topbar) {
      topbar = document.createElement("div");
      topbar.className = "lff-topbar";
      document.body.appendChild(topbar);
    }
    const st = condenseState;
    const shown = stats.total - stats.hidden;
    let html = "";
    if (st.phase === "scrolling") {
      html = `<span>Loading feed… ${st.loaded} posts, ${Math.round((Date.now() - st.startedAt) / 1000)} s</span>
              <button class="lff-secondary" data-act="stop">Stop</button>`;
    } else if (st.phase === "analysing") {
      html = `<span>Analysing ${pending.size} posts…</span><button class="lff-secondary" data-act="stop">Stop</button>`;
    } else {
      html = `<span>Loaded ${stats.total} · hidden ${stats.hidden} · showing ${shown}</span>
              <button data-act="more">Load more</button>
              <button class="lff-secondary" data-act="showall">Show hidden</button>
              <span class="lff-close" data-act="close">✕</span>`;
    }
    topbar.innerHTML = html;
    topbar.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => {
      const act = b.dataset.act;
      if (act === "stop") condenseState.stop = true;
      if (act === "more") startCondense();
      if (act === "showall") { showAll(); applyResultMode(); renderTopbar(); }
      if (act === "close") { topbar.remove(); topbar = null; condenseState = null; }
    }));
  }

  // --------------------------------------------------------------------
  // Messages from popup
  // --------------------------------------------------------------------
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === "getStats") {
      sendResponse({ ...stats, condensing: !!(condenseState && condenseState.running), enabled: S ? S.enabled : false });
    } else if (msg.type === "condense") {
      startCondense(); sendResponse({ ok: true });
    } else if (msg.type === "stopCondense") {
      if (condenseState) condenseState.stop = true; sendResponse({ ok: true });
    } else if (msg.type === "showAll") {
      showAll(); sendResponse({ ok: true });
    } else if (msg.type === "reapply") {
      resetAll(); sendResponse({ ok: true });
    }
    return false;
  });

  // --------------------------------------------------------------------
  // Boot
  // --------------------------------------------------------------------
  async function boot() {
    await loadSettings();
    observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true });
    if (S.photoFilter.enabled || S.genderFilter.useAvatarFace) ensureModels().catch(() => {});
    scan();
    if (S.condense.autoStart && /^\/feed\/?/.test(location.pathname)) {
      setTimeout(startCondense, 2500);
    }
  }

  boot();
})();
