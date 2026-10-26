// Options page: maps form fields <-> settings object stored in chrome.storage.local.

const $ = (id) => document.getElementById(id);

// id -> path in settings
const MAP = {
  "enabled": "enabled",
  "hideMode": "hideMode",
  "hidePromoted": "hidePromoted",
  "hideSuggested": "hideSuggested",
  "gf.enabled": "genderFilter.enabled",
  "gf.skip.male": "genderFilter.skip.male",
  "gf.skip.female": "genderFilter.skip.female",
  "gf.skip.other": "genderFilter.skip.other",
  "gf.skip.unknown": "genderFilter.skip.unknown",
  "gf.usePronouns": "genderFilter.usePronouns",
  "gf.useNameLists": "genderFilter.useNameLists",
  "gf.useRuSuffix": "genderFilter.useRuSuffix",
  "gf.useAvatarFace": "genderFilter.useAvatarFace",
  "gf.avatarMinConfidence": "genderFilter.avatarMinConfidence",
  "kf.enabled": "keywordFilter.enabled",
  "kf.matchMode": "keywordFilter.matchMode",
  "kf.fields.headline": "keywordFilter.fields.headline",
  "kf.fields.company": "keywordFilter.fields.company",
  "kf.fields.name": "keywordFilter.fields.name",
  "kf.fields.text": "keywordFilter.fields.text",
  "pf.enabled": "photoFilter.enabled",
  "pf.mode": "photoFilter.mode",
  "pf.faceMinConfidence": "photoFilter.faceMinConfidence",
  "pf.maxImagesPerPost": "photoFilter.maxImagesPerPost",
  "pf.includeVideoThumbs": "photoFilter.includeVideoThumbs",
  "c.autoStart": "condense.autoStart",
  "c.maxSeconds": "condense.maxSeconds",
  "c.maxPosts": "condense.maxPosts",
  "c.scrollPauseMs": "condense.scrollPauseMs",
  "c.resultMode": "condense.resultMode"
};
const LISTS = ["maleNames", "femaleNames", "keywords", "promotedWords", "suggestedWords"];

function get(obj, path) { return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj); }
function set(obj, path, val) {
  const ks = path.split("."); let o = obj;
  for (let i = 0; i < ks.length - 1; i++) { if (typeof o[ks[i]] !== "object" || o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; }
  o[ks[ks.length - 1]] = val;
}
function deepMerge(base, over) {
  if (Array.isArray(base)) return Array.isArray(over) ? over : base;
  if (base && typeof base === "object") {
    const out = { ...base };
    if (over && typeof over === "object") for (const k of Object.keys(over)) out[k] = deepMerge(base[k], over[k]);
    return out;
  }
  return over === undefined ? base : over;
}
function parseList(s) {
  return s.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
}

function fill(s) {
  for (const [id, path] of Object.entries(MAP)) {
    const el = $(id); const v = get(s, path);
    if (el.type === "checkbox") el.checked = !!v; else el.value = v;
  }
  for (const id of LISTS) $(id).value = (s[id] || []).join(id.endsWith("Names") ? "\n" : ", ");
  $("selectors").value = JSON.stringify(s.selectors, null, 2);
}

function collect() {
  const s = JSON.parse(JSON.stringify(LFF_DEFAULTS));
  for (const [id, path] of Object.entries(MAP)) {
    const el = $(id);
    let v = el.type === "checkbox" ? el.checked : el.value;
    if (el.type === "number") v = Number(v);
    set(s, path, v);
  }
  for (const id of LISTS) s[id] = parseList($(id).value);
  s.selectors = JSON.parse($("selectors").value);
  return s;
}

function status(msg, ok = true) {
  const el = $("status"); el.textContent = msg; el.style.color = ok ? "#0a7a3b" : "#b42318";
  setTimeout(() => { el.textContent = ""; }, 2500);
}

chrome.storage.local.get("settings", (res) => fill(deepMerge(LFF_DEFAULTS, res.settings || {})));

$("save").addEventListener("click", () => {
  let s;
  try { s = collect(); } catch (e) { return status("Invalid JSON in selectors: " + e.message, false); }
  chrome.storage.local.set({ settings: s }, () => status("Saved"));
});

$("reset").addEventListener("click", () => {
  if (!confirm("Reset all settings to defaults?")) return;
  chrome.storage.local.set({ settings: LFF_DEFAULTS }, () => { fill(LFF_DEFAULTS); status("Defaults restored"); });
});
