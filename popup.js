// popup.js
document.addEventListener("DOMContentLoaded", () => {
  const scanBtn = document.getElementById("scanBtn");
  const statusEl = document.getElementById("status");
  const totalEl = document.getElementById("totalImages");
  const aiEl = document.getElementById("aiImages");
  const rateEl = document.getElementById("detectionRate");

  scanBtn.addEventListener("click", async () => {
    statusEl.textContent = "Preparing scan...";
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      statusEl.textContent = "No active tab.";
      return;
    }

    try {
      // Inject content.js into the page (if not already present)
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
    } catch (e) {
      statusEl.textContent = "Failed to inject content script: " + String(e);
      console.error("[popup] inject error", e);
      return;
    }

    statusEl.textContent = "Starting scan...";
    try {
      // call window.runScan() in page context (content.js defines it)
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          if (typeof window.runScan === "function") {
            window.runScan();
          } else {
            // fallback: collect images from page and send to background
            const imgs = Array.from(document.querySelectorAll("img"))
              .map(i => i.currentSrc || i.src || i.getAttribute("data-src"))
              .filter(Boolean)
              .filter(s => !s.startsWith("data:"));
            chrome.runtime.sendMessage({ type: "scanImages", images: Array.from(new Set(imgs)) });
          }
        }
      });
      statusEl.textContent = "Scanning (in background)...";
    } catch (err) {
      statusEl.textContent = "Scan start failed: " + String(err);
      console.error("[popup] runScan error", err);
    }
  });

  // Listen for summary messages from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "scanComplete") {
      const total = msg.totalImages || 0;
      const ai = msg.aiImages || 0;
      totalEl.textContent = total;
      aiEl.textContent = ai;
      rateEl.textContent = total ? ((ai / total) * 100).toFixed(1) + "%" : "-";
      statusEl.textContent = "Scan complete";
    }
  });
});
