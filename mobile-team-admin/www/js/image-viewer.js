(() => {
  "use strict";
  if (window.G58ImageViewer) return;

  const MEDIA_PATH = /\/api\/v1\/media\/[^/?#]+/;
  const STYLE_ID = "g58ImageViewerStyles";
  let overlay = null;
  let stage = null;
  let titleNode = null;
  let objectUrl = "";
  let opener = null;
  let historyPushed = false;
  let requestId = 0;

  const isOpen = () => Boolean(overlay && !overlay.hidden);

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .g58-viewer{position:fixed;inset:0;z-index:2147482000;display:flex;flex-direction:column;background:#080b12;color:#fff;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
      .g58-viewer[hidden]{display:none}
      .g58-viewer-bar{display:flex;align-items:center;gap:12px;padding:max(10px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) 10px max(14px,env(safe-area-inset-left));border-bottom:1px solid rgba(255,255,255,.16)}
      .g58-viewer-title{flex:1;min-width:0;font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .g58-viewer-close{flex:0 0 auto;min-width:96px;min-height:44px;padding:0 18px;border:0;border-radius:999px;background:#fff;color:#0b1220;font:800 14px/1 inherit;cursor:pointer}
      .g58-viewer-close:focus-visible{outline:3px solid #7fb2ff;outline-offset:2px}
      .g58-viewer-stage{flex:1;min-height:0;overflow:auto;display:grid;place-items:center;padding:14px;-webkit-overflow-scrolling:touch}
      .g58-viewer-stage img,.g58-viewer-stage video{max-width:100%;max-height:calc(100vh - 110px);max-height:calc(100dvh - 110px);object-fit:contain;border-radius:10px;background:#000;cursor:zoom-in}
      .g58-viewer-stage.zoomed{place-items:start center}
      .g58-viewer-stage.zoomed img{max-width:none;max-height:none;cursor:zoom-out}
      .g58-viewer-status{margin:0;max-width:34ch;text-align:center;line-height:1.6;color:#c9d3e3}
      .g58-viewer-status a{color:#9cc4ff}
      .g58-viewer-lock{overflow:hidden!important}
    `;
    document.head.appendChild(style);
  }

  function build() {
    overlay = document.createElement("div");
    overlay.className = "g58-viewer";
    overlay.hidden = true;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "File preview");
    overlay.innerHTML = '<div class="g58-viewer-bar"><strong class="g58-viewer-title"></strong><button type="button" class="g58-viewer-close" aria-label="Close preview">\u2715 Close</button></div><div class="g58-viewer-stage"></div>';
    document.body.appendChild(overlay);
    stage = overlay.querySelector(".g58-viewer-stage");
    titleNode = overlay.querySelector(".g58-viewer-title");
    overlay.querySelector(".g58-viewer-close").addEventListener("click", requestClose);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay || event.target === stage) requestClose();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isOpen()) requestClose();
    });
    // The phone/browser Back button closes the preview and leaves the page underneath untouched.
    window.addEventListener("popstate", () => { if (isOpen()) hide(); });
  }

  function status(message, fallbackUrl) {
    stage.classList.remove("zoomed");
    const note = document.createElement("p");
    note.className = "g58-viewer-status";
    note.textContent = message;
    if (fallbackUrl) {
      const link = document.createElement("a");
      link.href = fallbackUrl;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = " Open it in the browser instead.";
      note.appendChild(link);
    }
    stage.replaceChildren(note);
  }

  function hide() {
    if (!overlay || overlay.hidden) return;
    requestId += 1;
    overlay.hidden = true;
    historyPushed = false;
    document.documentElement.classList.remove("g58-viewer-lock");
    stage.classList.remove("zoomed");
    stage.replaceChildren();
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = ""; }
    const previous = opener;
    opener = null;
    try { previous?.focus?.({ preventScroll: true }); } catch {}
  }

  function requestClose() {
    if (!isOpen()) return;
    if (historyPushed && history.state?.g58Viewer) {
      history.back();
      setTimeout(hide, 300);
    } else {
      hide();
    }
  }

  async function open(url, title, trigger) {
    installStyles();
    if (!overlay) build();
    if (isOpen()) hide();
    opener = trigger || document.activeElement;
    const id = ++requestId;
    titleNode.textContent = title || "Uploaded file";
    status("Loading\u2026");
    overlay.hidden = false;
    document.documentElement.classList.add("g58-viewer-lock");
    try {
      history.pushState({ g58Viewer: true }, "", location.href);
      historyPushed = true;
    } catch {}
    overlay.querySelector(".g58-viewer-close").focus({ preventScroll: true });
    try {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      if (id !== requestId) return;
      const type = blob.type || response.headers.get("content-type") || "";
      objectUrl = URL.createObjectURL(blob);
      let node;
      if (/^video\//i.test(type)) {
        node = document.createElement("video");
        node.controls = true;
        node.playsInline = true;
      } else {
        node = document.createElement("img");
        node.alt = title || "Uploaded file";
        node.addEventListener("click", () => stage.classList.toggle("zoomed"));
      }
      node.src = objectUrl;
      stage.replaceChildren(node);
    } catch (error) {
      if (id !== requestId) return;
      status("This file could not be loaded. It may have been deleted already.", url);
    }
  }

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!link || link.closest(".g58-viewer") || link.hasAttribute("download")) return;
    let url;
    try { url = new URL(link.href, location.href); } catch { return; }
    if (!MEDIA_PATH.test(url.pathname)) return;
    event.preventDefault();
    open(url.href, (link.textContent || "").replace(/[\u2197\u{1F4C4}]/gu, "").trim(), link);
  }, true);

  window.G58ImageViewer = Object.freeze({ open, close: requestClose });
})();
