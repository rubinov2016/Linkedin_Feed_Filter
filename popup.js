const $ = (id) => document.getElementById(id);
let tabId = null;

function send(msg) {
  return new Promise((resolve) => {
    if (tabId == null) return resolve(null);
    chrome.tabs.sendMessage(tabId, msg, (res) => {
      if (chrome.runtime.lastError) return resolve(null);
      resolve(res);
    });
  });
}

async function refresh() {
  const st = await send({ type: "getStats" });
  if (!st) {
    $("stats").textContent = "Open a LinkedIn tab to use the filter.";
    $("note").textContent = "";
    ["condense", "showAll", "reapply"].forEach((id) => ($(id).disabled = true));
    return;
  }
  ["condense", "showAll", "reapply"].forEach((id) => ($(id).disabled = false));
  $("stats").textContent = `Seen ${st.total} · hidden ${st.hidden} · showing ${st.total - st.hidden}`;
  $("condense").style.display = st.condensing ? "none" : "";
  $("stop").style.display = st.condensing ? "" : "none";
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const t = tabs[0];
  if (t && /^https:\/\/www\.linkedin\.com\//.test(t.url || "")) tabId = t.id;
  refresh();
  setInterval(refresh, 1500);
});

chrome.storage.local.get("settings", (res) => {
  const s = res.settings || {};
  $("enabled").checked = s.enabled !== false;
});

$("enabled").addEventListener("change", () => {
  chrome.storage.local.get("settings", (res) => {
    const s = res.settings || {};
    s.enabled = $("enabled").checked;
    chrome.storage.local.set({ settings: s });
  });
});

$("condense").addEventListener("click", async () => { await send({ type: "condense" }); refresh(); });
$("stop").addEventListener("click", async () => { await send({ type: "stopCondense" }); refresh(); });
$("showAll").addEventListener("click", async () => { await send({ type: "showAll" }); refresh(); });
$("reapply").addEventListener("click", async () => { await send({ type: "reapply" }); refresh(); });
$("options").addEventListener("click", () => chrome.runtime.openOptionsPage());
