(() => {
  "use strict";

  const BANNER_ID = "g58ServerStatus";
  const STYLE_ID = "g58ServerStatusStyles";
  const DEFAULT_ENDPOINT = "https://sgp.cloud.appwrite.io/v1";
  const DEFAULT_PROJECT_ID = "6a776883001717bca81c";
  const CHECK_INTERVAL_MS = 60_000;
  const REQUEST_TIMEOUT_MS = 8_000;
  const rootConfig = window.GRAVITY58_CONFIG || window.GRAVITY58_AD_BOOKING_CONFIG || window.GRAVITY58_AD_ADMIN_CONFIG || {};
  const appwriteConfig = rootConfig.appwrite || {};
  const endpoint = String(appwriteConfig.endpoint || DEFAULT_ENDPOINT).replace(/\/$/, "");
  const projectId = String(appwriteConfig.projectId || DEFAULT_PROJECT_ID);
  const localPreview = ["localhost", "127.0.0.1"].includes(location.hostname);
  const testEnabled = window.__G58_TEST_SERVER_STATUS__ === true;
  let timer = 0;
  let checking = false;

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${BANNER_ID}{position:fixed;z-index:2147483000;top:max(12px,env(safe-area-inset-top));left:50%;transform:translate(-50%,-18px);width:min(760px,calc(100% - 24px));display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid rgba(255,255,255,.36);border-radius:16px;background:linear-gradient(135deg,#8f1d1d,#d93636);color:#fff;box-shadow:0 14px 40px rgba(92,0,0,.34);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .22s ease,transform .22s ease,visibility .22s ease}
      #${BANNER_ID}.is-visible{opacity:1;visibility:visible;transform:translate(-50%,0);pointer-events:auto}
      #${BANNER_ID} .g58-server-status-icon{display:grid;place-items:center;flex:0 0 34px;width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.16);font-size:19px;font-weight:900}
      #${BANNER_ID} .g58-server-status-copy{flex:1;min-width:0;line-height:1.28}
      #${BANNER_ID} strong{display:block;color:#fff;font-size:15px;letter-spacing:.01em}
      #${BANNER_ID} small{display:block;margin-top:2px;color:rgba(255,255,255,.9);font-size:12px}
      #${BANNER_ID} button{flex:0 0 auto;min-height:38px;padding:8px 14px;border:1px solid rgba(255,255,255,.6);border-radius:11px;background:#fff;color:#8f1d1d;font:800 13px/1 Inter,system-ui,sans-serif;cursor:pointer}
      #${BANNER_ID} button:disabled{opacity:.65;cursor:wait}
      @media(max-width:560px){#${BANNER_ID}{align-items:flex-start;gap:9px;padding:11px;border-radius:14px}#${BANNER_ID} .g58-server-status-icon{width:30px;height:30px;flex-basis:30px;font-size:17px}#${BANNER_ID} strong{font-size:14px}#${BANNER_ID} small{font-size:11px}#${BANNER_ID} button{min-height:34px;padding:7px 10px;font-size:12px}}
      @media(prefers-reduced-motion:reduce){#${BANNER_ID}{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function banner() {
    let node = document.getElementById(BANNER_ID);
    if (node) return node;
    installStyles();
    node = document.createElement("aside");
    node.id = BANNER_ID;
    node.setAttribute("role", "alert");
    node.setAttribute("aria-live", "assertive");
    node.setAttribute("aria-atomic", "true");
    node.innerHTML = `<span class="g58-server-status-icon" aria-hidden="true">!</span><span class="g58-server-status-copy"><strong>G58 server is temporarily unavailable</strong><small>Live data, login, orders and payments may not work. Reconnecting automatically.</small></span><button type="button" data-g58-server-retry>Retry</button>`;
    node.querySelector("[data-g58-server-retry]").addEventListener("click", () => check(true));
    document.body.appendChild(node);
    return node;
  }

  function reportUnavailable() {
    banner().classList.add("is-visible");
    try { localStorage.setItem("g58ServerStatus", JSON.stringify({ state: "down", at: Date.now() })); } catch {}
  }

  function reportAvailable() {
    document.getElementById(BANNER_ID)?.classList.remove("is-visible");
    try { localStorage.setItem("g58ServerStatus", JSON.stringify({ state: "up", at: Date.now() })); } catch {}
  }

  async function check(manual = false) {
    if (checking) return false;
    checking = true;
    const retry = document.querySelector(`#${BANNER_ID} [data-g58-server-retry]`);
    if (retry) { retry.disabled = true; retry.textContent = "Checking…"; }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${endpoint}/account?g58-status=${Date.now()}`, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        headers: { "X-Appwrite-Project": projectId },
        signal: controller.signal,
      });
      if (response.status >= 500) throw new Error(`Server returned ${response.status}`);
      reportAvailable();
      return true;
    } catch {
      reportUnavailable();
      return false;
    } finally {
      clearTimeout(timeout);
      checking = false;
      const currentRetry = document.querySelector(`#${BANNER_ID} [data-g58-server-retry]`);
      if (currentRetry) { currentRetry.disabled = false; currentRetry.textContent = manual ? "Retry" : "Retry"; }
    }
  }

  window.G58ServerStatus = Object.freeze({ check, reportUnavailable, reportAvailable });
  window.addEventListener("offline", reportUnavailable);
  window.addEventListener("online", () => check());
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });

  try {
    const saved = JSON.parse(localStorage.getItem("g58ServerStatus") || "null");
    if (saved?.state === "down" && Date.now() - Number(saved.at || 0) < CHECK_INTERVAL_MS) reportUnavailable();
  } catch {}

  if (!localPreview || testEnabled) {
    setTimeout(check, 250);
    timer = window.setInterval(check, CHECK_INTERVAL_MS);
    window.addEventListener("pagehide", () => clearInterval(timer), { once: true });
  }
})();
