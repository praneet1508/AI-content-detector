// background.js (MV3 service worker)
// Use the service worker console (chrome://extensions -> Service worker -> Inspect) for logs.

const BACKEND = "http://127.0.0.1:8000/detect"; // change if needed

// Utility: POST image blob to backend (multipart). Returns parsed JSON or throws.
async function postBlobToServer(blob, src) {
  const fd = new FormData();
  fd.append("file", blob, "image.jpg");
  let res;
  try {
    res = await fetch(BACKEND, { method: "POST", body: fd });
  } catch (err) {
    throw new Error(`Network error posting to backend for ${src}: ${err.message}`);
  }
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`Backend returned ${res.status} for ${src}. Body: ${text}`);
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error(`Backend returned non-JSON for ${src}: ${text}`);
  }
}

// Utility: fetch image as blob, try with credentials fallback
async function fetchImageAsBlob(src) {
  if (src.startsWith("data:")) throw new Error("data: URI skipped");
  // try default
  try {
    const r = await fetch(src);
    if (!r.ok) throw new Error(`fetch status ${r.status}`);
    const b = await r.blob();
    if (!b || b.size === 0) throw new Error("empty blob");
    return b;
  } catch (err1) {
    // try with credentials for same-site authenticated images
    try {
      const r2 = await fetch(src, { credentials: "include" });
      if (!r2.ok) throw new Error(`fetch-with-creds status ${r2.status}`);
      const b2 = await r2.blob();
      if (!b2 || b2.size === 0) throw new Error("empty blob (with creds)");
      return b2;
    } catch (err2) {
      throw new Error(`fetch failed: ${err1.message}; fallback failed: ${err2.message}`);
    }
  }
}

// Listen for scan request from popup/content
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "scanImages" && Array.isArray(msg.images)) {
    (async () => {
      console.log("[bg] scanImages received:", msg.images);
      const results = [];
      for (const src of msg.images) {
        try {
          const blob = await fetchImageAsBlob(src);
          console.log("[bg] fetched blob", src, "size", blob.size);
          const json = await postBlobToServer(blob, src);
          console.log("[bg] backend response for", src, "->", json);
          results.push({ src, ok: true, result: json });
        } catch (err) {
          console.error("[bg] error processing", src, err);
          results.push({ src, ok: false, error: String(err) });
        }
      }

      // send results to the tab that requested the scan (if available)
      if (sender.tab && sender.tab.id) {
        try {
          chrome.tabs.sendMessage(sender.tab.id, { type: "scanResults", results });
        } catch (e) {
          console.error("[bg] failed to send results to tab:", e);
        }
      } else {
        console.warn("[bg] sender.tab missing, cannot send scanResults to page");
      }

      // send summary for popup UI
      const total = results.length;
      const aiCount = results.reduce((acc, r) => acc + ((r.ok && r.result && r.result.ai) ? 1 : 0), 0);
      chrome.runtime.sendMessage({ type: "scanComplete", totalImages: total, aiImages: aiCount });
      console.log("[bg] scan complete summary sent:", { total, aiCount });
    })();

    // return true to indicate async response (not using sendResponse here)
    return true;
  }
});
