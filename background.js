// Service worker: fetches images with host permissions (so the content script
// gets a non-tainted copy for face detection) and keeps the badge counter.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "fetchImage") {
    fetchAsDataUrl(msg.url)
      .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // async
  }

  if (msg && msg.type === "badge") {
    const tabId = sender.tab && sender.tab.id;
    if (tabId != null) {
      const text = msg.count > 0 ? String(msg.count) : "";
      chrome.action.setBadgeText({ tabId, text });
      chrome.action.setBadgeBackgroundColor({ tabId, color: "#5c6b7a" });
    }
    sendResponse({ ok: true });
    return false;
  }

  if (msg && msg.type === "getDefaults") {
    sendResponse({ ok: true });
    return false;
  }
});

async function fetchAsDataUrl(url) {
  const res = await fetch(url, { credentials: "omit", cache: "force-cache" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const blob = await res.blob();
  // Service workers have no FileReader; go through ArrayBuffer -> base64.
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  const mime = blob.type || "image/jpeg";
  return "data:" + mime + ";base64," + btoa(bin);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: "" });
});
