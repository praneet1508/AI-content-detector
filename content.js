// content.js - injected by popup when requested. Exposes window.runScan()
// Listens for scanResults and annotates images.

(function () {
  function collectImageSrcs() {
    const imgs = Array.from(document.querySelectorAll("img"));
    const srcs = imgs
      .map(i => i.currentSrc || i.src || i.getAttribute("data-src"))
      .filter(Boolean)
      .filter(s => !s.startsWith("data:"));
    const unique = Array.from(new Set(srcs));
    console.log("[content] collected images:", unique);
    return unique;
  }

  function applyResults(results) {
    console.log("[content] applyResults", results);
    for (const r of results) {
      // Try to match final URL: compare by exact src/currentSrc
      const matches = Array.from(document.querySelectorAll("img")).filter(img => {
        const s = img.currentSrc || img.src || img.getAttribute("data-src");
        return s === r.src;
      });

      if (!matches.length) {
        // If no exact match, try substring match as a fallback
        const fallback = Array.from(document.querySelectorAll("img")).filter(img => {
          const s = img.currentSrc || img.src || img.getAttribute("data-src") || "";
          return s && r.src && (s === r.src || s.endsWith(r.src) || r.src.endsWith(s));
        });
        fallback.forEach(img => matches.push(img));
      }

      if (!matches.length) {
        console.warn("[content] no <img> match for", r.src);
      }

      for (const img of matches) {
        if (!r.ok) {
          img.style.outline = "3px dashed orange";
          img.setAttribute("data-ai-detection", "error");
          img.title = "AI detection error: " + (r.error || "unknown");
          continue;
        }
        const ai = !!(r.result && r.result.ai);
        img.style.outline = ai ? "4px solid red" : "3px solid limegreen";
        img.setAttribute("data-ai-detected", ai ? "true" : "false");
        img.title = ai ? "AI-generated (detected)" : "Likely real (not detected)";
      }
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === "scanResults" && Array.isArray(msg.results)) {
      console.log("[content] received scanResults", msg.results);
      applyResults(msg.results);
    }
  });

  async function runScan() {
    console.log("[content] runScan called");
    const images = collectImageSrcs();
    if (!images.length) {
      chrome.runtime.sendMessage({ type: "scanComplete", totalImages: 0, aiImages: 0 });
      alert("No images found on this page.");
      return;
    }
    // send list to background
    chrome.runtime.sendMessage({ type: "scanImages", images });
  }

  // Expose to page so popup injection can call it
  window.runScan = runScan;
})();
